import { ChatInterface } from "./ChatInterface";
import { GlassBoard } from "./components/GlassBoard";
import { useGlobalHotkey } from "./hooks/useGlobalHotkey";
import "./index.css";
import { useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function App() {
  const [isGlassBoardOpen, setIsGlassBoardOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);

  useGlobalHotkey({
    key: ' ',
    ctrlKey: true,
    onTrigger: () => setIsGlassBoardOpen(true),
  });

  const handleSendMessage = async (messageContent: string) => {
    const userMessage: Message = {
      role: "user",
      content: messageContent,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          message: messageContent,
        }),
      });

      const data = await response.json();

      if (response.ok && data.response) {
        const assistantMessage: Message = {
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(data.error || "Failed to get response");
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="starfield-container">
        <div className="starfield"></div>
        <div className="fixed inset-0 flex items-center justify-center z-10">
          <p className="text-white/80 text-lg font-light">
            Press <kbd className="px-3 py-2 bg-white/10 rounded-lg text-sm border border-white/20">Ctrl + Space</kbd> to begin
          </p>
        </div>
        
      </div>

      <GlassBoard
        isOpen={isGlassBoardOpen}
        onClose={() => setIsGlassBoardOpen(false)}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        messages={messages}
      />
    </>
  );
}

export default App;
