import React, { useState, useEffect } from 'react';
import { AdaptiveVideoEditor } from './components/AdaptiveVideoEditor';
import { GlassBoard } from './components/GlassBoard';
import './index.css';

function App() {
  const [showGlassBoard, setShowGlassBoard] = useState(false);
  const [hasEnteredApp, setHasEnteredApp] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        if (!hasEnteredApp) {
          setShowGlassBoard(true);
        } else {
          setShowGlassBoard(!showGlassBoard);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showGlassBoard, hasEnteredApp]);

  const handleSendMessage = async (message: string) => {
    setIsLoading(true);
    
    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: message,
      timestamp: new Date(),
    }]);

    try {
      // Send to chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: `glass-board-${Date.now()}`,
          message,
        }),
      });

      const data = await response.json();
      
      if (data.response) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        }]);
      } else {
        throw new Error('No response from agent');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseGlassBoard = () => {
    setShowGlassBoard(false);
    if (!hasEnteredApp) {
      setHasEnteredApp(true);
    }
  };

  // Initial state: black background with floating stars
  if (!hasEnteredApp && !showGlassBoard) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center relative overflow-hidden">
        {/* Floating stars effect */}
        <div className="absolute inset-0">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-white rounded-full opacity-70 animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${Math.random() * 3 + 1}px`,
                height: `${Math.random() * 3 + 1}px`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${Math.random() * 3 + 2}s`,
              }}
            />
          ))}
        </div>
        
        {/* Center content */}
        <div className="text-center z-10">
          <h1 className="text-4xl font-light text-white/90 mb-4">ClarityAI</h1>
          <p className="text-white/60 text-lg mb-8">Adaptive Video Editing Assistant</p>
          <div className="text-white/40 text-sm">
            Press <kbd className="px-2 py-1 bg-white/10 rounded">Ctrl</kbd> + <kbd className="px-2 py-1 bg-white/10 rounded">Space</kbd> to begin
          </div>
        </div>

        <GlassBoard
          isOpen={showGlassBoard}
          onClose={handleCloseGlassBoard}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          messages={messages}
        />
      </div>
    );
  }

  // After entering app: show adaptive video editor with optional glass board overlay
  return (
    <div className="App">
      <AdaptiveVideoEditor />
      
      <GlassBoard
        isOpen={showGlassBoard}
        onClose={handleCloseGlassBoard}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        messages={messages}
      />
    </div>
  );
}

export default App;
