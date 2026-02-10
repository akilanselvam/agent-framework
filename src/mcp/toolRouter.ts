import { MCPClient } from "./mcpClient";

let mcp: MCPClient;
let availableTools: any[] = [];

export async function initMcp(baseUrl: string) {
  console.log("🟦 [INIT] Initializing MCP adapter");

  mcp = new MCPClient(baseUrl);

  await mcp.connect();
  await mcp.initialize();

  availableTools = await mcp.listTools();

  console.log(
    "🟦 [INIT] MCP tools loaded:",
    availableTools.map(t => t.name)
  );
}

export function getAvailableTools() {
  return availableTools;
}

export async function executeTool(name: string, args: any) {
  const tool = availableTools.find(t => t.name === name);
  if (!tool) {
    throw new Error(`Tool '${name}' not available in MCP`);
  }

  console.log(`🟩 [MCP] Executing tool '${name}'`);
  return mcp.callTool(name, args);
}
