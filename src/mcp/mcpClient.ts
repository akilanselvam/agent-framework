import EventSource from "eventsource";

type Pending = {
  resolve: (value: any) => void;
  reject: (err: Error) => void;
};

export class MCPClient {
  private baseUrl: string;
  private sseUrl: string;
  private messagesUrl: string;

  private es: EventSource | null = null;
  private sessionId: string | null = null;
  private messageId = 1;
  private pending = new Map<number, Pending>();
  private useSessionId = false; // Flag to track if server requires sessionId

  constructor(baseUrl: string) {
    // baseUrl WITHOUT /mcp
    this.baseUrl = baseUrl.replace(/\/mcp$/, "");
    this.sseUrl = `${this.baseUrl}/mcp`;
    this.messagesUrl = `${this.baseUrl}/messages`;
  }

  async connect(): Promise<void> {
    console.log(`📡 [MCP] Connecting SSE → ${this.sseUrl}`);

    return new Promise((resolve, reject) => {
      this.es = new EventSource(this.sseUrl);

      let connected = false;
      const timeout = setTimeout(() => {
        if (!connected) {
          console.warn("⚠️ [MCP] No session event received, assuming legacy protocol");
          connected = true;
          this.useSessionId = false;
          this.setupMessageHandler();
          resolve();
        }
      }, 2000); // Wait 2 seconds for session event

      this.es.onopen = () => {
        console.log("✅ [MCP] SSE connection opened");
      };

      // Listen for the session event (new protocol)
      this.es.addEventListener("session", (event: MessageEvent) => {
        if (connected) return;
        
        const sessionId = event.data.trim();
        this.sessionId = sessionId;
        this.useSessionId = true;
        connected = true;
        clearTimeout(timeout);
        console.log(`🔑 [MCP] Received session ID: ${sessionId}`);
        
        this.setupMessageHandler();
        resolve();
      });

      this.es.onerror = (err) => {
        console.error("❌ [MCP] SSE error", err);
        if (!connected) {
          clearTimeout(timeout);
          reject(new Error("SSE connection error"));
        }
      };
    });
  }

  private setupMessageHandler() {
    if (!this.es) return;

    this.es.onmessage = (event) => {
      console.log("⬅️ [MCP] SSE message:", event.data);

      try {
        const msg = JSON.parse(event.data);

        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);

          if (msg.error) {
            reject(new Error(msg.error.message || "MCP RPC error"));
          } else {
            resolve(msg.result ?? msg);
          }
        }
      } catch (err) {
        console.error("❌ [MCP] Failed to parse SSE message", err);
      }
    };
  }

  private async rpc(method: string, params: any = {}): Promise<any> {
    if (this.useSessionId && !this.sessionId) {
      throw new Error("No session ID available. Connection not established.");
    }

    const id = this.messageId++;

    console.log(`🔧 [MCP] RPC → ${method} (id=${id})`, params);

    const payload = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };

    const promise = new Promise<any>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });

      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`RPC timeout: ${method}`));
        }
      }, 10_000);
    });

    // Include sessionId as query parameter if required
    const url = this.useSessionId && this.sessionId
      ? `${this.messagesUrl}?sessionId=${this.sessionId}`
      : this.messagesUrl;

    console.log(`📤 [MCP] Sending to: ${url}`);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    return promise;
  }

  // ---- MCP Standard Methods ----

  async initialize(): Promise<void> {
    console.log("🔄 [MCP] Initializing MCP connection...");
    await this.rpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "agent-framework",
        version: "1.0.0"
      }
    });
    console.log("✅ [MCP] Initialization complete");
  }

  async listTools(): Promise<any[]> {
    console.log("🔍 [MCP] Listing available tools...");
    const res = await this.rpc("tools/list");
    const tools = res.tools ?? res.result?.tools ?? [];
    console.log(`📋 [MCP] Found ${tools.length} tools`);
    return tools;
  }

  async callTool(name: string, args: any): Promise<any> {
    console.log(`🛠️ [MCP] Calling tool: ${name}`);
    const result = await this.rpc("tools/call", {
      name,
      arguments: args
    });
    console.log(`✅ [MCP] Tool ${name} completed`);
    return result;
  }

  close() {
    if (this.es) {
      this.es.close();
      console.log("👋 [MCP] SSE closed");
    }
    this.sessionId = null;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  isUsingSessionId(): boolean {
    return this.useSessionId;
  }
}
