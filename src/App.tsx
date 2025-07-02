import React, { useState, useEffect, useRef } from 'react';
import { GlassBoard } from './components/GlassBoard';
import { AdaptiveVideoEditor } from './components/AdaptiveVideoEditor';
import './index.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

function App() {
  const [currentView, setCurrentView] = useState<'starfield' | 'glassboard' | 'editor'>('starfield');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Handle Ctrl+Space to open glass board
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.code === 'Space') {
        event.preventDefault();
        if (currentView === 'starfield') {
          setCurrentView('glassboard');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView]);

  // Handle chat message submission
  const handleSendMessage = async (message: string) => {
    if (isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Transition to editor after first interaction
    if (!hasInteracted) {
      setTimeout(() => {
        setCurrentView('editor');
        setHasInteracted(true);
      }, 1500);
    }

    try {
      // Send message to chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: 'default-session',
          message,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response || 'I apologize, but I encountered an error processing your request.',
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Also send to intent analysis if we're in the editor
      if (currentView === 'editor' || hasInteracted) {
        try {
          await fetch('/api/agent/analyze-intent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userMessage: message,
              currentMode: 'chat',
            }),
          });
        } catch (intentError) {
          console.error('Intent analysis failed:', intentError);
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      {currentView === 'starfield' && (
        <div className="starfield-container h-screen bg-black relative overflow-hidden flex items-center justify-center">
          {/* Starfield animation */}
          <div className="absolute inset-0">
            <div className="stars-bg absolute inset-0" />
          </div>
          
          {/* Ctrl+Space instruction */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
            <div className="text-white/60 text-sm font-light tracking-wider">
              Press <span className="text-white/80 font-medium">Ctrl + Space</span> to begin
            </div>
          </div>
        </div>
      )}

      {currentView === 'glassboard' && (
        <GlassBoard
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          messages={messages}
        />
      )}

      {currentView === 'editor' && (
        <AdaptiveVideoEditor
          onSendMessage={handleSendMessage}
          messages={messages}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

export default App;
