import EventSource from "eventsource";

export class MCPClient {
  private url: string;
  private es: EventSource | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect() {
    console.log("🟦 [INIT] Connecting to MCP SSE:", this.url);
    this.es = new EventSource(this.url);

    this.es.onopen = () => {
      console.log("🟩 [MCP] SSE connection opened");
    };

    this.es.onerror = (err) => {
      console.error("🟥 [ERROR] MCP SSE error:", err);
    };
  }

  async listTools(timeoutMs = 3000): Promise<any[] | null> {
  console.log("🟩 [MCP] Attempting tool discovery (optional)");

  return new Promise((resolve) => {
    if (!this.es) {
      console.warn("🟨 [MCP] No SSE connection, skipping discovery");
      resolve(null);
      return;
    }

    const timeout = setTimeout(() => {
      console.warn("🟨 [MCP] Tool discovery not supported, continuing without it");
      this.es?.removeEventListener("message", handler as any);
      resolve(null); // 👈 IMPORTANT
    }, timeoutMs);

    const payload = {
      type: "tool_call",
      name: "tools/list",
      body: {}
    };

    fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => {
      clearTimeout(timeout);
      resolve(null);
    });

    const handler = (event: MessageEvent) => {
        console.log("🟩 [MCP] SSE message received:", event.data);

      const data = JSON.parse(event.data);

      if (data.name === "tools/list") {
        clearTimeout(timeout);
        this.es?.removeEventListener("message", handler as any);
        console.log("🟩 [MCP] Tools discovered:", data.body);
        resolve(data.body);
      }
    };

    this.es.addEventListener("message", handler as any);
  });
}



  async callTool(name: string, body: any, timeoutMs = 5000): Promise<any> {
    console.log(`🟩 [MCP] Calling tool '${name}' with body:`, body);

    return new Promise((resolve, reject) => {
      if (!this.es) {
        reject(new Error("MCP not connected"));
        return;
      }

      const timeout = setTimeout(() => {
        console.error(`🟥 [ERROR] MCP tool '${name}' timed out`);
        this.es?.removeEventListener("message", handler as any);
        reject(new Error(`MCP tool '${name}' timeout`));
      }, timeoutMs);

      const payload = {
        type: "tool_call",
        name,
        body
      };

      fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const handler = (event: MessageEvent) => {
        console.log("🟩 [MCP] SSE message received:", event.data);

        const data = JSON.parse(event.data);

        if (data.name === name) {
          clearTimeout(timeout);
          this.es?.removeEventListener("message", handler as any);

          console.log(`🟩 [MCP] Tool '${name}' response:`, data.body);
          resolve(data.body);
        }
      };

      this.es.addEventListener("message", handler as any);
    });
  }
}
