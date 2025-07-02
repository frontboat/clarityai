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
  model: 'google/gemini-2.0-flash-001',
};

// Function to initialize agent configuration (called from server)
export function setAgentConfig(config: typeof agentConfig) {
  agentConfig = config;
}

// Store for API responses
const responseStore = new Map<string, string>();

// Create a single, unified context for the adaptive UI agent
const clarityAgentContext = context({
  type: "clarity-agent",
  schema: z.object({ sessionId: z.string() }),
  
  instructions: "You are a helpful AI assistant called ClarityAI. Your goal is to create a seamless video editing experience for the user by adapting to their workflow and predicting their needs. You can chat, manage a timeline, and organize a storyboard. Analyze user messages to understand their intent and proactively transition the UI to the most appropriate tool.",

  create: ({ args }) => ({
    // from chatContext
    sessionId: args.sessionId,
    messages: [],
    lastResponse: undefined,
    // from adaptiveUiContext
    preferences: {
      primaryWorkflow: "balanced",
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
    projectData: {
      timeline: { clips: [], duration: 0, markers: [] },
      storyboard: { scenes: [], connections: [], notes: [] },
      metadata: { title: "", description: "", tags: [] },
    },
    editingState: {
      currentTool: "chat", // Start in chat
      selectedClips: [],
      playheadPosition: 0,
      zoomLevel: 1,
      activeLayer: 0,
    },
    uiState: {
      currentView: "chat",
      transitionState: "stable",
      predictedNextFeature: null,
      confidence: 0,
      sidebarOpen: true,
      timelineHeight: 200,
      storyboardVisible: false,
      chatExpanded: true,
    },
    recentActions: [],
  }),

  render: (state) => {
    const recentMessages = (state.memory.messages as any[]).slice(-10);
    return `
Chat Session: ${state.memory.sessionId}
Recent messages (${(state.memory.messages as any[]).length} total):
${recentMessages.map((m: any) => `${m.role}: ${m.content}`).join('\n')}

---

User Profile: ${state.args.sessionId}
Primary Workflow: ${(state.memory.preferences as any).primaryWorkflow}
Current View: ${(state.memory.uiState as any).currentView}
Transition: ${(state.memory.uiState as any).transitionState}
Predicted Next: ${(state.memory.uiState as any).predictedNextFeature} (${(state.memory.uiState as any).confidence}% confidence)

Project: ${(state.memory.projectData as any).metadata.title || 'Untitled'}
Timeline: ${(state.memory.projectData as any).timeline.clips.length} clips
Storyboard: ${(state.memory.projectData as any).storyboard.scenes.length} scenes
Current Tool: ${(state.memory.editingState as any).currentTool}
    `.trim();
  },

  async onStep(ctx) {
    if (ctx.memory) {
      latestMemoryState = { ...ctx.memory };
    }
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

// UI State management for cross-component communication
let currentUIState = {
  mode: 'chat' as 'chat' | 'timeline' | 'storyboard',
  prediction: null as string | null,
  confidence: 0,
  lastTransition: Date.now(),
};

// Store for UI commands that need to be sent to frontend
const uiCommandStore = new Map<string, any>();

// Create the unified agent
const clarityAgent = createDreams({
  model: openrouter(agentConfig.model),
  contexts: [clarityAgentContext],
  
  // Custom actions for interface control and learning
  actions: [
    // Respond to user
    action<any, any, any>({
      name: "respond",
      description: "Respond to the user's message",
      schema: z.object({
        response: z.string().describe("The response to send to the user"),
        sessionId: z.string().describe("Session ID for the response"),
      }),
      handler: async ({ response, sessionId }, ctx) => {
        responseStore.set(sessionId, response);
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
    }),

    // Interface transition actions
    action({
      name: "transitionToFeature",
      description: "Seamlessly transition the UI to a different editing feature based on user intent or prediction",
      schema: z.object({
        targetFeature: z.enum(["chat", "timeline", "storyboard"]),
        reason: z.string().describe("Why this transition is being suggested"),
        confidence: z.number().min(0).max(1).optional().describe("Confidence level of this transition recommendation"),
      }),
      handler: async ({ targetFeature, reason, confidence = 0.8 }, ctx: any) => {
        console.log(`🔄 Agent suggesting transition to ${targetFeature}: ${reason} (${Math.round(confidence * 100)}% confidence)`);
        
        currentUIState.mode = targetFeature;
        currentUIState.prediction = targetFeature;
        currentUIState.confidence = confidence;
        currentUIState.lastTransition = Date.now();
        
        const commandId = `transition-${Date.now()}`;
        uiCommandStore.set(commandId, {
          type: 'transition',
          targetFeature,
          reason,
          confidence,
          timestamp: Date.now(),
        });
        
        if (ctx.memory) {
          ctx.memory.uiState.currentView = targetFeature;
          ctx.memory.uiState.transitionState = 'transitioning';
          ctx.memory.uiState.predictedNextFeature = null;
          ctx.memory.uiState.confidence = confidence;
          ctx.memory.recentActions.push({
            type: 'transition',
            from: ctx.memory.uiState.currentView,
            to: targetFeature,
            reason,
            timestamp: Date.now(),
          });
        }
        
        return {
          success: true,
          uiCommand: { type: 'transition', targetFeature, reason, confidence, commandId },
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
      handler: async ({ action, feature, duration, context }, ctx: any) => {
        console.log(`📚 Learning: User spent ${duration}ms in ${feature} doing ${action}`);
        
        if (!ctx.memory) return { success: false, error: "No memory context" };
        
        const userMemory = ctx.memory;
        
        const featureKey = `${feature}UsagePercent` as keyof typeof userMemory.preferences;
        const currentUsage = userMemory.preferences[featureKey] || 33;
        const sessionCount = userMemory.preferences.sessionCount + 1;
        
        const durationWeight = Math.min(duration / 60000, 1);
        const newUsage = (currentUsage * 0.9) + (durationWeight * 10);
        (userMemory.preferences as any)[featureKey] = Math.min(newUsage, 100);
        
        userMemory.behaviorPatterns.featureTransitionPatterns.push({
          from: userMemory.editingState.currentTool,
          to: feature,
          timestamp: Date.now(),
          duration,
          confidence: durationWeight,
          context,
        });
        
        userMemory.editingState.currentTool = feature;
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
      handler: async ({ currentContext, timeSpentInCurrentFeature }, ctx: any) => {
        if (!ctx.memory) return { success: false, error: "No memory context" };
        
        const userMemory = ctx.memory;
        const patterns = userMemory.behaviorPatterns.featureTransitionPatterns;
        
        console.log(`🔮 Predicting next feature based on ${patterns.length} historical patterns`);
        
        const recentPatterns = patterns.slice(-20);
        const transitionMap = new Map<string, { count: number, avgDuration: number }>();
        
        recentPatterns.forEach((pattern: any) => {
          const key = `${pattern.from}->${pattern.to}`;
          if (!transitionMap.has(key)) {
            transitionMap.set(key, { count: 0, avgDuration: 0 });
          }
          const entry = transitionMap.get(key)!;
          entry.count++;
          entry.avgDuration = (entry.avgDuration + pattern.duration) / 2;
        });
        
        const currentMode = currentContext.currentMode || currentUIState.mode;
        let bestPrediction = { feature: 'chat', confidence: 0, reasoning: 'default' };
        
        transitionMap.forEach((data, transition) => {
          const [from, to] = transition.split('->');
          if (from === currentMode) {
            const confidence = (data.count / recentPatterns.length) * (timeSpentInCurrentFeature > data.avgDuration ? 1.2 : 0.8);
            
            if (confidence > bestPrediction.confidence) {
              bestPrediction = {
                feature: to,
                confidence: Math.min(confidence, 1),
                reasoning: `${data.count} similar transitions, avg duration: ${Math.round(data.avgDuration/1000)}s`,
              };
            }
          }
        });
        
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
      handler: async ({ userMessage, currentMode }, ctx: any, agent: any) => {
        const message = userMessage.toLowerCase();
        
        const timelineKeywords = ['timeline', 'edit', 'cut', 'trim', 'split', 'clips', 'precision', 'frame', 'second', 'duration', 'sync', 'audio', 'video', 'sequence', 'edit video', 'cut clip', 'trim video', 'precise editing'];
        const storyboardKeywords = ['storyboard', 'scene', 'story', 'flow', 'sequence', 'plan', 'narrative', 'shots', 'angle', 'composition', 'story flow', 'plan story', 'organize scenes', 'story planning'];
        
        let suggestion = null;
        let confidence = 0;
        let reason = '';
        
        const timelineMatches = timelineKeywords.filter(keyword => message.includes(keyword));
        if (timelineMatches.length > 0) {
          confidence = Math.min(timelineMatches.length * 0.3, 0.9);
          if (currentMode !== 'timeline') {
            suggestion = 'timeline';
            reason = `Detected timeline editing intent from keywords: ${timelineMatches.slice(0, 3).join(', ')}`;
          }
        }
        
        const storyboardMatches = storyboardKeywords.filter(keyword => message.includes(keyword));
        if (storyboardMatches.length > 0) {
          const storyboardConfidence = Math.min(storyboardMatches.length * 0.3, 0.9);
          if (storyboardConfidence > confidence && currentMode !== 'storyboard') {
            suggestion = 'storyboard';
            confidence = storyboardConfidence;
            reason = `Detected storyboard planning intent from keywords: ${storyboardMatches.slice(0, 3).join(', ')}`;
          }
        }
        
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
          const transitionResult = await (agent as any)?.callAction('transitionToFeature', {
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
        operation: z.enum(["add-scene", "connect-scenes", "add-note", "reorder", "update-scene", "delete-scene", "move-scene"]),
        sceneId: z.string().optional(),
        data: z.object({}).passthrough(),
      }),
      handler: async ({ operation, sceneId, data }, ctx: any) => {
        console.log(`🎬 Storyboard operation: ${operation} ${sceneId ? `on scene ${sceneId}` : ''}`);
        
        if (!ctx.memory.projectData.storyboard) {
          ctx.memory.projectData.storyboard = { scenes: [], connections: [], notes: [] };
        }
        const { scenes } = ctx.memory.projectData.storyboard;

        switch (operation) {
          case 'add-scene':
            scenes.push(data.scene);
            break;
          case 'delete-scene':
            ctx.memory.projectData.storyboard.scenes = scenes.filter((s: any) => s.id !== sceneId);
            break;
          case 'update-scene':
            ctx.memory.projectData.storyboard.scenes = scenes.map((s: any) => 
              s.id === sceneId ? { ...s, ...data.updates } : s
            );
            break;
          case 'move-scene':
             ctx.memory.projectData.storyboard.scenes = scenes.map((s: any) =>
              s.id === sceneId ? { ...s, position: data.position } : s
            );
            break;
          case 'connect-scenes':
            ctx.memory.projectData.storyboard.scenes = scenes.map((s: any) =>
              s.id === data.from ? { ...s, connections: [...s.connections, data.to] } : s
            );
            break;
        }

        return { success: true, operation, sceneId, newSceneCount: scenes.length };
      },
    }),
  ],
});

// This will hold the latest memory state for the frontend to poll
let latestMemoryState: any = {
  projectData: {
    storyboard: { scenes: [], connections: [], notes: [] }
  }
};

// Initialize the agents
let agentStarted = false;
export async function initializeAgent() {
  if (!agentStarted) {
    // Start the agent
    await clarityAgent.start();
    agentStarted = true;
    console.log(`ClarityAI agent initialized with Daydreams and OpenRouter (model: ${agentConfig.model})`);
  }
}

// Handle chat messages using Daydreams with intent detection
export async function handleChatMessage(sessionId: string, message: string): Promise<string> {
  try {
    const result = await clarityAgent.send({
      context: clarityAgentContext,
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

// Export function to get and clear UI commands for frontend
export function getUICommands(): any[] {
  const commands = Array.from(uiCommandStore.values());
  uiCommandStore.clear(); // Clear after reading
  return commands;
}

// Export function to get current UI state
export function getCurrentUIState() {
  return { 
    ...currentUIState,
    projectData: latestMemoryState?.projectData 
  };
}

