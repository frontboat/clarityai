import { useState, useRef, useEffect, type FormEvent } from 'react';
import { X, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface GlassBoardProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  messages: Message[];
}

export function GlassBoard({ isOpen, onClose, onSendMessage, isLoading = false, messages }: GlassBoardProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      // Focus the textarea when the glass board opens
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Auto-scroll to bottom when messages change and maintain focus
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // Maintain focus on textarea after message updates
    if (isOpen && textareaRef.current && document.activeElement !== textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [messages, isOpen]);

  useEffect(() => {
    // Handle escape key to close
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      
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
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors duration-200"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>

          {/* Main content - Glass writing surface */}
          <div className="relative p-8 h-[70vh] flex flex-col">
            {/* Organic thought display area */}
            <div className="flex-1 overflow-hidden relative">
              {messages.length > 0 && (
                <div className="absolute inset-0 overflow-y-auto pr-4 space-y-6">
                  {messages.map((msg, index) => (
                    <div
                      key={index}
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