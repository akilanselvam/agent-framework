import { callAI } from "../ai/client";
import { executeTool, getAvailableTools } from "../mcp/toolRouter";
import { AgentResponse, ConversationMessage } from "./schema";

// Global conversation context that persists across user inputs
let conversationHistory: ConversationMessage[] = [];
let toolResultsCache: Map<string, any> = new Map();

export async function runAgent(input: string): Promise<string> {
  console.log("🟨 [AGENT] Starting agent run");
  console.log("🟨 [AGENT] User input:", input);

  const tools = getAvailableTools();

  if (!tools || tools.length === 0) {
    throw new Error("No MCP tools available. Agent cannot proceed.");
  }

  console.log(
    "🟨 [AGENT] Available tools:",
    tools.map((t) => t.name)
  );

  // Initialize conversation with system context only once
  if (conversationHistory.length === 0) {
    conversationHistory.push({
      role: "system",
      content:
        "You can ONLY use the following MCP tools.\n" +
        JSON.stringify(tools, null, 2),
    });
  }

  // Add user's new message to conversation history
  conversationHistory.push({
    role: "user",
    content: input,
  });

  let iterations = 0;
  const MAX_ITERATIONS = 15;
  let lastMessage = "";

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    console.log(`🟨 [AGENT] Iteration ${iterations}`);

    const response: AgentResponse = await callAI(conversationHistory);

    console.log("🟨 [AGENT] AI response:", response);

    if (response.type === "tool_call") {
      console.log(
        `🟨 [AGENT] AI requested tool '${response.name}' with body:`,
        response.body
      );

      // Check if this exact tool call was already made recently
      const toolCallKey = `${response.name}:${JSON.stringify(response.body)}`;
      if (toolResultsCache.has(toolCallKey)) {
        console.log("⚠️  [AGENT] Duplicate tool call detected, skipping");
        
        // Add the cached result to conversation
        conversationHistory.push({
          role: "assistant",
          content: JSON.stringify({
            type: "tool_call",
            tool: response.name,
            result: toolResultsCache.get(toolCallKey),
            note: "Using cached result",
          }),
        });
        continue;
      }

      try {
        const result = await executeTool(response.name, response.body);

        // Cache the tool result
        toolResultsCache.set(toolCallKey, result);

        // Add tool call and result to conversation
        conversationHistory.push({
          role: "assistant",
          content: JSON.stringify({
            type: "tool_call",
            tool: response.name,
            result: result,
          }),
        });

        console.log(`✅ [AGENT] Tool '${response.name}' executed successfully`);
      } catch (err: any) {
        console.error(
          `🟥 [ERROR] Tool '${response.name}' failed:`,
          err.message
        );

        conversationHistory.push({
          role: "assistant",
          content: JSON.stringify({
            type: "tool_call",
            tool: response.name,
            error: err.message,
          }),
        });
      }

      continue;
    }

    if (response.type === "message") {
      console.log("💬 [AGENT] AI message to user:", response.content);
      
      // Add AI's message to conversation history
      conversationHistory.push({
        role: "assistant",
        content: response.content,
      });

      lastMessage = response.content;
      
      // Return to user and wait for their response
      return response.content;
    }

    if (response.type === "final") {
      console.log("🟨 [AGENT] Final response produced");
      
      // Add final response to history
      conversationHistory.push({
        role: "assistant",
        content: response.content,
      });

      // Clear context for next conversation
      console.log("🧹 [AGENT] Clearing conversation context");
      conversationHistory = [];
      toolResultsCache.clear();

      return response.content;
    }

    throw new Error("Invalid AI response type: " + JSON.stringify(response));
  }

  throw new Error("Agent exceeded max iterations");
}

// Function to reset conversation manually if needed
export function resetConversation() {
  console.log("🔄 [AGENT] Manually resetting conversation");
  conversationHistory = [];
  toolResultsCache.clear();
}

// Function to view current conversation state (for debugging)
export function getConversationState() {
  return {
    historyLength: conversationHistory.length,
    cachedResults: toolResultsCache.size,
    history: conversationHistory,
  };
}