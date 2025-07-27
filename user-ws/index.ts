import { serve } from 'bun';
import {WebSocketServer,WebSocket as WebSocketWsType} from 'ws';
import {PrismaClient} from "@prisma/client";
import { randomUUID } from "crypto";
const prisma = new PrismaClient();


const wss = new WebSocketServer({ port: 3000 });

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
  const room = parsedData.room;
  if (!room || !rooms[room]) return;

  rooms[room].sockets.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    }
  });
};

wss.on("connection", function connection(ws) {
  ws.on("error", console.error);

  ws.on("message", function message(data: string) {
    const parsedData = JSON.parse(data);

    // Join Room
    if (parsedData.type === "join-room") {
      const { room, userId } = parsedData;
      if (!room || !userId) return;

      if (!rooms[room]) {
        rooms[room] = { sockets: [] };
      }

      if (!rooms[room].sockets.includes(ws)) {
        rooms[room].sockets.push(ws);
        console.log(`User ${userId} joined room ${room}`);
      }
    }

    // Chat Message
    if (parsedData.type === "chat") {
      if (relayerSocket.readyState === WebSocket.OPEN) {
        relayerSocket.send(data);
      }
    }
  });

  ws.on("close", () => {
    // Cleanup: Remove socket from all rooms
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
  
      if (req.method === "POST" && url.pathname === "/register") {
        const body = await req.json() as { email: string; password: string };
        const { email, password } = body;
  
        if (!email || !password) {
          return new Response("Missing fields", { status: 400 });
        }
  
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return new Response("User already exists", { status: 409 });
  
        const user = await prisma.user.create({ data: { email, password } });
        return Response.json({ id: user.id, email: user.email });
      }
  
      if (req.method === "POST" && url.pathname === "/login") {
        const body = await req.json() as { email: string; password: string };
        const { email, password } = body;
  
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.password !== password) {
          return new Response("Invalid credentials", { status: 401 });
        }
  
        return Response.json({ id: user.id, email: user.email });
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

          return Response.json({ joined, notJoined });
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

          return new Response("Joined group", { status: 200 });
      }

      if(req.method==="POST" && url.pathname==="/create-group") {
        const body=await req.json();
        const { name, userId } = body as { name: string; userId: string };

       if (!name || !userId) {
        return new Response("Missing name or userId", { status: 400 });
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

        return Response.json(group);
      }
  
      return new Response("Not Found", { status: 404 });
    }
  });