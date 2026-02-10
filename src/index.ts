import readline from "readline";
import { runAgent, resetConversation, getConversationState } from "./agent/runtime";
import { initMcp } from "./mcp/toolRouter";

const MCP_BASE_URL = "http://localhost:3000/mcp".replace(/\/mcp$/, "");

async function bootstrap() {
  console.log("🚀 Starting AI Agent Framework...\n");

  await initMcp(MCP_BASE_URL);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("💬 Agent ready! I can help you with your MCP tools.");
  console.log("📝 Commands:");
  console.log("   - Type your request normally");
  console.log("   - Type '/reset' to clear conversation history");
  console.log("   - Type '/status' to see conversation state");
  console.log("   - Type '/quit' or Ctrl+C to exit\n");

  rl.on("line", async (line) => {
    const input = line.trim();

    if (!input) {
      return;
    }

    // Handle special commands
    if (input === "/reset") {
      resetConversation();
      console.log("✅ Conversation reset. Starting fresh!\n");
      return;
    }

    if (input === "/status") {
      const state = getConversationState();
      console.log("📊 Conversation State:");
      console.log(`   - Messages in history: ${state.historyLength}`);
      console.log(`   - Cached tool results: ${state.cachedResults}`);
      console.log();
      return;
    }

    if (input === "/quit") {
      console.log("\n👋 Goodbye!");
      process.exit(0);
    }

    try {
      console.log(); // Blank line for readability
      const result = await runAgent(input);
      console.log("\n🤖 Assistant:", result);
      console.log(); // Blank line for readability
    } catch (e: any) {
      console.error("\n❌ Error:", e.message);
      console.log();
    }
  });

  process.on("SIGINT", () => {
    console.log("\n\n👋 Shutting down gracefully...");
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});