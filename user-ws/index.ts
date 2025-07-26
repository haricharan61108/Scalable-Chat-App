import {WebSocketServer,WebSocket as WebSocketWsType} from 'ws';

const PORT = parseInt(process.env.PORT || '8080');
const wss = new WebSocketServer({ port: PORT });
interface Room {
    sockets:WebSocketWsType[]
}

console.log("Server started on port "+PORT);
const rooms:Record<string,Room>={

}
const RELAYER_URL="ws://localhost:3001";
const relayerSocket=new WebSocket(RELAYER_URL);

relayerSocket.onmessage=({data})=>{
    const parsedData=JSON.parse(data);
       const room=parsedData.room;
        if(!rooms[room]){
            return;
        }
        rooms[room].sockets.map(socket=>socket.send(data));
}
let cnt=0;
wss.on('connection',function connection(ws){
    ws.on('error', console.error);
    console.log('connected user '+cnt);
    cnt=cnt+1;
    ws.on('message',function message(data:string){
        const parsedData=JSON.parse(data);
        
        if(parsedData.type==="join-room") {
            const room=parsedData.room;
            if(!rooms[room]){
                rooms[room]={
                    sockets:[]
                }
            }
            rooms[room].sockets.push(ws);
        }
        if(parsedData.type==="chat") {
            relayerSocket.send(data);
        }
    })
    
})
