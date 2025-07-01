import { createDreams, context, input, output, action } from "@daydreamsai/core";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";

// Environment check
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY is required. Please set it in your .env file.");
  process.exit(1);
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
  model: openrouter("openai/gpt-4o"),
  contexts: [chatContext],
  actions: [respondAction],
});

// Initialize the agent
let agentStarted = false;
export async function initializeAgent() {
  if (!agentStarted) {
    await agent.start();
    agentStarted = true;
    console.log("ClarityAI agent initialized with Daydreams and OpenRouter");
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
    return "An error occurred while processing your message. Please ensure your OPENROUTER_API_KEY is set correctly in your .env file.";
  }
}