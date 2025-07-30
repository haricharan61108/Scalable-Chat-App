"use client"

import type React from "react"

import { useParams } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { Send, Users, Wifi, WifiOff, MessageCircle, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import api from "@/lib/axios"

type Message = {
  id: string
  content: string
  senderId: string
  groupId: string
  createdAt: string
}

export default function GroupChatPage() {
  const { roomId } = useParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const ws = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setShowScrollButton(!isNearBottom)
  }

  // Get user initials for avatar
  const getUserInitials = (senderId: string) => {
    return senderId.slice(0, 2).toUpperCase()
  }

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" })
    }
  }

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setIsLoading(true)
        const res = await api.get(`/messages/${roomId}`)
        setMessages(
          res.data.sort((a: Message, b: Message) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
        )
        setTimeout(scrollToBottom, 100)
      } catch (error) {
        console.error("Failed to fetch messages:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMessages()
  }, [roomId])

  useEffect(() => {
    if (!roomId || !userId) return

    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3000"
    ws.current = new WebSocket(socketUrl)

    ws.current.onopen = () => {
      setIsConnected(true)
      ws.current?.send(JSON.stringify({ type: "join-room", roomId, userId }))
    }

    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === "chat") {
        setMessages((prev) => {
          // Prevent duplicates
          if (!prev.some((m) => m.id === msg.id)) {
            return [...prev, msg].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          }
          return prev
        })
        setTimeout(scrollToBottom, 100)
      }
    }

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error)
      setIsConnected(false)
    }

    ws.current.onclose = () => {
      setIsConnected(false)
    }

    return () => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.close()
      }
    }
  }, [roomId, userId])

  const sendMessage = () => {
    if (!newMessage.trim() || !isConnected) return

    setIsTyping(true)
    const payload = {
      type: "chat",
      content: newMessage,
      senderId: userId,
      groupId: roomId,
    }

    ws.current?.send(JSON.stringify(payload))
    setNewMessage("")
    setTimeout(() => setIsTyping(false), 500)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <Card className="rounded-none border-x-0 border-t-0 shadow-sm bg-white/80 backdrop-blur-sm">
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-800">Room {roomId}</h1>
                <p className="text-sm text-slate-500">
                  {messages.length} message{messages.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Badge
              variant={isConnected ? "default" : "destructive"}
              className={`flex items-center space-x-1 ${
                isConnected
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                  : "bg-red-100 text-red-700 hover:bg-red-100"
              }`}
            >
              {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span className="text-xs font-medium">{isConnected ? "Connected" : "Disconnected"}</span>
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Messages Area */}
      <div className="flex-1 relative">
        <ScrollArea className="h-full px-4" onScrollCapture={handleScroll} ref={scrollAreaRef}>
          <div className="py-4 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center space-x-2 text-slate-500">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                  <span className="ml-2 text-sm">Loading messages...</span>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium text-slate-700 mb-2">No messages yet</h3>
                <p className="text-slate-500 text-sm max-w-sm">Be the first to start the conversation in this room!</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isOwnMessage = msg.senderId === userId
                const showAvatar = index === 0 || messages[index - 1].senderId !== msg.senderId
                const isLastInGroup = index === messages.length - 1 || messages[index + 1].senderId !== msg.senderId

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end space-x-2 ${
                      isOwnMessage ? "flex-row-reverse space-x-reverse" : ""
                    } animate-in slide-in-from-bottom-2 duration-300`}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {showAvatar && !isOwnMessage ? (
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-medium">
                            {getUserInitials(msg.senderId)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-8 h-8" />
                      )}
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                        isOwnMessage
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                          : "bg-white border border-slate-200 text-slate-800 shadow-sm"
                      } ${isLastInGroup ? (isOwnMessage ? "rounded-br-md" : "rounded-bl-md") : ""}`}
                    >
                      <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                      <p className={`text-xs mt-1 ${isOwnMessage ? "text-blue-100" : "text-slate-500"}`}>
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            {isTyping && (
              <div className="flex items-center space-x-2 text-slate-500 animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                </div>
                <span className="text-sm">Sending...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <Button
            onClick={scrollToBottom}
            size="sm"
            className="absolute bottom-4 right-4 rounded-full w-10 h-10 p-0 bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-600 hover:bg-white hover:text-slate-800 shadow-lg"
            variant="outline"
          >
            <ArrowDown className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Input Area */}
      <Card className="rounded-none border-x-0 border-b-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-end space-x-2">
            <div className="flex-1 relative">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isConnected ? "Type your message..." : "Connecting..."}
                className="min-h-[44px] pr-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 resize-none"
                disabled={!isConnected}
                maxLength={1000}
              />
              <div className="absolute right-3 bottom-3 text-xs text-slate-400">{newMessage.length}/1000</div>
            </div>
            <Button
              onClick={sendMessage}
              disabled={!isConnected || !newMessage.trim()}
              className="h-11 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all duration-200 transform hover:scale-105 active:scale-95"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          {!isConnected && (
            <p className="text-xs text-red-500 mt-2 flex items-center">
              <WifiOff className="w-3 h-3 mr-1" />
              Connection lost. Trying to reconnect...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
