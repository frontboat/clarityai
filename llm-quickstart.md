# 🤖 Daydreams AI Agent Framework - LLM Quick Start Guide

## 📋 Overview

Daydreams is a TypeScript framework for building stateful AI agents. It provides a structured way to create agents that can maintain context, execute actions, and collaborate with other agents while maintaining type safety.

**Key Philosophy**: Agents have "personalities" (contexts), "capabilities" (actions), and "memory" (multi-tier state management).

## 🎯 Core Concepts

### 1. **Agent** - The Main Orchestrator

The agent is created with `createDreams()` and manages the entire lifecycle.

```typescript
const agent = createDreams({
  model: openrouter("google/gemini-2.5-pro"),
  contexts: [myContext],      // Agent personalities
  actions: [myAction],        // Agent capabilities
  inputs: { cli: cliInput },  // How to receive data
  outputs: { cli: cliOutput }, // How to send responses
  extensions: [cliExtension], // UI/platform integrations
});

// Start the agent
await agent.start();

// Run with a specific context
await agent.run({
  context: myContext,
  args: { userId: "123" }
});
```

### 2. **Context** - Agent Personality & State

A context defines what the agent sees and how it behaves. Think of it as an isolated stateful environment (like a chat session).

```typescript
const myContext = context({
  type: "assistant",  // Unique identifier
  
  // Input validation
  schema: z.object({
    userId: z.string(),
  }),
  
  // Initial state
  create: () => ({
    conversationHistory: [],
    preferences: {},
  }),
  
  // Dynamic view (what agent sees)
  render: ({ memory, args }) => {
    return `You are helping user ${args.userId}. 
    Previous messages: ${memory.conversationHistory.length}`;
  },
  
  // Static behavior rules
  instructions: "You are a helpful assistant. Be concise and friendly."
});
```

**Key Components:**
- `type`: Unique identifier for the context type
- `schema`: Zod schema for validating context arguments
- `create`: Function that returns initial memory state
- `render`: Dynamic function that shows current state to the agent
- `instructions`: Static instructions for agent behavior

### 3. **Actions** - Agent Capabilities

Type-safe functions that agents can execute. Actions are the **ONLY** way to modify shared state or interact with external systems.

```typescript
const searchAction = action({
  name: "search",
  description: "Search the web for information",
  
  // Input validation
  schema: z.object({
    query: z.string().describe("The search query"),
    maxResults: z.number().default(5),
  }),
  
  // Optional: shared memory across actions
  memory: sharedMemory,
  
  async handler({ query, maxResults }, ctx, agent) {
    // ctx.memory - action's temporary memory
    // ctx.actionMemory - shared memory (if provided)
    // agent - the agent instance
    
    const results = await searchAPI(query);
    
    // Return structured response (XML protocol)
    return `<search_complete>
      <results_count>${results.length}</results_count>
      <next_action>Analyze the search results</next_action>
    </search_complete>`;
  }
});
```

### 4. **Memory Architecture** - Multi-Tier State Management

```typescript
// 1. Context Memory - Local to each agent instance
create: () => ({
  myState: "initial"
})

// 2. Action Memory - Temporary during action execution
handler(params, ctx) {
  ctx.memory.tempData = "processing";
}

// 3. Shared Memory - Persistent across all actions
export const sharedMemory = memory<MyMemoryType>({
  key: "shared-data",
  create: () => ({
    globalState: new Map(),
  })
});

// 4. Store - Long-term persistence
await agent.memory.store.set("key", value);
const value = await agent.memory.store.get("key");
```

### 5. **Working Memory** - Execution History

Automatically tracks all execution logs:

```typescript
type WorkingMemory = {
  inputs: InputRef[];      // User messages
  outputs: OutputRef[];    // Agent responses  
  thoughts: ThoughtRef[];  // Agent reasoning (<think> tags)
  calls: ActionCall[];     // Action invocations
  results: ActionResult[]; // Action results
  steps: StepRef[];        // LLM call steps
  runs: RunRef[];          // Complete execution runs
  events: EventRef[];      // System events
}
```

### 6. **Inputs & Outputs** - Platform Integration

Inputs and outputs are the bridge between your agent and the external world. They handle platform-specific integration while keeping agent logic platform-agnostic.

#### **Inputs** - How Agents Receive Data

```typescript
const webhookInput = {
  type: "webhook",
  
  // Optional: Setup when agent starts
  install: async (agent) => {
    // Initialize webhook server
  },
  
  // Optional: Subscribe to external events
  subscribe: async (handler, agent) => {
    webhookServer.on('request', (data) => {
      handler(
        context,         // Which context to use
        args,           // Context arguments
        data.body       // The actual input data
      );
    });
    
    // Return unsubscribe function
    return () => webhookServer.off('request');
  }
};
```

**InputRef Structure:**
```typescript
type InputRef = {
  id: string;
  ref: "input";
  type: string;        // "cli", "discord", "webhook", etc.
  content: string;     // The actual message
  data?: any;          // Additional metadata
  timestamp: number;
  processed: boolean;
}
```

#### **Outputs** - How Agents Send Responses

```typescript
const emailOutput = {
  type: "email",
  
  // Process and send the output
  handler: async (output, context, agent) => {
    await emailClient.send({
      to: context.args.userEmail,
      subject: "Agent Response",
      body: output.content
    });
  }
};
```

**OutputRef Structure:**
```typescript
type OutputRef = {
  id: string;
  ref: "output";
  type: string;        // "text", "email", "discord", etc.
  content: string;     // The response content
  data?: any;          // Additional metadata
  timestamp: number;
}
```

#### **Integration Flow:**
```
External Event → Input Handler → InputRef → Working Memory → 
Agent Processing → OutputRef → Output Handler → External System
```

#### **Common Examples:**

```typescript
// Via Extensions
const discordExtension = extension({
  name: "discord",
  inputs: {
    "discord-message": {
      type: "discord-message",
      subscribe: async (handler, agent) => {
        discordClient.on('message', (msg) => {
          handler(chatContext, { channelId: msg.channel.id }, msg.content);
        });
      }
    }
  },
  outputs: {
    "discord-reply": {
      type: "discord-reply",
      handler: async (output, context) => {
        const channel = await discordClient.channels.fetch(context.args.channelId);
        await channel.send(output.content);
      }
    }
  }
});

// Or directly on agent
const agent = createDreams({
  inputs: {
    "api": apiInput,
    "schedule": cronInput
  },
  outputs: {
    "api": apiOutput,
    "database": dbOutput
  }
});
```

## 🤝 Multi-Agent Patterns

### 1. **Lead-Subagent Architecture**

```typescript
// Lead agent orchestrates
const leadContext = context({
  type: "lead",
  render: ({ memory }) => {
    return `Status: ${memory.subagents.length} subagents working`;
  },
  instructions: "Coordinate research by delegating to subagents"
});

// Subagents execute specialized tasks
const subagentContext = context({
  type: "subagent",
  schema: z.object({ 
    taskId: z.string(), 
    role: z.string() 
  }),
  render: ({ args }) => {
    return `You are a ${args.role} working on task ${args.taskId}`;
  },
  instructions: "Execute your specialized task and report findings"
});

// Spawn subagent from within an action
await agent.run({
  context: subagentContext,
  args: { taskId: "123", role: "researcher" }
});
```

### 2. **Shared Memory for Coordination**

```typescript
// Define shared memory structure with TypeScript
type SharedMemoryType = {
  activeTasks: Map<string, Task>;
  results: Map<string, Result>;
};

// Create shared memory instance
const sharedMemory = memory<SharedMemoryType>({
  key: "coordination",
  create: () => ({
    activeTasks: new Map(),
    results: new Map(),
  })
});

// Actions can read/write shared memory
const coordinationAction = action({
  name: "coordinate",
  memory: sharedMemory,  // Attach shared memory
  handler(params, ctx) {
    // Access shared memory via ctx.actionMemory
    ctx.actionMemory.activeTasks.set(taskId, task);
    
    // Check other agents' work
    const otherResults = ctx.actionMemory.results;
  }
});
```

## 📝 XML Communication Protocol

Actions return XML-structured responses that guide agent behavior:

```xml
<action_complete>
  <status>success</status>
  
  <metrics>
    <processed>10</processed>
    <errors>0</errors>
  </metrics>
  
  <thinking>
    Need to analyze these results before proceeding
  </thinking>
  
  <next_action>
    Call analyzeResults with the processed data
  </next_action>
</action_complete>
```

**Common XML Patterns:**
- `<thinking>`: Embedded reasoning for the agent
- `<next_action>`: Explicit guidance for next steps
- `<error>`: Error states with troubleshooting
- `<status>`: Current state indicators
- Wrappers: `<complete>`, `<in_progress>`, `<failed>`

## 🛡️ Type Safety Patterns

### 1. **Zod Schemas Everywhere**

```typescript
// Context arguments
schema: z.object({ 
  userId: z.string().uuid(),
  sessionId: z.string().optional()
})

// Action parameters with descriptions
schema: z.object({
  query: z.string().describe("Search query"),
  limit: z.number()
    .min(1)
    .max(100)
    .default(10)
    .describe("Maximum results to return")
})
```

### 2. **TypeScript Types for Memory**

```typescript
// Define your types
type MyMemory = {
  sessions: Map<string, Session>;
  currentSession: Session | null;
};

// Use with contexts (type-safe)
const myContext = context({
  create: (): MyMemory => ({
    sessions: new Map(),
    currentSession: null,
  }),
  
  render: ({ memory }) => {
    // TypeScript knows the types!
    if (memory.currentSession) {
      return `Active: ${memory.currentSession.id}`;
    }
  }
});
```

### 3. **Type Flow Through System**

```
User Input 
  → Context Schema Validation
  → Context Memory (typed)
  → Action Schema Validation
  → Action Handler (typed params)
  → Shared Memory (typed)
  → Context Render (sees typed memory)
  → Agent Response
```

## 💡 Best Practices

### 1. **Context Design**
- ✅ Keep contexts focused on a single responsibility
- ✅ Use `render` for dynamic state display
- ✅ Put behavioral rules in `instructions`
- ✅ Initialize all memory fields in `create`
- ✅ Use meaningful `type` names

### 2. **Action Design**
- ✅ Actions should be atomic and focused
- ✅ Always validate inputs with Zod schemas
- ✅ Return structured XML for clarity
- ✅ Use shared memory for cross-action state
- ✅ Include error handling with helpful messages

### 3. **Memory Management**
- ✅ Context memory = agent-specific state
- ✅ Shared memory = cross-agent coordination
- ✅ Action memory = temporary execution state
- ✅ Store = long-term persistence
- ✅ Clean up memory when tasks complete

### 4. **Multi-Agent Coordination**
- ✅ Lead agent has clear orchestration logic
- ✅ Subagents have bounded responsibilities
- ✅ Use shared memory for task assignment/results
- ✅ Monitor progress through context rendering
- ✅ Handle subagent failures gracefully

### 5. **Error Handling**

```typescript
try {
  // Action logic
  const result = await riskyOperation();
  return `<success>${result}</success>`;
} catch (error) {
  return `<error>
    <message>${error.message}</message>
    <code>${error.code || 'UNKNOWN'}</code>
    <troubleshooting>
      1. Check API keys are set
      2. Verify network connection
      3. Ensure resource exists
    </troubleshooting>
    <next_action>
      Retry with exponential backoff or notify user
    </next_action>
  </error>`;
}
```

## 🔄 Common Patterns

### 1. **Progressive Task Execution**

```typescript
// Context tracks progress
create: () => ({
  stage: "init" as "init" | "processing" | "complete",
  results: [] as Result[],
  errors: [] as Error[]
})

// Render shows current stage
render: ({ memory }) => {
  switch(memory.stage) {
    case "init": 
      return "Ready to start processing";
    case "processing": 
      return `Processing ${memory.results.length} items...`;
    case "complete": 
      return `Task complete! Processed ${memory.results.length} items`;
  }
}
```

### 2. **Action Chaining**

```typescript
// Action 1 returns guidance
return `<search_complete>
  <found_items>${items.length}</found_items>
  <next_action>
    Call processResults with searchId: ${searchId}
  </next_action>
</search_complete>`;

// Agent reads next_action and calls Action 2
// This creates a workflow!
```

### 3. **Dynamic Context Creation**

```typescript
// Determine number of workers needed
const workerCount = Math.ceil(items.length / BATCH_SIZE);

// Spawn workers dynamically
for (let i = 0; i < workerCount; i++) {
  const batch = items.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
  
  await agent.run({
    context: workerContext,
    args: { 
      workerId: `worker-${i}`,
      items: batch 
    }
  });
}
```

## 📚 Complete Example: Q&A Agent

```typescript
import { createDreams, context, action, memory } from "@daydreamsai/core";
import { cliExtension } from "@daydreamsai/cli";
import { openrouter } from "@openrouter/ai-sdk-provider";
import * as z from "zod";

// Define memory type
type QAMemory = {
  questions: string[];
  answers: Map<string, string>;
  sources: Map<string, string[]>;
};

// Create context
const qaContext = context({
  type: "qa-assistant",
  schema: z.object({
    topic: z.string(),
    expertise: z.enum(["beginner", "intermediate", "expert"]).default("intermediate")
  }),
  create: (): QAMemory => ({
    questions: [],
    answers: new Map(),
    sources: new Map(),
  }),
  render: ({ memory, args }) => `
    You are a Q&A assistant specializing in ${args.topic}.
    Expertise level: ${args.expertise}
    Questions answered: ${memory.answers.size}
    
    Recent questions:
    ${memory.questions.slice(-3).join("\n- ")}
  `,
  instructions: `Answer questions accurately and adjust complexity based on expertise level.
  Always cite sources when possible.`
});

// Create action
const answerAction = action({
  name: "answer",
  description: "Research and answer a question",
  schema: z.object({
    question: z.string().min(5).describe("The question to answer"),
    depth: z.enum(["quick", "detailed"]).default("quick")
  }),
  async handler({ question, depth }, ctx, agent) {
    // Simulate research
    const answer = await researchAnswer(question, depth);
    const sources = await findSources(question);
    
    // Store in context memory
    const ctxMemory = await agent.getWorkingMemory(ctx.contextId);
    ctxMemory.questions.push(question);
    ctxMemory.answers.set(question, answer);
    ctxMemory.sources.set(question, sources);
    
    return `<answer_complete>
      <question>${question}</question>
      <answer>${answer}</answer>
      <sources>${sources.join(", ")}</sources>
      <confidence>${depth === "detailed" ? "high" : "medium"}</confidence>
      <thinking>
        User asked about ${question}. 
        Provided ${depth} answer with ${sources.length} sources.
      </thinking>
    </answer_complete>`;
  }
});

// Create agent
const agent = createDreams({
  model: openrouter("google/gemini-2.5-pro"),
  contexts: [qaContext],
  actions: [answerAction],
  extensions: [cliExtension],
});

// Run agent
await agent.start();
await agent.run({
  context: qaContext,
  args: { 
    topic: "TypeScript",
    expertise: "expert"
  }
});
```

## 🎓 Key Takeaways

1. **Contexts** = Agent personalities with state
2. **Actions** = Capabilities that modify state
3. **Memory** = Multi-tier state management
4. **Inputs/Outputs** = Platform integration bridges
5. **XML** = Structured communication protocol
6. **Types** = Zod for runtime, TypeScript for compile-time
7. **Multi-agent** = Spawn contexts, share memory

## 🤔 When Building with Daydreams, Ask Yourself:

1. **What contexts (agent types) do I need?**
   - What different "personalities" or roles?
   - What state does each need to track?

2. **What actions (capabilities) should they have?**
   - What external systems to interact with?
   - What computations or transformations?

3. **How should they coordinate (shared memory)?**
   - What information needs to be shared?
   - How do agents communicate results?

4. **What's the workflow (XML guidance)?**
   - How do actions chain together?
   - What decisions guide the flow?

## 🚀 Quick Start Checklist

- [ ] Define your agent's purpose and scope
- [ ] Create context(s) with appropriate state
- [ ] Design actions for required capabilities  
- [ ] Set up shared memory if multi-agent
- [ ] Implement error handling in actions
- [ ] Use XML to guide agent workflow
- [ ] Test with different scenarios
- [ ] Monitor memory usage and clean up

## 📖 Additional Resources

- See `/examples/` folder for complete implementations
- Multi-agent research example shows advanced patterns
- Use `CLAUDE.md` in your project for project-specific instructions
- TypeScript types in `@daydreamsai/core` for full API

---

*Remember: Daydreams makes agents stateful, type-safe, and collaborative. Think in contexts, actions, and memory!*