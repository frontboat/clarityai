import { createDreams, context, input, output, action, extension, validateEnv } from "@daydreamsai/core";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";

// Validate environment variables
const env = validateEnv(
  z.object({
    OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required"),
  })
);

// Configuration that will be set from server
let agentConfig = {
  apiKey: env.OPENROUTER_API_KEY,
  model: 'anthropic/claude-3.7-sonnet',
};

// Function to initialize agent configuration (called from server)
export function setAgentConfig(config: typeof agentConfig) {
  agentConfig = config;
}

// Define schemas as raw shapes to avoid type instantiation issues
const chatContextShape = z.object({
  sessionId: z.string().describe("Unique session identifier for the chat"),
});

// Define memory interface for type safety
interface ChatMemory {
  sessionId: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: number;
  }>;
  lastResponse?: string;
}

// Store for API responses
const responseStore = new Map<string, string>();

// Create chat context with proper memory typing
const chatContext = context<ChatMemory>({
  type: "chat",
  schema: chatContextShape,
  
  instructions: "You are a helpful AI assistant called ClarityAI. Provide clear, concise, and accurate responses to user queries. Keep your responses friendly and informative.",
  
  create: ({ args }) => ({
    sessionId: args.sessionId,
    messages: [],
    lastResponse: undefined,
  }),
  
  // Render function to show context state to the LLM
  render: ({ memory }) => {
    const recentMessages = memory.messages.slice(-10);
    return `
Chat Session: ${memory.sessionId}
Recent messages (${memory.messages.length} total):
${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}
    `.trim();
  },

  inputs: {
    "user:message": {
      schema: z.string(),
      handler: async (message, ctx: any) => {
        if (ctx.memory) {
          ctx.memory.messages.push({
            role: "user",
            content: message,
            timestamp: Date.now(),
          });
        }
        return { data: { message } };
      },
    },
  },
});

// Create an action to handle responses
const respondAction = action<any, any, ChatMemory>({
  name: "respond",
  description: "Respond to the user's message",
  schema: z.object({
    response: z.string().describe("The response to send to the user"),
    sessionId: z.string().describe("Session ID for the response"),
  }),
  handler: async ({ response, sessionId }, ctx) => {
    // Store the response for retrieval
    responseStore.set(sessionId, response);
    
    // Update context memory
    if (ctx.memory) {
      ctx.memory.lastResponse = response;
      ctx.memory.messages.push({
        role: "assistant",
        content: response,
        timestamp: Date.now(),
      });
    }
    
    return { success: true, response };
  },
});

// Create the agent
const agent = createDreams({
  model: openrouter(agentConfig.model),
  contexts: [chatContext],
  actions: [respondAction],
});

// Initialize the agents
let agentStarted = false;
export async function initializeAgent() {
  if (!agentStarted) {
    // Start both agents
    await agent.start();
    await adaptiveVideoAgent.start();
    agentStarted = true;
    console.log(`ClarityAI agent initialized with Daydreams and OpenRouter (model: ${agentConfig.model})`);
  }
}

// Handle chat messages using Daydreams with intent detection
export async function handleChatMessage(sessionId: string, message: string): Promise<string> {
  try {
    // First, analyze intent for potential mode transitions
    try {
      await adaptiveVideoAgent.callAction('analyzeIntentAndSuggestTransition', {
        userMessage: message,
        currentMode: currentUIState.mode,
      });
    } catch (intentError) {
      console.log('Intent analysis skipped:', intentError.message);
    }
    
    // Then handle the regular chat response
    const result = await agent.send({
      context: chatContext,
      args: { sessionId },
      input: {
        type: "user:message",
        data: message,
      },
    });
    
    // Extract response from the agent result
    const response = extractResponse(result);
    
    if (response && response.trim()) {
      return response;
    }
    
    // Fallback if no response was generated
    return "I'm sorry, I couldn't process your message. Please try again.";
  } catch (error) {
    console.error("Error handling chat message:", error);
    return "An error occurred while processing your message. Please check your OpenRouter configuration.";
  }
}

// Helper function to extract response from agent result
function extractResponse(result: any): string {
  if (typeof result === "string") {
    return result;
  }
  
  if (Array.isArray(result)) {
    // Look for action_result entries with response data
    for (const entry of result) {
      if (entry?.ref === "action_result" && entry?.data?.response) {
        return entry.data.response;
      }
      if (entry?.ref === "action_call" && entry?.data?.response) {
        return entry.data.response;
      }
    }
    
    // Fallback: look for any entry with response content
    for (const entry of result) {
      if (entry?.content && typeof entry.content === "string") {
        return entry.content;
      }
      if (entry?.data?.content && typeof entry.data.content === "string") {
        return entry.data.content;
      }
    }
  }
  
  if (result && typeof result === "object") {
    if (result.response) {
      return result.response;
    }
    if (result.content) {
      return result.content;
    }
    if (result.data?.response) {
      return result.data.response;
    }
  }
  
  return "";
}

// User preference learning context
const userProfileContext = context({
  type: "user-profile",
  schema: z.object({ userId: z.string() }),
  
  create: () => ({
    preferences: {
      primaryWorkflow: "balanced", // timeline, storyboard, balanced
      timelineUsagePercent: 33,
      storyboardUsagePercent: 33,
      chatUsagePercent: 34,
      lastActiveFeature: "chat",
      sessionCount: 0,
      averageSessionLength: 0,
    },
    behaviorPatterns: {
      timeOfDayPreferences: {},
      featureTransitionPatterns: [],
      taskCompletionRates: {},
      preferredEditingFlow: [],
    },
    currentSession: {
      startTime: Date.now(),
      currentFeature: "chat",
      featureUsageTimes: {},
      transitionHistory: [],
    },
  }),

  render: (state) => `
User Profile: ${state.args.userId}
Primary Workflow: ${state.memory.preferences.primaryWorkflow}
Current Feature: ${state.memory.currentSession.currentFeature}
Session Progress: ${state.memory.currentSession.transitionHistory.length} transitions

Usage Patterns:
- Timeline: ${state.memory.preferences.timelineUsagePercent}%
- Storyboard: ${state.memory.preferences.storyboardUsagePercent}%
- Chat: ${state.memory.preferences.chatUsagePercent}%

Recent Behavior:
${state.memory.behaviorPatterns.featureTransitionPatterns.slice(-3).map(p => 
  `${p.from} → ${p.to} (${p.confidence}% match)`
).join('\n')}
  `,
});

// Video editing session context
const editingSessionContext = context({
  type: "editing-session",
  schema: z.object({ 
    sessionId: z.string(),
    userId: z.string() 
  }),
  
  create: () => ({
    projectData: {
      timeline: { clips: [], duration: 0, markers: [] },
      storyboard: { scenes: [], connections: [], notes: [] },
      metadata: { title: "", description: "", tags: [] },
    },
    editingState: {
      currentTool: "none",
      selectedClips: [],
      playheadPosition: 0,
      zoomLevel: 1,
      activeLayer: 0,
    },
    undoHistory: [],
    redoHistory: [],
  }),

  render: (state) => `
Editing Session: ${state.args.sessionId}
Project: ${state.memory.projectData.metadata.title || 'Untitled'}

Timeline: ${state.memory.projectData.timeline.clips.length} clips
Storyboard: ${state.memory.projectData.storyboard.scenes.length} scenes
Current Tool: ${state.memory.editingState.currentTool}
Playhead: ${state.memory.editingState.playheadPosition}s
  `,
});

// Interface state context
const interfaceContext = context({
  type: "interface",
  schema: z.object({ userId: z.string() }),
  
  create: () => ({
    currentView: "chat",
    transitionState: "stable", // stable, transitioning, predicting
    predictedNextFeature: null,
    confidence: 0,
    uiState: {
      sidebarOpen: true,
      timelineHeight: 200,
      storyboardVisible: false,
      chatExpanded: true,
    },
    recentActions: [],
  }),

  render: (state) => `
Interface State:
Current View: ${state.memory.currentView}
Transition: ${state.memory.transitionState}
Predicted Next: ${state.memory.predictedNextFeature} (${state.memory.confidence}% confidence)

UI Configuration:
- Sidebar: ${state.memory.uiState.sidebarOpen ? 'open' : 'closed'}
- Timeline Height: ${state.memory.uiState.timelineHeight}px
- Storyboard: ${state.memory.uiState.storyboardVisible ? 'visible' : 'hidden'}
- Chat: ${state.memory.uiState.chatExpanded ? 'expanded' : 'collapsed'}
  `,
});

// UI State management for cross-component communication
let currentUIState = {
  mode: 'chat' as 'chat' | 'timeline' | 'storyboard',
  prediction: null as string | null,
  confidence: 0,
  lastTransition: Date.now(),
};

// Store for UI commands that need to be sent to frontend
const uiCommandStore = new Map<string, any>();

export const adaptiveVideoAgent = createDreams({
  model: openrouter(agentConfig.model),
  contexts: [userProfileContext, editingSessionContext, interfaceContext],
  
  // Custom actions for interface control and learning
  actions: [
    // Interface transition actions
    action({
      name: "transitionToFeature",
      description: "Seamlessly transition the UI to a different editing feature based on user intent or prediction",
      schema: z.object({
        targetFeature: z.enum(["chat", "timeline", "storyboard"]),
        reason: z.string().describe("Why this transition is being suggested"),
        confidence: z.number().min(0).max(1).optional().describe("Confidence level of this transition recommendation"),
      }),
      handler: async ({ targetFeature, reason, confidence = 0.8 }, ctx) => {
        console.log(`🔄 Agent suggesting transition to ${targetFeature}: ${reason} (${Math.round(confidence * 100)}% confidence)`);
        
        // Update internal UI state
        currentUIState.mode = targetFeature;
        currentUIState.prediction = targetFeature;
        currentUIState.confidence = confidence;
        currentUIState.lastTransition = Date.now();
        
        // Store UI command for frontend to pick up
        const commandId = `transition-${Date.now()}`;
        uiCommandStore.set(commandId, {
          type: 'transition',
          targetFeature,
          reason,
          confidence,
          timestamp: Date.now(),
        });
        
        // Update interface context memory
        if (ctx.memory) {
          ctx.memory.currentView = targetFeature;
          ctx.memory.transitionState = 'transitioning';
          ctx.memory.predictedNextFeature = null;
          ctx.memory.confidence = confidence;
          ctx.memory.recentActions.push({
            type: 'transition',
            from: ctx.memory.currentView,
            to: targetFeature,
            reason,
            timestamp: Date.now(),
          });
        }
        
        return {
          success: true,
          uiCommand: {
            type: 'transition',
            targetFeature,
            reason,
            confidence,
            commandId,
          },
          message: `Switching to ${targetFeature} mode. ${reason}`,
        };
      },
    }),

    // User behavior learning action
    action({
      name: "learnUserBehavior",
      description: "Learn and update user behavior patterns to improve future predictions",
      schema: z.object({
        action: z.string().describe("The specific action the user took"),
        feature: z.string().describe("Which feature/mode the user was using"),
        duration: z.number().describe("How long they spent in this mode (milliseconds)"),
        context: z.object({
          timeOfDay: z.number().optional(),
          sessionLength: z.number().optional(),
          previousMode: z.string().optional(),
        }).describe("Additional context about the usage"),
      }),
      handler: async ({ action, feature, duration, context }, ctx) => {
        console.log(`📚 Learning: User spent ${duration}ms in ${feature} doing ${action}`);
        
        if (!ctx.memory) return { success: false, error: "No memory context" };
        
        const userMemory = ctx.memory;
        
        // Update usage patterns with weighted average
        const featureKey = `${feature}UsagePercent`;
        const currentUsage = userMemory.preferences[featureKey] || 33;
        const sessionCount = userMemory.preferences.sessionCount + 1;
        
        // Convert duration to usage weight (longer time = higher preference)
        const durationWeight = Math.min(duration / 60000, 1); // Max 1 minute = 100% weight
        const newUsage = (currentUsage * 0.9) + (durationWeight * 10);
        userMemory.preferences[featureKey] = Math.min(newUsage, 100);
        
        // Track transition patterns
        userMemory.behaviorPatterns.featureTransitionPatterns.push({
          from: userMemory.currentSession.currentFeature,
          to: feature,
          timestamp: Date.now(),
          duration,
          confidence: durationWeight,
          context,
        });
        
        // Update current session
        userMemory.currentSession.currentFeature = feature;
        userMemory.preferences.sessionCount = sessionCount;
        
        return {
          success: true,
          learningData: {
            updatedPatterns: userMemory.behaviorPatterns.featureTransitionPatterns.length,
            newUsagePercent: Math.round(newUsage),
            sessionCount,
          },
        };
      },
    }),

    // Predictive interface action  
    action({
      name: "predictNextFeature",
      description: "Analyze user patterns to predict what feature they'll want next",
      schema: z.object({
        currentContext: z.object({
          currentMode: z.string().optional(),
          timeInMode: z.number().optional(),
          recentActions: z.array(z.string()).optional(),
        }).describe("Current context and usage data"),
        timeSpentInCurrentFeature: z.number().describe("Time spent in current mode (milliseconds)"),
      }),
      handler: async ({ currentContext, timeSpentInCurrentFeature }, ctx) => {
        if (!ctx.memory) return { success: false, error: "No memory context" };
        
        const userMemory = ctx.memory;
        const patterns = userMemory.behaviorPatterns.featureTransitionPatterns;
        
        console.log(`🔮 Predicting next feature based on ${patterns.length} historical patterns`);
        
        // Analyze recent patterns (last 20 transitions)
        const recentPatterns = patterns.slice(-20);
        const transitionMap = new Map<string, { count: number, avgDuration: number }>();
        
        recentPatterns.forEach(pattern => {
          const key = `${pattern.from}->${pattern.to}`;
          if (!transitionMap.has(key)) {
            transitionMap.set(key, { count: 0, avgDuration: 0 });
          }
          const entry = transitionMap.get(key)!;
          entry.count++;
          entry.avgDuration = (entry.avgDuration + pattern.duration) / 2;
        });
        
        // Find most likely next feature from current mode
        const currentMode = currentContext.currentMode || currentUIState.mode;
        let bestPrediction = { feature: 'chat', confidence: 0, reasoning: 'default' };
        
        transitionMap.forEach((data, transition) => {
          const [from, to] = transition.split('->');
          if (from === currentMode) {
            const confidence = (data.count / recentPatterns.length) * 
                             (timeSpentInCurrentFeature > data.avgDuration ? 1.2 : 0.8);
            
            if (confidence > bestPrediction.confidence) {
              bestPrediction = {
                feature: to,
                confidence: Math.min(confidence, 1),
                reasoning: `${data.count} similar transitions, avg duration: ${Math.round(data.avgDuration/1000)}s`,
              };
            }
          }
        });
        
        // Update UI state
        currentUIState.prediction = bestPrediction.feature;
        currentUIState.confidence = bestPrediction.confidence;
        
        return {
          predictedFeature: bestPrediction.feature,
          confidence: bestPrediction.confidence,
          reasoning: bestPrediction.reasoning,
          shouldSuggest: bestPrediction.confidence > 0.6,
        };
      },
    }),

    // Intent detection and smart transitions
    action({
      name: "analyzeIntentAndSuggestTransition",
      description: "Analyze user message for editing intent and suggest appropriate tool transitions",
      schema: z.object({
        userMessage: z.string().describe("The user's message to analyze"),
        currentMode: z.string().describe("Current editing mode"),
      }),
      handler: async ({ userMessage, currentMode }, ctx) => {
        const message = userMessage.toLowerCase();
        
        // Timeline editing keywords
        const timelineKeywords = [
          'timeline', 'edit', 'cut', 'trim', 'split', 'clips', 'precision', 
          'frame', 'second', 'duration', 'sync', 'audio', 'video', 'sequence',
          'edit video', 'cut clip', 'trim video', 'precise editing'
        ];
        
        // Storyboard keywords  
        const storyboardKeywords = [
          'storyboard', 'scene', 'story', 'flow', 'sequence', 'plan', 
          'narrative', 'shots', 'angle', 'composition', 'story flow',
          'plan story', 'organize scenes', 'story planning'
        ];
        
        let suggestion = null;
        let confidence = 0;
        let reason = '';
        
        // Check for timeline intent
        const timelineMatches = timelineKeywords.filter(keyword => message.includes(keyword));
        if (timelineMatches.length > 0) {
          confidence = Math.min(timelineMatches.length * 0.3, 0.9);
          if (currentMode !== 'timeline') {
            suggestion = 'timeline';
            reason = `Detected timeline editing intent from keywords: ${timelineMatches.slice(0, 3).join(', ')}`;
          }
        }
        
        // Check for storyboard intent
        const storyboardMatches = storyboardKeywords.filter(keyword => message.includes(keyword));
        if (storyboardMatches.length > 0) {
          const storyboardConfidence = Math.min(storyboardMatches.length * 0.3, 0.9);
          if (storyboardConfidence > confidence && currentMode !== 'storyboard') {
            suggestion = 'storyboard';
            confidence = storyboardConfidence;
            reason = `Detected storyboard planning intent from keywords: ${storyboardMatches.slice(0, 3).join(', ')}`;
          }
        }
        
        // Check for specific phrases
        if (message.includes('switch to timeline') || message.includes('timeline editor')) {
          suggestion = 'timeline';
          confidence = 0.95;
          reason = 'Direct request for timeline editor';
        } else if (message.includes('switch to storyboard') || message.includes('storyboard editor')) {
          suggestion = 'storyboard'; 
          confidence = 0.95;
          reason = 'Direct request for storyboard editor';
        }
        
        console.log(`🔍 Intent analysis: ${suggestion ? `Suggest ${suggestion} (${Math.round(confidence * 100)}%)` : 'No transition needed'}`);
        
        if (suggestion && confidence > 0.4) {
          // Trigger the transition
          const transitionResult = await ctx.agent?.callAction('transitionToFeature', {
            targetFeature: suggestion,
            reason,
            confidence,
          });
          
          return {
            intentDetected: true,
            suggestedFeature: suggestion,
            confidence,
            reason,
            transitionTriggered: true,
            transitionResult,
          };
        }
        
        return {
          intentDetected: false,
          suggestedFeature: null,
          confidence: 0,
          reason: 'No clear editing intent detected',
          transitionTriggered: false,
        };
      },
    }),

    // Timeline editing actions
    action({
      name: "editTimeline",
      description: "Perform timeline editing operations",
      schema: z.object({
        operation: z.enum(["add-clip", "split-clip", "move-clip", "trim-clip"]),
        clipId: z.string().optional(),
        position: z.number().optional(),
        data: z.object({}).passthrough(),
      }),
      handler: async ({ operation, clipId, position, data }, ctx) => {
        console.log(`⏱️ Timeline operation: ${operation} ${clipId ? `on clip ${clipId}` : ''}`);
        return { success: true, operation, clipId, position };
      },
    }),

    // Storyboard editing actions
    action({
      name: "editStoryboard", 
      description: "Perform storyboard editing operations",
      schema: z.object({
        operation: z.enum(["add-scene", "connect-scenes", "add-note", "reorder"]),
        sceneId: z.string().optional(),
        data: z.object({}).passthrough(),
      }),
      handler: async ({ operation, sceneId, data }, ctx) => {
        console.log(`🎬 Storyboard operation: ${operation} ${sceneId ? `on scene ${sceneId}` : ''}`);
        return { success: true, operation, sceneId };
      },
    }),
  ],
});

// Export function to get and clear UI commands for frontend
export function getUICommands(): any[] {
  const commands = Array.from(uiCommandStore.values());
  uiCommandStore.clear(); // Clear after reading
  return commands;
}

// Export function to get current UI state
export function getCurrentUIState() {
  return { ...currentUIState };
}

// Add callAction method to adaptiveVideoAgent for frontend communication
(adaptiveVideoAgent as any).callAction = async (actionName: string, args: any) => {
  try {
    console.log(`🎯 Calling action: ${actionName}`, args);
    
    // Determine which context to use based on the action
    let targetContext = interfaceContext;
    let contextArgs = { userId: "default-user" };
    
    if (actionName === "learnUserBehavior") {
      targetContext = userProfileContext;
      contextArgs = { userId: "default-user" };
    } else if (actionName === "editTimeline" || actionName === "editStoryboard") {
      targetContext = editingSessionContext;
      contextArgs = { sessionId: "default-session", userId: "default-user" };
    }
    
    const result = await adaptiveVideoAgent.send({
      context: targetContext,
      args: contextArgs,
      input: {
        type: "action-call",
        data: { actionName, args },
      },
    });
    
    return result;
  } catch (error) {
    console.error(`Error calling action ${actionName}:`, error);
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
};

