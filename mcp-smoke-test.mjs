import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/mcp-server.js"],
});

const client = new Client({ name: "smoke-test", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

async function call(name, args) {
  const res = await client.callTool({ name, arguments: args });
  console.log(`\n=== ${name}(${JSON.stringify(args)}) ===`);
  console.log(res.content.map((c) => c.text).join("\n"));
  if (res.isError) console.log("[isError=true]");
}

await call("memory_init", { dir: "test-project" });
await call("memory_set_stack", {
  dir: "test-project",
  stack: JSON.stringify({ frontend: { framework: "React", styling: "Tailwind", forbidden: ["Material UI"] }, backend: { architecture: "modular", framework: "NestJS" } }),
});
await call("memory_query", { dir: "test-project", query: "Adicionar autenticação por refresh token" });
await call("memory_analyze", { dir: "test-project", task: "add user authentication service" });
await call("memory_analyze", { dir: "test-project", task: "Criar sistema de pagamento" });

await client.close();
console.log("\n✓ smoke test OK");
process.exit(0);
