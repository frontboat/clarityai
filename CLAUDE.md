# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Technology Stack

This is a **Bun-first** web application. Always use Bun instead of Node.js, npm, yarn, or pnpm.

- **Runtime**: Bun (v1.2.16+) - JavaScript/TypeScript runtime and bundler
- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Server**: Bun.serve() with built-in routing and WebSocket support
- **AI Framework**: Daydreams AI Core + OpenRouter (AI SDK Provider)
- **Build**: Bun's built-in bundler (no Vite/Webpack needed)

## Essential Commands

```bash
# Development with hot reload
bun dev

# Production server
bun start

# Build for production
bun build

# Install dependencies (ALWAYS use this instead of npm/yarn/pnpm)
bun install

# Run tests
bun test

# Execute TypeScript files directly
bun <file.ts>
```

## Architecture

### Server Entry (`src/index.tsx`)
- Uses `Bun.serve()` with route-based API handling
- HTML imports for serving the frontend
- Initializes Daydreams AI agent on startup
- API routes pattern: `/api/*`

### AI Chat API (`src/agent.ts`)
- Built with Daydreams AI Core framework
- Uses OpenRouter as the LLM provider (configured for OpenAI GPT-4)
- Chat endpoint: `POST /api/chat`
  - Request: `{ sessionId: string, message: string }`
  - Response: `{ response: string, sessionId: string }`
- Manages chat sessions with context memory
- Custom input/output handlers for API integration

### Frontend Structure
- **Entry**: `src/index.html` imports `src/frontend.tsx`
- **React Bootstrap**: `src/frontend.tsx` mounts React to `#root`
- **Main App**: `src/App.tsx` - primary React component
- **Chat Interface**: `src/ChatInterface.tsx` - AI chat UI component
- **Components**: `src/components/ui/*` - shadcn/ui components
- **Styling**: Tailwind CSS v4 with CSS variables

### Build System (`build.ts`)
- Custom build script with CLI options
- Automatically discovers HTML entry points
- Uses Bun's bundler with Tailwind plugin
- Output directory: `dist/`

## Bun-Specific Guidelines

### ALWAYS use Bun APIs instead of Node.js equivalents:
- `Bun.serve()` instead of Express
- `Bun.file()` instead of `fs.readFile/writeFile`
- `bun:sqlite` instead of better-sqlite3
- `Bun.redis` instead of ioredis
- `Bun.sql` instead of pg/postgres.js
- `Bun.$` for shell commands instead of execa
- Built-in `WebSocket` instead of ws package

### Frontend Development
- HTML files can directly import `.tsx`, `.jsx`, `.js` files
- CSS imports in TypeScript/JavaScript work automatically
- Hot Module Replacement (HMR) is built-in
- No need for Vite or other bundlers

### Environment Variables
- Bun automatically loads `.env` files (no dotenv needed)
- Public env vars must be prefixed with `BUN_PUBLIC_`

## TypeScript Configuration
- JSX: `react-jsx` transform
- Module resolution: bundler
- Path alias configured: `@/*` → `./src/*`
- No emit (Bun handles transpilation)

## Testing
Use Bun's built-in test runner:
```typescript
import { test, expect } from "bun:test";

test("example", () => {
  expect(1 + 1).toBe(2);
});
```

## Configuration

### Environment Variables
Required environment variables (create `.env` file from `.env.example`):
```bash
# OpenRouter API key for AI chat functionality
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

Get your API key from: https://openrouter.ai/keys

## Adding New Features

### API Endpoints
Add new routes to `src/index.tsx`:
```typescript
"/api/newroute": {
  GET: async (req) => Response.json({ data: "value" }),
  POST: async (req) => {
    const body = await req.json();
    return Response.json({ received: body });
  }
}
```

### AI Agent Customization
- Modify agent behavior in `src/agent.ts`
- Change AI model: Update `openrouter("openai/gpt-4o")` to any supported model
- Adjust context instructions for different personalities
- Add memory persistence or advanced features using Daydreams extensions

### UI Components
1. Check existing components in `src/components/ui/`
2. Follow shadcn/ui patterns (New York style, Zinc colors)
3. Use Tailwind CSS classes for styling
4. Forms: Use React Hook Form + Zod for validation

### WebSocket Support
Bun.serve() has built-in WebSocket support - add to server config:
```typescript
websocket: {
  open: (ws) => { /* handle connection */ },
  message: (ws, message) => { /* handle message */ },
  close: (ws) => { /* handle close */ }
}
```

## Important Notes
- Never use npm, yarn, or pnpm commands
- Don't install Express, Vite, or Node.js-specific packages
- Prefer Bun's built-in APIs over third-party packages
- The project uses Tailwind CSS v4 (not v3) with CSS variables
- shadcn/ui components are already configured and ready to use