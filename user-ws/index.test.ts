import { test, describe, expect } from "bun:test";

const BACKEND_URL1 = "ws://localhost:8080";
const BACKEND_URL2 = "ws://localhost:8081";

describe("Chat Application", () => {
  test("Msg sent from Room 1 is received by Room 1 members only", async () => {
    const ws1 = new WebSocket(BACKEND_URL1); // Room 1
    const ws2 = new WebSocket(BACKEND_URL2); // Room 1
    const ws3 = new WebSocket(BACKEND_URL2); // Room 2

    await new Promise<void>((resolve, reject) => {
      let cnt = 0;
      function check() {
        cnt++;
        console.log(`WebSocket ${cnt} connected`);
        if (cnt === 3) resolve();
      }
      ws1.onopen = check;
      ws2.onopen = check;
      ws3.onopen = check;

      ws1.onerror = ws2.onerror = ws3.onerror = (err) => {
        console.error("WebSocket connection error:", err);
        reject(err);
      };
    });

    console.log("All WebSockets connected.");

    ws1.send(JSON.stringify({ type: "join-room", room: "Room 1" }));
    ws2.send(JSON.stringify({ type: "join-room", room: "Room 1" }));
    ws3.send(JSON.stringify({ type: "join-room", room: "Room 2" }));

    await new Promise<void>((resolve, reject) => {
      ws2.onmessage = ({ data }) => {
        console.log("✅ ws2 received message:", data);
        const parsedData = JSON.parse(data);
        expect(parsedData.type === "chat");
        expect(parsedData.message === "Hello there");
        resolve();
      };

      ws3.onmessage = ({ data }) => {
        console.error("❌ ERROR: ws3 (Room 2) should not receive message:", data);
        reject("Room 2 received message meant for Room 1");
      };

      console.log("Sending message from ws1...");
      ws1.send(
        JSON.stringify({
          type: "chat",
          room: "Room 1",
          message: "Hello there",
        })
      );
    });
  });
});
