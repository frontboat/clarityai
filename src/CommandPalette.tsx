import React, { useState, useEffect, useRef } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const CommandPalette: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [messages, setMessages] = useState<Message[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleKeyDown = (event: KeyboardEvent) => {
    // Show/hide with Cmd+J or Ctrl+J
    if ((event.metaKey || event.ctrlKey) && event.key === 'j') {
      event.preventDefault();
      setIsVisible(prev => {
        // If we are about to become visible, clear the input
        if (!prev) {
          setInputValue('');
        }
        return !prev;
      });
    }
    // Hide with Escape
    if (event.key === 'Escape') {
      setIsVisible(false);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (isVisible) {
      inputRef.current?.focus();
    }
  }, [isVisible]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const command = inputValue;
    const userMessage: Message = { role: 'user', content: command };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          message: command,
        }),
      });

      const data = await response.json();
      console.log('Agent response:', data);

      if (response.ok && data.result) {
        const { type, payload } = data.result;

        switch (type) {
          case 'respond':
            const assistantMessage: Message = { role: 'assistant', content: payload.response };
            setMessages(prev => [...prev, assistantMessage]);
            break;
          case 'changeBackgroundColor':
            document.body.style.backgroundColor = payload.color;
            const actionMessage: Message = { role: 'assistant', content: `Ok, I've changed the background to ${payload.color}` };
            setMessages(prev => [...prev, actionMessage]);
            break;
          case 'updateDOM':
            const canvas = document.getElementById('agent-canvas');
            if (canvas) {
              canvas.innerHTML = payload.html;
            }
            const updateMessage: Message = { role: 'assistant', content: "Ok, I've updated the page content." };
            setMessages(prev => [...prev, updateMessage]);
            break;
          default:
            const defaultMessage: Message = { role: 'assistant', content: "I'm not sure how to handle that action." };
            setMessages(prev => [...prev, defaultMessage]);
        }
      } else {
        const errorMessage: Message = { role: 'assistant', content: data.error || "Failed to get response" };
        setMessages(prev => [...prev, errorMessage]);
      }
      
    } catch (error) {
      console.error('Failed to send command:', error);
      const errorMessage: Message = { role: 'assistant', content: "An error occurred while sending the command." };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    // The "Glass Table" overlay
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => setIsVisible(false)} // Click outside to close
    >
      <div 
        className="relative w-[60vw] max-w-4xl"
        onClick={(e) => e.stopPropagation()} // Don't close when clicking inside the content area
      >
        <div className="max-h-[50vh] overflow-y-auto mb-6 space-y-4 text-white text-2xl pr-4">
            {messages.map((msg, index) => (
                <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && <div className="w-8 h-8 rounded-full bg-gray-600 flex-shrink-0" />}
                    <div className={`rounded-lg px-4 py-2 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                        {msg.content}
                    </div>
                     {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-gray-800 flex-shrink-0" />}
                </div>
            ))}
            <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit}>
          {/* This is the invisible input, but the text typed is visible */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            // The "Magic Marker" style - no border, no background, just text
            className="bg-transparent text-white text-4xl text-center font-light placeholder-gray-500 outline-none w-full"
            autoFocus
            disabled={isLoading}
            placeholder={isLoading ? "Processing..." : "Type your command..."}
          />
        </form>
         {/* Helper text only appears if user hasn't typed */}
        {!inputValue && !isLoading && (
             <p className="text-lg text-gray-400 mt-4 text-center">
                Your conversation will appear here.
            </p>
        )}
        <p className="text-sm text-gray-400 mt-4 text-center">
            <strong>Enter</strong> to submit &nbsp;&nbsp;•&nbsp;&nbsp; <strong>Esc</strong> to close
        </p>
      </div>
    </div>
  );
}; 