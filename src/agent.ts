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
  lastResponse?: any; // Can be string or action result
}

// Store for API responses - now holds structured data
const responseStore = new Map<string, any>();

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
    const result = { type: 'respond', payload: { response } };
    responseStore.set(sessionId, result);
    
    // Update context memory
    if (ctx.memory) {
      ctx.memory.lastResponse = result;
      ctx.memory.messages.push({
        role: "assistant",
        content: response,
        timestamp: Date.now(),
      });
    }
    
    return { success: true, response };
  },
});

const changeBackgroundColorAction = action({
  name: "changeBackgroundColor",
  description: "Change the background color of the page.",
  schema: z.object({
    color: z.string().describe("The CSS color to set the background to (e.g., 'blue', '#ff0000')."),
  }),
  handler: async ({ color }, ctx) => {
    const result = { type: 'changeBackgroundColor', payload: { color } };
    // Assuming a sessionId is available in the context memory
    if (ctx.memory?.sessionId) {
      responseStore.set(ctx.memory.sessionId, result);
      return { success: true, message: `Changed background color to ${color}` };
    }
    return { success: false, message: "Session ID not found." };
  },
});

const updateDOMAction = action({
  name: "updateDOM",
  description:
    "Update the inner HTML of the main content area of the page. This can be used to render any HTML content on the page, providing a blank canvas.",
  schema: z.object({
    html: z.string().describe("The HTML content to render on the page. It can be a full HTML structure."),
  }),
  handler: async ({ html }, ctx) => {
    const result = { type: "updateDOM", payload: { html } };
    if (ctx.memory?.sessionId) {
      responseStore.set(ctx.memory.sessionId, result);
      return { success: true, message: `Updated the DOM with new HTML content.` };
    }
    return { success: false, message: "Session ID not found." };
  },
});

// Create the agent
const agent = createDreams({
  model: openrouter("openai/gpt-4o"),
  contexts: [chatContext],
  actions: [respondAction, changeBackgroundColorAction, updateDOMAction],
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
export async function handleChatMessage(sessionId: string, message: string): Promise<any> {
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
    const result = responseStore.get(sessionId);
    if (result) {
      responseStore.delete(sessionId);
      return result;
    }
    
    // Fallback if no response was generated
    return { type: 'respond', payload: { response: "I'm sorry, I couldn't process your message. Please try again." }};
  } catch (error) {
    console.error("Error handling chat message:", error);
    return { type: 'respond', payload: { response: "An error occurred while processing your message." }};
  }
}