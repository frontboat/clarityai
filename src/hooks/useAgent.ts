import { useState, useEffect, useCallback, useRef } from 'react';
import { adaptiveVideoAgent } from '../agent';

interface AgentState {
  isConnected: boolean;
  currentContext: string | null;
  isThinking: boolean;
}

interface AgentHook {
  agent: typeof adaptiveVideoAgent | null;
  sendMessage: ((message: string) => Promise<void>) | null;
  callAction: ((actionName: string, data: any) => Promise<any>) | null;
  agentState: AgentState;
  isConnected: boolean;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
}

export const useAgent = (): AgentHook => {
  const [agent, setAgent] = useState<typeof adaptiveVideoAgent | null>(null);
  const [agentState, setAgentState] = useState<AgentState>({
    isConnected: false,
    currentContext: null,
    isThinking: false,
  });
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>>([]);
  
  const agentRef = useRef<typeof adaptiveVideoAgent | null>(null);
  const userId = useRef(`user-${Date.now()}`);

  // Initialize agent connection
  useEffect(() => {
    const initAgent = async () => {
      try {
        // Start the agent
        await adaptiveVideoAgent.start();
        
        setAgent(adaptiveVideoAgent);
        agentRef.current = adaptiveVideoAgent;
        
        setAgentState(prev => ({
          ...prev,
          isConnected: true,
        }));

        console.log('Agent initialized successfully');
      } catch (error) {
        console.error('Failed to initialize agent:', error);
        setAgentState(prev => ({
          ...prev,
          isConnected: false,
        }));
      }
    };

    initAgent();

    return () => {
      // Cleanup if needed
      agentRef.current = null;
    };
  }, []);

  // Send message to agent and handle response
  const sendMessage = useCallback(async (message: string) => {
    if (!agentRef.current || !agentState.isConnected) {
      console.warn('Agent not connected');
      return;
    }

    try {
      setAgentState(prev => ({ ...prev, isThinking: true }));
      
      // Add user message to chat
      setMessages(prev => [...prev, {
        role: 'user',
        content: message,
        timestamp: Date.now(),
      }]);

      // Send to user profile context
      const result = await agentRef.current.send({
        context: adaptiveVideoAgent.contexts.find(c => c.type === 'user-profile'),
        args: { userId: userId.current },
        input: {
          type: 'user-message',
          data: { content: message },
        },
      });

      // Process agent response
      if (result && typeof result === 'object') {
        // Look for assistant responses in the result
        const assistantResponses = extractAssistantResponses(result);
        
        assistantResponses.forEach(response => {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: response,
            timestamp: Date.now(),
          }]);
        });
      }

    } catch (error) {
      console.error('Error sending message to agent:', error);
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message.',
        timestamp: Date.now(),
      }]);
    } finally {
      setAgentState(prev => ({ ...prev, isThinking: false }));
    }
  }, [agentState.isConnected]);

  // Call specific agent action
  const callAction = useCallback(async (actionName: string, data: any) => {
    if (!agentRef.current || !agentState.isConnected) {
      console.warn('Agent not connected');
      return null;
    }

    try {
      setAgentState(prev => ({ ...prev, isThinking: true }));

      // Find the appropriate context based on action
      let targetContext;
      
      if (actionName.includes('transitionToFeature') || actionName.includes('predictNextFeature')) {
        targetContext = adaptiveVideoAgent.contexts.find(c => c.type === 'interface');
      } else if (actionName.includes('learnUserBehavior')) {
        targetContext = adaptiveVideoAgent.contexts.find(c => c.type === 'user-profile');
      } else if (actionName.includes('editTimeline') || actionName.includes('editStoryboard')) {
        targetContext = adaptiveVideoAgent.contexts.find(c => c.type === 'editing-session');
      } else {
        targetContext = adaptiveVideoAgent.contexts.find(c => c.type === 'user-profile');
      }

      const result = await agentRef.current.send({
        context: targetContext,
        args: { 
          userId: userId.current,
          sessionId: `session-${userId.current}`,
        },
        input: {
          type: 'action-call',
          data: { actionName, ...data },
        },
      });

      return result;

    } catch (error) {
      console.error(`Error calling action ${actionName}:`, error);
      return { error: error.message };
    } finally {
      setAgentState(prev => ({ ...prev, isThinking: false }));
    }
  }, [agentState.isConnected]);

  return {
    agent,
    sendMessage,
    callAction,
    agentState,
    isConnected: agentState.isConnected,
    messages,
  };
};

// Helper function to extract assistant responses from agent result
function extractAssistantResponses(result: any): string[] {
  const responses: string[] = [];

  if (typeof result === 'string') {
    responses.push(result);
  } else if (Array.isArray(result)) {
    // Look for output or response entries
    result.forEach(entry => {
      if (entry?.type === 'output' && entry?.content) {
        responses.push(entry.content);
      } else if (entry?.type === 'response' && entry?.content) {
        responses.push(entry.content);
      } else if (typeof entry === 'string') {
        responses.push(entry);
      }
    });
  } else if (result && typeof result === 'object') {
    // Look for common response fields
    if (result.content) {
      responses.push(result.content);
    } else if (result.message) {
      responses.push(result.message);
    } else if (result.response) {
      responses.push(result.response);
    }
  }

  return responses.filter(r => r && r.trim().length > 0);
} 