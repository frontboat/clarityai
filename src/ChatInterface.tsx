import React, { useState, useRef, useEffect } from 'react';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Input } from './components/ui/input';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatInterfaceProps {
  onMessage?: (message: string) => void;
  onModeHint?: (mode: 'chat' | 'timeline' | 'storyboard') => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  onMessage, 
  onModeHint 
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI video editing assistant. I can help you with timeline editing, storyboarding, or just chat about your project. What would you like to work on?',
      timestamp: Date.now(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const detectModeIntent = (message: string): 'chat' | 'timeline' | 'storyboard' | null => {
    const timelineKeywords = [
      'timeline', 'edit', 'cut', 'trim', 'split', 'clips', 'precision', 
      'frame', 'second', 'duration', 'sync', 'audio'
    ];
    const storyboardKeywords = [
      'storyboard', 'scene', 'story', 'flow', 'sequence', 'plan', 
      'narrative', 'shots', 'angle', 'composition'
    ];

    const lowerMessage = message.toLowerCase();
    
    const timelineMatches = timelineKeywords.filter(keyword => 
      lowerMessage.includes(keyword)
    ).length;
    
    const storyboardMatches = storyboardKeywords.filter(keyword => 
      lowerMessage.includes(keyword)
    ).length;

    if (timelineMatches > storyboardMatches && timelineMatches >= 2) {
      return 'timeline';
    } else if (storyboardMatches > timelineMatches && storyboardMatches >= 2) {
      return 'storyboard';
    }

    return null;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Detect potential mode switch intent
    const detectedMode = detectModeIntent(inputValue);
    if (detectedMode && detectedMode !== 'chat' && onModeHint) {
      onModeHint(detectedMode);
    }

    // Send message to the agent system
    if (onMessage) {
      await onMessage(inputValue.trim());
    }

    setInputValue('');
    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const suggestModeSwitch = (mode: 'timeline' | 'storyboard') => {
    if (onModeHint) {
      onModeHint(mode);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="bg-gray-100 px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">AI Assistant</h2>
          <div className="flex space-x-2">
            <Button
              onClick={() => suggestModeSwitch('timeline')}
              variant="outline"
              size="sm"
            >
              Switch to Timeline
            </Button>
            <Button
              onClick={() => suggestModeSwitch('storyboard')}
              variant="outline"
              size="sm"
            >
              Switch to Storyboard
            </Button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <Card key={message.id} className="max-w-[80%] mx-0">
            <div
              className={`p-4 ${
                message.role === 'user'
                  ? 'bg-blue-50 ml-auto'
                  : 'bg-gray-50'
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold ${
                  message.role === 'user' ? 'bg-blue-500' : 'bg-gray-500'
                }`}>
                  {message.role === 'user' ? 'U' : 'AI'}
                </div>
                
                <div className="flex-1">
                  <div className="text-sm text-gray-900 whitespace-pre-wrap">
                    {message.content}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}

        {isLoading && (
          <Card className="max-w-[80%]">
            <div className="p-4 bg-gray-50">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white text-sm font-semibold">
                  AI
                </div>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t bg-white p-4">
        <div className="flex space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your project, request timeline edits, or plan your story..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={!inputValue.trim() || isLoading}
          >
            Send
          </Button>
        </div>
        
        {/* Quick Action Suggestions */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInputValue("Help me plan the story flow for my video")}
          >
            Plan Story Flow
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInputValue("I need to make precise timeline edits")}
          >
            Timeline Editing
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInputValue("Show me how to organize my scenes")}
          >
            Organize Scenes
          </Button>
        </div>
      </div>
    </div>
  );
};