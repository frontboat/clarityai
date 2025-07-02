import { createDreams, context, input, output, action, extension } from "@daydreamsai/core";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";

// Configuration that will be set from server
let agentConfig = {
  apiKey: '',
  model: 'anthropic/claude-4-sonnet-20250219',
};

// Function to initialize agent configuration (called from server)
export function setAgentConfig(config: { apiKey: string; model?: string }) {
  agentConfig.apiKey = config.apiKey;
  if (config.model) {
    agentConfig.model = config.model;
  }
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
  model: openrouter(agentConfig.model, {
    apiKey: agentConfig.apiKey,
  }),
  contexts: [chatContext],
  actions: [respondAction],
});

// Initialize the agent
let agentStarted = false;
export async function initializeAgent() {
  if (!agentStarted) {
    // Validate configuration
    if (!agentConfig.apiKey) {
      throw new Error("OpenRouter API key not configured. Please call setAgentConfig() first.");
    }
    
    await agent.start();
    agentStarted = true;
    console.log(`ClarityAI agent initialized with Daydreams and OpenRouter (model: ${agentConfig.model})`);
  }
}

// Handle chat messages using Daydreams
export async function handleChatMessage(sessionId: string, message: string): Promise<string> {
  try {
    // Clear previous response
    responseStore.delete(sessionId);
    
    // Run the agent with the chat context and message
    await agent.send({
      context: chatContext,
      args: { sessionId },
      input: {
        type: "user:message",
        data: message,
      },
    });
    
    // Get the response from the store
    const response = responseStore.get(sessionId);
    if (response) {
      responseStore.delete(sessionId);
      return response;
    }
    
    // Fallback if no response was generated
    return "I'm sorry, I couldn't process your message. Please try again.";
          } catch (error) {
    console.error("Error handling chat message:", error);
    return "An error occurred while processing your message. Please check your OpenRouter configuration.";
  }
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

export const adaptiveVideoAgent = createDreams({
  model: openrouter(agentConfig.model, {
    apiKey: agentConfig.apiKey,
  }),
  contexts: [userProfileContext, editingSessionContext, interfaceContext],
  
  // Custom actions for interface control and learning
  actions: [
    // Interface transition actions
    action({
      name: "transitionToFeature",
      description: "Seamlessly transition the UI to a different editing feature",
      schema: z.object({
        targetFeature: z.enum(["chat", "timeline", "storyboard"]),
        reason: z.string(),
        confidence: z.number().min(0).max(1),
      }),
      handler: async ({ targetFeature, reason, confidence }, ctx) => {
        // This would trigger the UI transition
        // Implementation depends on your frontend framework
        return {
          success: true,
          transition: targetFeature,
          reason,
          confidence,
        };
      },
    }),

    // User behavior learning action
    action({
      name: "learnUserBehavior",
      description: "Learn and update user behavior patterns",
      schema: z.object({
        action: z.string(),
        feature: z.string(),
        duration: z.number(),
        context: z.object({}).passthrough(),
      }),
      handler: async ({ action, feature, duration, context }, ctx) => {
        const userMemory = ctx.memory;
        
        // Update usage patterns
        const currentUsage = userMemory.preferences[`${feature}UsagePercent`] || 0;
        const sessionCount = userMemory.preferences.sessionCount + 1;
        
        // Weighted average for gradual learning
        const newUsage = (currentUsage * 0.8) + (duration * 0.2);
        userMemory.preferences[`${feature}UsagePercent`] = newUsage;
        
        // Track transition patterns
        userMemory.behaviorPatterns.featureTransitionPatterns.push({
          from: userMemory.currentSession.currentFeature,
          to: feature,
          timestamp: Date.now(),
          duration,
          confidence: Math.random(), // Replace with actual confidence calculation
        });
        
        return {
          success: true,
          updatedPatterns: userMemory.behaviorPatterns.featureTransitionPatterns.length,
        };
      },
    }),

    // Predictive interface action
    action({
      name: "predictNextFeature",
      description: "Predict what feature the user will want next",
      schema: z.object({
        currentContext: z.object({}).passthrough(),
        timeSpentInCurrentFeature: z.number(),
      }),
      handler: async ({ currentContext, timeSpentInCurrentFeature }, ctx) => {
        const userMemory = ctx.memory;
        const patterns = userMemory.behaviorPatterns.featureTransitionPatterns;
        
        // Simple prediction based on recent patterns
        // In production, you'd use more sophisticated ML
        const recentPatterns = patterns.slice(-10);
        const mostCommonNext = recentPatterns.reduce((acc, pattern) => {
          acc[pattern.to] = (acc[pattern.to] || 0) + 1;
          return acc;
        }, {});
        
        const predicted = Object.keys(mostCommonNext).reduce((a, b) => 
          mostCommonNext[a] > mostCommonNext[b] ? a : b
        );
        
        const confidence = mostCommonNext[predicted] / recentPatterns.length;
        
        return {
          predictedFeature: predicted,
          confidence,
          reasoning: `Based on ${recentPatterns.length} recent patterns`,
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
        // Timeline editing logic here
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
        // Storyboard editing logic here
        return { success: true, operation, sceneId };
      },
    }),
  ],
});