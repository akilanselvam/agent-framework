// src/agent/schema.ts
export type AgentResponse =
  | {
      type: "tool_call";
      name: string;
      body: any;
    }
  | {
      type: "message";
      content: string;
    }
  | {
      type: "final";
      content: string;
    };

export type ConversationMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ConversationContext = {
  messages: ConversationMessage[];
  toolResults: Map<string, any>;
  currentTask: string | null;
};