import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TimelineEditor } from './TimelineEditor';
import { StoryboardEditor } from './StoryboardEditor';

type EditingMode = 'chat' | 'timeline' | 'storyboard';

interface UIState {
  mode: EditingMode;
  prediction?: {
    nextMode: string;
    confidence: number;
    reasoning: string;
  };
  isTransitioning: boolean;
  showPrediction: boolean;
  learningData: {
    timeInMode: number;
    totalTransitions: number;
    behaviorPatterns: any[];
  };
}

interface AdaptiveVideoEditorProps {
  onSendMessage: (message: string) => void;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  isLoading: boolean;
}

const TRANSITION_ANIMATIONS = {
  chat: { scale: 1, opacity: 1, y: 0 },
  timeline: { scale: 1, opacity: 1, y: 0 },
  storyboard: { scale: 1, opacity: 1, y: 0 },
  exit: { scale: 0.95, opacity: 0, y: 20 },
  enter: { scale: 0.95, opacity: 0, y: -20 },
};

export function AdaptiveVideoEditor({ onSendMessage, messages, isLoading }: AdaptiveVideoEditorProps) {
  const [uiState, setUIState] = useState<UIState>({
    mode: 'chat',
    isTransitioning: false,
    showPrediction: false,
    learningData: {
      timeInMode: 0,
      totalTransitions: 0,
      behaviorPatterns: [],
    },
  });

  const [modeStartTime, setModeStartTime] = useState(Date.now());
  const pollTimeoutRef = useRef<NodeJS.Timeout>();

  // Poll for UI commands from the server
  useEffect(() => {
    const pollUICommands = async () => {
      try {
        const response = await fetch('/api/ui-commands');
        if (response.ok) {
          const commands = await response.json();
          
          commands.forEach((command: any) => {
            if (command.type === 'transition') {
              console.log(`🔄 Received transition command: ${command.targetFeature}`, command);
              handleModeTransition(command.targetFeature, command.reason, command.confidence);
            }
          });
        }
      } catch (error) {
        console.error('Error polling UI commands:', error);
      }
      
      // Schedule next poll
      pollTimeoutRef.current = setTimeout(pollUICommands, 1000);
    };

    pollUICommands();
    
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  // Handle mode transitions
  const handleModeTransition = async (newMode: 'chat' | 'timeline' | 'storyboard', reason?: string, confidence?: number) => {
    if (newMode === uiState.mode) return;

    const timeInCurrentMode = Date.now() - modeStartTime;
    
    // Learn from current behavior
    try {
      await fetch('/api/agent/learn-behavior', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mode-usage',
          feature: uiState.mode,
          duration: timeInCurrentMode,
          context: {
            timeOfDay: new Date().getHours(),
            previousMode: uiState.mode,
          }
        }),
      });
    } catch (error) {
      console.error('Error learning behavior:', error);
    }

    setUIState(prev => ({
      ...prev,
      mode: newMode,
      isTransitioning: true,
      prediction: reason ? {
        nextMode: newMode,
        confidence: confidence || 0.8,
        reasoning: reason,
      } : undefined,
      learningData: {
        ...prev.learningData,
        totalTransitions: prev.learningData.totalTransitions + 1,
        timeInMode: timeInCurrentMode,
      },
    }));

    setModeStartTime(Date.now());

    // Clear transition state after animation
    setTimeout(() => {
      setUIState(prev => ({ ...prev, isTransitioning: false }));
    }, 500);
  };

  // Predict next feature based on usage patterns
  const predictNextFeature = async () => {
    try {
      const response = await fetch('/api/agent/predict-feature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentContext: {
            currentMode: uiState.mode,
            timeInMode: Date.now() - modeStartTime,
            recentActions: [], // Could track user actions here
          },
          timeSpentInCurrentFeature: Date.now() - modeStartTime,
        }),
      });

      if (response.ok) {
        const prediction = await response.json();
        
        if (prediction.shouldSuggest && prediction.confidence > 0.6) {
          setUIState(prev => ({
            ...prev,
            prediction: {
              nextMode: prediction.predictedFeature,
              confidence: prediction.confidence,
              reasoning: prediction.reasoning,
            },
            showPrediction: true,
          }));

          // Auto-hide prediction after 5 seconds
          setTimeout(() => {
            setUIState(prev => ({ ...prev, showPrediction: false }));
          }, 5000);
        }
      }
    } catch (error) {
      console.error('Error predicting feature:', error);
    }
  };

  // Predict next feature periodically
  useEffect(() => {
    const interval = setInterval(predictNextFeature, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [uiState.mode, modeStartTime]);

  return (
    <div className="adaptive-video-editor h-screen bg-black relative overflow-hidden">
      {/* Subtle background starfield */}
      <div className="absolute inset-0 opacity-10">
        <div className="stars-bg absolute inset-0" />
      </div>

      {/* Prediction indicator */}
      <AnimatePresence>
        {uiState.showPrediction && uiState.prediction && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 right-4 bg-white/10 backdrop-blur-md rounded-lg p-3 border border-white/20 z-50"
          >
            <div className="text-white/90 text-sm">
              <div className="font-medium">Suggestion: Switch to {uiState.prediction.nextMode}</div>
              <div className="text-white/70 text-xs mt-1">
                {Math.round(uiState.prediction.confidence * 100)}% confidence
              </div>
              <button
                onClick={() => handleModeTransition(uiState.prediction!.nextMode as any)}
                className="mt-2 text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
              >
                Switch Now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode transition indicator */}
      <AnimatePresence>
        {uiState.isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center"
          >
            <div className="text-white text-xl font-light">
              Switching to {uiState.mode} mode...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={uiState.mode}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="h-full"
        >
          {uiState.mode === 'chat' && (
            <div className="h-full p-8 flex flex-col items-center justify-center">
              <div className="glass-effect rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                <h2 className="text-2xl font-light text-white mb-6 text-center">
                  AI Video Assistant
                </h2>
                
                {/* Messages area */}
                <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-white/10 ml-auto max-w-[80%]'
                          : 'bg-blue-500/20 mr-auto max-w-[80%]'
                      }`}
                    >
                      <div className="text-white/90 text-sm">
                        {message.content}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="bg-blue-500/20 mr-auto max-w-[80%] p-3 rounded-lg">
                      <div className="text-white/90 text-sm">Thinking...</div>
                    </div>
                  )}
                </div>

                {/* Input area */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Describe what you want to edit..."
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        onSendMessage(e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const input = document.querySelector('input') as HTMLInputElement;
                      if (input?.value.trim()) {
                        onSendMessage(input.value);
                        input.value = '';
                      }
                    }}
                    className="bg-blue-500/30 hover:bg-blue-500/50 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {uiState.mode === 'timeline' && <TimelineEditor />}
          {uiState.mode === 'storyboard' && <StoryboardEditor />}
        </motion.div>
      </AnimatePresence>

      {/* Bottom status bar */}
      <div className="absolute bottom-4 left-4 bg-white/10 backdrop-blur-md rounded-lg px-4 py-2 border border-white/20">
        <div className="text-white/70 text-xs">
          Mode: {uiState.mode} | Transitions: {uiState.learningData.totalTransitions} | 
          Time: {Math.round((Date.now() - modeStartTime) / 1000)}s
        </div>
      </div>
    </div>
  );
} 