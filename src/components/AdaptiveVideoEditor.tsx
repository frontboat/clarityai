import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatInterface } from '../ChatInterface';
import { TimelineEditor } from './TimelineEditor';
import { StoryboardEditor } from './StoryboardEditor';
import { useAgent } from '../hooks/useAgent';
import { motion, AnimatePresence } from 'framer-motion';

type EditingMode = 'chat' | 'timeline' | 'storyboard';

interface UIState {
  currentMode: EditingMode;
  predictedNext: EditingMode | null;
  confidence: number;
  transitionState: 'stable' | 'transitioning' | 'predicting';
  sidebarOpen: boolean;
  timelineHeight: number;
  storyboardVisible: boolean;
  chatExpanded: boolean;
}

const TRANSITION_ANIMATIONS = {
  chat: { scale: 1, opacity: 1, y: 0 },
  timeline: { scale: 1, opacity: 1, y: 0 },
  storyboard: { scale: 1, opacity: 1, y: 0 },
  exit: { scale: 0.95, opacity: 0, y: 20 },
  enter: { scale: 0.95, opacity: 0, y: -20 },
};

export const AdaptiveVideoEditor: React.FC = () => {
  const { agent, sendMessage, callAction, isConnected } = useAgent();
  const [uiState, setUIState] = useState<UIState>({
    currentMode: 'chat',
    predictedNext: null,
    confidence: 0,
    transitionState: 'stable',
    sidebarOpen: true,
    timelineHeight: 200,
    storyboardVisible: false,
    chatExpanded: true,
  });

  const [userActivity, setUserActivity] = useState({
    lastInteraction: Date.now(),
    currentFeatureStartTime: Date.now(),
    interactionCount: 0,
  });

  const modeStartTimeRef = useRef(Date.now());
  const activityTimeoutRef = useRef<NodeJS.Timeout>();

  // Track user behavior and predict next feature
  const trackActivity = useCallback(async (action: string, feature: string) => {
    const duration = Date.now() - modeStartTimeRef.current;
    
    setUserActivity(prev => ({
      ...prev,
      lastInteraction: Date.now(),
      interactionCount: prev.interactionCount + 1,
    }));

    // Send behavior data to agent
    if (callAction) {
      await callAction('learnUserBehavior', {
        action,
        feature,
        duration,
        context: { 
          timeOfDay: new Date().getHours(),
          sessionLength: Date.now() - userActivity.currentFeatureStartTime,
        },
      });

      // Get prediction for next feature
      const prediction = await callAction('predictNextFeature', {
        currentContext: { currentMode: uiState.currentMode },
        timeSpentInCurrentFeature: duration,
      });

      if (prediction.confidence > 0.7) {
        setUIState(prev => ({
          ...prev,
          predictedNext: prediction.predictedFeature,
          confidence: prediction.confidence,
          transitionState: 'predicting',
        }));
      }
    }
  }, [callAction, uiState.currentMode, userActivity.currentFeatureStartTime]);

  // Seamless transition to predicted feature
  const transitionToMode = useCallback(async (mode: EditingMode, reason: string = 'user action') => {
    if (mode === uiState.currentMode) return;

    setUIState(prev => ({ ...prev, transitionState: 'transitioning' }));

    // Send transition command to agent
    if (callAction) {
      await callAction('transitionToFeature', {
        targetFeature: mode,
        reason,
        confidence: uiState.confidence,
      });
    }

    // Track the transition
    await trackActivity('transition', mode);

    // Update UI state
    setTimeout(() => {
      setUIState(prev => ({
        ...prev,
        currentMode: mode,
        transitionState: 'stable',
        predictedNext: null,
        confidence: 0,
      }));
      modeStartTimeRef.current = Date.now();
    }, 300);
  }, [agent, uiState.currentMode, uiState.confidence, trackActivity]);

  // Auto-transition based on predictions
  useEffect(() => {
    if (uiState.predictedNext && uiState.confidence > 0.8 && uiState.transitionState === 'predicting') {
      const timeInCurrentMode = Date.now() - modeStartTimeRef.current;
      
      // Only auto-transition if user has been in current mode for a reasonable time
      if (timeInCurrentMode > 10000) { // 10 seconds
        transitionToMode(uiState.predictedNext, 'predicted user need');
      }
    }
  }, [uiState.predictedNext, uiState.confidence, uiState.transitionState, transitionToMode]);

  // Clear prediction timeout
  useEffect(() => {
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    activityTimeoutRef.current = setTimeout(() => {
      setUIState(prev => ({
        ...prev,
        predictedNext: null,
        confidence: 0,
        transitionState: 'stable',
      }));
    }, 30000); // Clear prediction after 30 seconds of inactivity

    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, [userActivity.lastInteraction]);

  // Handle mode-specific interactions
  const handleChatMessage = useCallback(async (message: string) => {
    await trackActivity('chat_message', 'chat');
    
    // Analyze message for potential mode switches
    const timelineKeywords = ['timeline', 'edit', 'cut', 'trim', 'split', 'clips'];
    const storyboardKeywords = ['storyboard', 'scene', 'story', 'flow', 'sequence', 'plan'];
    
    const hasTimelineIntent = timelineKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
    const hasStoryboardIntent = storyboardKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );

    if (hasTimelineIntent && uiState.currentMode !== 'timeline') {
      await transitionToMode('timeline', 'detected timeline intent in chat');
    } else if (hasStoryboardIntent && uiState.currentMode !== 'storyboard') {
      await transitionToMode('storyboard', 'detected storyboard intent in chat');
    }

    if (sendMessage) {
      sendMessage(message);
    }
  }, [trackActivity, uiState.currentMode, transitionToMode, sendMessage]);

  const handleTimelineAction = useCallback(async (action: string, data: any) => {
    await trackActivity(`timeline_${action}`, 'timeline');
    
    // Send to agent for processing
    if (callAction) {
      await callAction('editTimeline', {
        operation: action,
        ...data,
      });
    }
  }, [callAction, trackActivity]);

  const handleStoryboardAction = useCallback(async (action: string, data: any) => {
    await trackActivity(`storyboard_${action}`, 'storyboard');
    
    // Send to agent for processing
    if (agent) {
      await agent.callAction('editStoryboard', {
        operation: action,
        ...data,
      });
    }
  }, [agent, trackActivity]);

  // Render prediction indicator
  const renderPredictionIndicator = () => {
    if (!uiState.predictedNext || uiState.confidence < 0.5) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50"
      >
        <div className="text-sm">
          Ready to switch to {uiState.predictedNext}?
          <div className="w-full bg-blue-300 rounded-full h-1 mt-1">
            <div 
              className="bg-white h-1 rounded-full transition-all duration-1000"
              style={{ width: `${uiState.confidence * 100}%` }}
            />
          </div>
        </div>
        <button
          onClick={() => transitionToMode(uiState.predictedNext!, 'user accepted prediction')}
          className="mt-2 bg-white text-blue-500 px-2 py-1 rounded text-xs"
        >
          Switch Now
        </button>
      </motion.div>
    );
  };

  // Mode-specific navigation hints
  const renderModeHints = () => {
    const hints = {
      chat: "💬 Ask me about your project or request timeline/storyboard edits",
      timeline: "⏱️ Precision editing mode - adjust clips, timing, and effects",
      storyboard: "🎬 Story planning mode - organize scenes and narrative flow",
    };

    return (
      <div className="bg-gray-100 px-4 py-2 text-sm text-gray-600 border-b">
        {hints[uiState.currentMode]}
        {uiState.predictedNext && (
          <span className="ml-4 text-blue-600">
            • AI suggests: {uiState.predictedNext} ({Math.round(uiState.confidence * 100)}% confidence)
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Connection Status */}
      {!isConnected && (
        <div className="bg-red-500 text-white text-center py-2">
          Connecting to AI assistant...
        </div>
      )}

      {/* Mode Hints */}
      {renderModeHints()}

      {/* Prediction Indicator */}
      <AnimatePresence>
        {renderPredictionIndicator()}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* Sidebar with quick mode switcher */}
        <AnimatePresence>
          {uiState.sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 200, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-white border-r border-gray-200 p-4"
            >
              <h3 className="font-semibold mb-4">Quick Switch</h3>
              <div className="space-y-2">
                {(['chat', 'timeline', 'storyboard'] as EditingMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => transitionToMode(mode, 'manual switch')}
                    className={`w-full text-left px-3 py-2 rounded transition-colors ${
                      uiState.currentMode === mode
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <span className="capitalize">{mode}</span>
                    {uiState.predictedNext === mode && (
                      <span className="ml-2 text-xs bg-blue-500 text-white px-1 rounded">
                        predicted
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Content Area */}
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={uiState.currentMode}
              initial={TRANSITION_ANIMATIONS.enter}
              animate={TRANSITION_ANIMATIONS[uiState.currentMode]}
              exit={TRANSITION_ANIMATIONS.exit}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              {uiState.currentMode === 'chat' && (
                <ChatInterface 
                  onMessage={handleChatMessage}
                  onModeHint={(mode) => {
                    if (mode !== uiState.currentMode) {
                      setUIState(prev => ({ ...prev, predictedNext: mode, confidence: 0.6 }));
                    }
                  }}
                />
              )}
              
              {uiState.currentMode === 'timeline' && (
                <TimelineEditor 
                  onAction={handleTimelineAction}
                  onChatRequest={() => transitionToMode('chat', 'user requested chat')}
                />
              )}
              
              {uiState.currentMode === 'storyboard' && (
                <StoryboardEditor 
                  onAction={handleStoryboardAction}
                  onChatRequest={() => transitionToMode('chat', 'user requested chat')}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center text-sm">
        <span>Mode: {uiState.currentMode} | Activity: {userActivity.interactionCount} actions</span>
        <span>
          {uiState.transitionState === 'transitioning' && '🔄 Transitioning...'}
          {uiState.transitionState === 'predicting' && '🤖 AI Learning...'}
          {uiState.transitionState === 'stable' && '✅ Ready'}
        </span>
      </div>
    </div>
  );
}; 