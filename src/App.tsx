import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GlassBoard } from './components/GlassBoard';
import { StoryboardEditor } from './components/StoryboardEditor';
import { TimelineEditor } from './components/TimelineEditor';
import './index.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

type ViewMode = 'starfield' | 'chat' | 'storyboard' | 'timeline';

function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('starfield');
  const previousViewRef = useRef<ViewMode>('starfield');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Poll for UI commands from the agent
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/ui-commands');
        if (response.ok) {
          const commands = await response.json();
          if (commands && commands.length > 0) {
            const command = commands[0];
            if (command.type === 'transition') {
              const { targetFeature } = command;
              console.log(`Transitioning to ${targetFeature}`);
              if (['chat', 'storyboard', 'timeline'].includes(targetFeature)) {
                setCurrentView(targetFeature);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching UI commands:', error);
      }
    }, 1000); // Poll every second

    return () => clearInterval(interval);
  }, []);

  // Handle Ctrl+Space to toggle chat
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.code === 'Space') {
        event.preventDefault();
        setCurrentView(prevView => {
          if (prevView === 'chat') {
            return previousViewRef.current;
          } else {
            previousViewRef.current = prevView;
            return 'chat';
          }
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'default-session', message }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response || 'I apologize, but I encountered an error.',
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
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

  const handleEditorAction = useCallback((action: string, data: any) => {
    console.log('Editor Action:', action, data);
    // Here you would typically call an agent action
    // e.g., (adaptiveVideoAgent as any).callAction('editTimeline', { operation: action, ...data });
  }, []);

  const handleChatRequest = useCallback(() => {
    setCurrentView('chat');
  }, []);

  const renderCurrentView = () => {
    switch (currentView) {
      case 'starfield':
        return (
          <div className="starfield-container h-screen bg-black relative overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0">
              <div className="stars-bg absolute inset-0" />
            </div>
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
              <div className="text-white/60 text-sm font-light tracking-wider">
                Press <span className="text-white/80 font-medium">Ctrl + Space</span> to begin
              </div>
            </div>
          </div>
        );
      case 'chat':
        return (
          <GlassBoard
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            messages={messages}
          />
        );
      case 'storyboard':
        return <StoryboardEditor onAction={handleEditorAction} onChatRequest={handleChatRequest} />;
      case 'timeline':
        return <TimelineEditor onAction={handleEditorAction} onChatRequest={handleChatRequest} />;
      default:
        return null;
    }
  };

  return (
    <div className="app">
      {renderCurrentView()}
    </div>
  );
}

export default App;
