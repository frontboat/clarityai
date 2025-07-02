import { serve } from "bun";
import index from "./index.html";
import { initializeAgent, handleChatMessage, setAgentConfig, getUICommands, getCurrentUIState } from "./agent";

// Environment check and configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY is required. Please set it in your .env file.");
  process.exit(1);
}

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-3.7-sonnet";

// Configure and initialize the agent
setAgentConfig({
  apiKey: OPENROUTER_API_KEY,
  model: OPENROUTER_MODEL,
});

initializeAgent().catch(console.error);

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/chat": {
      async POST(req) {
        const body = await req.json();
        const { sessionId = "default", message } = body;

        try {
          const response = await handleChatMessage(sessionId, message);
          return new Response(JSON.stringify({ response }));
        } catch (error) {
          console.error("Chat error:", error);
          return new Response(
            JSON.stringify({ error: "Failed to process message" }),
            { status: 500 }
          );
        }
      },
    },

    "/api/ui-commands": {
      async GET() {
        try {
          const commands = getUICommands();
          return new Response(JSON.stringify(commands));
        } catch (error) {
          console.error("UI commands error:", error);
          return new Response(JSON.stringify([]), { status: 500 });
        }
      },
    },

    "/api/ui-state": {
      async GET() {
        try {
          const state = getCurrentUIState();
          return new Response(JSON.stringify(state));
        } catch (error) {
          console.error("UI state error:", error);
          return new Response(JSON.stringify({}), { status: 500 });
        }
      },
    },
  },

  development: {
    hmr: true,
    console: true,
  },

  port: 3000,
});

console.log(`🚀 Server running at http://localhost:${server.port}/`);
