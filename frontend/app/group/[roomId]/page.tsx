"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import api from "@/lib/axios";

type Message = {
  id: string;
  content: string;
  senderId: string;
  groupId: string;
  createdAt: string;
};

export default function GroupChatPage() {
  const { roomId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await api.get(`/messages/${roomId}`);
        setMessages(res.data.sort((a: Message, b: Message) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ));
        scrollToBottom();
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      }
    };
    fetchMessages();
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !userId) return;

    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3000";
    ws.current = new WebSocket(socketUrl);

    ws.current.onopen = () => {
      setIsConnected(true);
      ws.current?.send(JSON.stringify({ type: "join-room", roomId, userId }));
    };

    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "chat") {
        setMessages((prev) => {
          // Prevent duplicates
          if (!prev.some(m => m.id === msg.id)) {
            return [...prev, msg].sort((a, b) => 
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          }
          return prev;
        });
        scrollToBottom();
      }
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
    };

    ws.current.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
    };
  }, [roomId, userId]);

  const sendMessage = () => {
    if (!newMessage.trim() || !isConnected) return;
    const payload = {
      type: "chat",
      content: newMessage,
      senderId: userId,
      groupId: roomId,
    };
    ws.current?.send(JSON.stringify(payload));
    setNewMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Group Chat - {roomId}</h2>
        <div className={`h-3 w-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} 
             title={isConnected ? "Connected" : "Disconnected"} />
      </div>
      
      <div className="flex-1 overflow-y-auto border p-4 rounded mb-4">
        {messages.length === 0 ? (
          <p className="text-center text-gray-500">No messages yet</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`mb-2 p-2 rounded ${
                msg.senderId === userId ? "bg-blue-100 ml-auto" : "bg-gray-100 mr-auto"
              }`}
              style={{ maxWidth: "80%" }}
            >
              <div>{msg.content}</div>
              <div className="text-xs text-gray-500">
                {new Date(msg.createdAt).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          className="flex-1 border px-3 py-2 rounded"
          disabled={!isConnected}
        />
        <button
          onClick={sendMessage}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          disabled={!isConnected || !newMessage.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}