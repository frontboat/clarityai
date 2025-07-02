import { serve } from "bun";
import index from "./index.html";
import { initializeAgent, handleChatMessage, setAgentConfig } from "./agent";

// Environment check and configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY is required. Please set it in your .env file.");
  process.exit(1);
}

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-4-sonnet-20250219";

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
        try {
          const body = await req.json();
          const { sessionId, message } = body;

          if (!sessionId || !message) {
            return Response.json(
              { error: "Missing sessionId or message" },
              { status: 400 }
            );
          }

          const response = await handleChatMessage(sessionId, message);
          
          return Response.json({
            response,
            sessionId,
          });
        } catch (error) {
          console.error("Chat API error:", error);
          return Response.json(
            { error: "Failed to process chat message" },
            { status: 500 }
          );
        }
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
