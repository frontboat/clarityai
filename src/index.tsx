import { serve } from "bun";
import index from "./index.html";
import { initializeAgent, handleChatMessage } from "./agent";

// Initialize the agent when server starts
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
