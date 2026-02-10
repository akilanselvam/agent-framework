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
  private messageId = 1;
  private pending = new Map<number, Pending>();

  constructor(baseUrl: string) {
    // baseUrl WITHOUT /mcp
    this.baseUrl = baseUrl.replace(/\/mcp$/, "");
    this.sseUrl = `${this.baseUrl}/mcp`;
    this.messagesUrl = `${this.baseUrl}/messages`;
  }

  async connect(): Promise<void> {
    console.log(`📡 [MCP] Connecting SSE → ${this.sseUrl}`);

    this.es = new EventSource(this.sseUrl);

    this.es.onopen = () => {
      console.log("✅ [MCP] SSE connected");
    };

    this.es.onmessage = (event) => {
      console.log("⬅ [MCP] SSE message:", event.data);

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

    this.es.onerror = (err) => {
      console.error("❌ [MCP] SSE error", err);
    };

    // Give SSE a moment to establish
    await new Promise((r) => setTimeout(r, 300));
  }

  private async rpc(method: string, params: any = {}): Promise<any> {
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

    const res = await fetch(this.messagesUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }

    return promise;
  }

  // ---- MCP Standard Methods ----

  async initialize(): Promise<void> {
    await this.rpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "agent-framework",
        version: "1.0.0"
      }
    });
  }

  async listTools(): Promise<any[]> {
    const res = await this.rpc("tools/list");
    return res.tools ?? res.result?.tools ?? [];
  }

  async callTool(name: string, args: any): Promise<any> {
    return this.rpc("tools/call", {
      name,
      arguments: args
    });
  }

  close() {
    if (this.es) {
      this.es.close();
      console.log("👋 [MCP] SSE closed");
    }
  }
}
