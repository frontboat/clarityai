import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface GlassBoardProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  messages: Message[];
}

export function GlassBoard({ onSendMessage, isLoading = false, messages }: GlassBoardProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus the textarea when the component mounts
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  }, []);

  // Auto-scroll to bottom when messages change and maintain focus
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // Maintain focus on textarea after message updates
    if (textareaRef.current && document.activeElement !== textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim());
      setMessage('');
      // Immediately refocus and ensure cursor stays active
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(0, 0);
        }
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Starfield background with blur overlay */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm">
        {/* Maintain the subtle starfield in background */}
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '240s' }}>
          {[...Array(30)].map((_, i) => {
            const angle = (i / 30) * 360;
            const radius = 10 + (i % 20) * 25;
            const size = Math.random() * 1 + 0.3;
            const opacity = Math.random() * 0.3 + 0.1;
            
            return (
              <div
                key={i}
                className="absolute bg-white rounded-full animate-pulse"
                style={{
                  left: `calc(50% + ${Math.cos(angle * Math.PI / 180) * radius}px)`,
                  top: `calc(50% + ${Math.sin(angle * Math.PI / 180) * radius}px)`,
                  width: `${size}px`,
                  height: `${size}px`,
                  opacity: opacity,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${Math.random() * 4 + 3}s`,
                }}
              />
            );
          })}
        </div>
      </div>
      
      {/* Glass board container */}
      <div className="relative w-full max-w-4xl mx-8 p-8">
        {/* Glass board */}
        <div className={cn(
          "relative bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10",
          "shadow-xl shadow-black/5",
          "transform transition-all duration-300 ease-out",
          "animate-in fade-in-0 zoom-in-95 duration-300",
          "pulse-border"
        )}>

          {/* Main content - Glass writing surface */}
          <div className="relative p-8 h-[70vh] flex flex-col">
            {/* Organic thought display area */}
            <div className="flex-1 overflow-hidden relative">
              {messages.length > 0 && (
                <div className="absolute inset-0 overflow-y-auto pr-4 space-y-6">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "relative",
                        msg.role === "user" ? "text-right" : "text-left"
                      )}
                    >
                      <div
                        className={cn(
                          "inline-block max-w-[85%] text-white/90",
                          msg.role === "user"
                            ? "text-white/95 text-lg font-light"
                            : "text-white/85 text-base leading-relaxed"
                        )}
                        style={{ fontFamily: "'Kalam', cursive" }}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="text-left">
                      <div className="inline-block">
                        <div className="flex space-x-1">
                          <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" />
                          <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce delay-100" />
                          <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce delay-200" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Glass writing surface */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder=""
                rows={3}
                className={cn(
                  "w-full p-0 resize-none border-none bg-transparent",
                  "text-white/95 text-lg font-light leading-relaxed",
                  "focus:outline-none placeholder-transparent",
                  "transition-all duration-200"
                )}
                style={{ 
                  fontFamily: "'Kalam', cursive",
                  background: 'transparent',
                  border: 'none',
                  outline: 'none'
                }}
                disabled={isLoading}
              />
              
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}