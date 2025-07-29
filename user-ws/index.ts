import { serve } from 'bun';
import {WebSocketServer,WebSocket as WebSocketWsType} from 'ws';
import { PrismaClient} from './generated/prisma';
import { randomUUID } from "crypto";

type Payload =
  | { type: "join-room"; roomId: string; userId: string }
  | {
      type: "chat";
      content: string;
      senderId: string;
      groupId: string;
    };

const prisma = new PrismaClient();
const setCorsHeaders = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return new Response(response.body, {
    status: response.status,
    headers
  });
};


const wss = new WebSocketServer({ port: 3000 });

console.log("Server started on port 3000");
type RoomMap = {
  [roomId: string]: {
    sockets: WebSocketWsType[];
  };
};

const rooms: RoomMap = {};

// Connect to relayer
const RELAYER_URL = "ws://localhost:3001";
const relayerSocket = new WebSocket(RELAYER_URL);

relayerSocket.onmessage = ({ data }) => {
  const parsedData = JSON.parse(data.toString());
  const room = parsedData.roomId;
  if (!room || !rooms[room]) return;
  rooms[room].sockets.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(parsedData));
    }
  });
};

wss.on("connection", function connection(ws) {
  ws.on("error", console.error);

  ws.on("message",async function message(rawData: string) {
    let parsedData: Payload;
    try {
      parsedData = JSON.parse(rawData);
    } catch (e) {
      console.error("Invalid JSON message:", rawData);
      return;
    }

    // Join Room
    if (parsedData.type === "join-room") {
      const { roomId, userId } = parsedData;
      if (!roomId || !userId) return;

      if (!rooms[roomId]) {
        rooms[roomId] = { sockets: [] };
      }

      if (!rooms[roomId].sockets.includes(ws)) {
        rooms[roomId].sockets.push(ws);
        console.log(`User ${userId} joined room ${roomId}`);
      }
    }
 
    if(parsedData.type==="chat") {
      const { content, senderId, groupId } = parsedData;

      try {
        const group = await prisma.group.findUnique({ 
          where: { roomId: groupId },
          select: { id: true } 
        });
        if (!group) {
          console.error(`Group with ID/roomId ${groupId} does not exist. 
            Received message:`, parsedData);
           return;
        }
        console.log("Group id:", group.id);
        const saved=await prisma.message.create({
          data: {
            content,
            senderId,
            groupId:group.id,
          }
        })
        const messageWithSender = {
          type: "chat",
          id: saved.id,
          content: saved.content,
          senderId: saved.senderId,
          groupId: saved.groupId,
          createdAt: saved.createdAt,
          roomId: groupId, 
        };

        if (relayerSocket.readyState === WebSocket.OPEN) {
          relayerSocket.send(JSON.stringify(messageWithSender));
        }
      } catch (err) {
        console.error("Failed to save message:", err);
      } 
    }
  });

  ws.on("close", () => {
    // Remove socket from all rooms
    for (const roomId in rooms) {
      rooms[roomId].sockets = rooms[roomId].sockets.filter(
        (s) => s !== ws
      );
      if (rooms[roomId].sockets.length === 0) {
        delete rooms[roomId];
      }
    }
  });
});

serve({
    port: 4000,
    async fetch(req) {
      const url = new URL(req.url);
      if (req.method === 'OPTIONS') {
        return setCorsHeaders(new Response(null, { status: 204 }));
      }
      try {
        let response: Response;
        if (req.method === "POST" && url.pathname === "/register") {
          const body = await req.json() as { email: string; password: string };
          const { email, password } = body;
    
          if (!email || !password) {
            response =new Response("Missing fields", { status: 400 });
          }
    
          const existing = await prisma.user.findUnique({ where: { email } });
          if (existing) return new Response("User already exists", { status: 409 });
    
          const user = await prisma.user.create({ data: { email, password } });
          response=Response.json({ id: user.id, email: user.email });
        }
    
        if (req.method === "POST" && url.pathname === "/login") {
          const body = await req.json() as { email: string; password: string };
          const { email, password } = body;
        
          const user = await prisma.user.findUnique({ where: { email } });
        
          if (!user || user.password !== password) {
            return new Response("Invalid credentials", { status: 401 });
          }
      
          response=Response.json({ token: user.id, email: user.email });
        }
        
  
        if(req.method==="GET" && url.pathname === "/groups") {
          const userId = url.searchParams.get("userId");
          if(!userId) {
              return new Response("Missing userId", { status: 400 });
          }
  
          const allGroups: {
    id: string;
    name: string;
    roomId: string;
    members: { userId: string }[];
  }[] = await prisma.group.findMany({
    select: {
      id: true,
      name: true,
      roomId: true,
      members: {
        select: {
          userId: true,
        },
      },
    },
  });          
  
            const joined = allGroups.filter(group =>
              group.members.some(member => member.userId === userId)
            );
          
            const notJoined = allGroups.filter(group =>
              !group.members.some(member => member.userId === userId)
            );
  
            response=Response.json({ joined, notJoined });
        }
  
        if(req.method === "POST" && url.pathname === "/join-group") {
          const body = await req.json();
          const { userId, groupId } = body as { userId: string; groupId: string };
        
          if (!userId || !groupId) {
            return new Response("Missing userId or groupId", { status: 400 });
          }
  
          const exisiting=await prisma.membership.findUnique({
              where: {
                  userId_groupId:{
                      userId,
                      groupId
                  },
              },
          });
          if (exisiting) {
              return new Response("Already joined", { status: 409 });
            }
  
            await prisma.membership.create({
              data: {
                userId,
                groupId,
              },
            });
  
            response=Response.json("Joined group", { status: 200 });
        }
  
        if(req.method==="POST" && url.pathname==="/create-group") {
          try {
            const body=await req.json();
          const { name, userId } = body as { name: string; userId: string };
  
         if (!name || !userId) {
          response=Response.json("Missing name or userId", { status: 400 });
          }
          const roomId=randomUUID();
          const group=await prisma.group.create({
            data: {
              name,
              roomId,
              createdBy:userId,
              members: {
                create:[ {
                  userId:userId
                } ],
              }
            }
          });
  
          response=Response.json(group);
          } catch (error) {
            console.error(error);
            return new Response("Internal Server Error", { status: 500 });
          }
          
        }

        if(req.method==="GET" && url.pathname.startsWith("/messages/")) {
          const groupId = url.pathname.split("/")[2];
          const messages = await prisma.message.findMany({
            where: { groupId },
            orderBy: { createdAt: "asc" },
          });

          response=Response.json(messages);
        }
        return setCorsHeaders(response);
      } catch (error) {
        console.error(error);
      return setCorsHeaders(new Response("Internal Server Error", { status: 500 }));
      }
      
  
      return new Response("Not Found", { status: 404 });
    }
  });