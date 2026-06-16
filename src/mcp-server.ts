#!/usr/bin/env node
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MemoryEngine } from "./core/engine";
import { StackConfig, MemoryLayerConfig } from "./core/types";

/**
 * Memory Layer MCP server.
 *
 * Expõe o MemoryEngine como ferramentas que o Claude Code (ou qualquer cliente
 * MCP) pode chamar nativamente. O estado vive em disco (.memory-layer/*.json),
 * então cada chamada cria um engine apontado ao diretório do projeto-alvo —
 * é barato e mantém os comandos sem estado compartilhado.
 */

function makeEngine(dir: string): MemoryEngine {
  const projectRoot = dir && dir.trim() ? dir : ".";
  const config: Partial<MemoryLayerConfig> = {
    projectRoot,
    memoryPath: path.join(projectRoot, ".memory-layer"),
  };
  return new MemoryEngine(config);
}

function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: `Erro: ${message}` }], isError: true };
}

const DIR = z
  .string()
  .default(".")
  .describe("Caminho da raiz do projeto-alvo. Use '.' para o diretório atual do workspace.");

const server = new McpServer({ name: "memory-layer", version: "0.1.0" });

server.registerTool(
  "memory_scan",
  {
    description:
      "Escaneia a estrutura do projeto: arquivos, imports/exports, funções, classes, grafo de dependências e módulos. Rode antes de index/query. Persiste em .memory-layer/graph.json.",
    inputSchema: { dir: DIR },
  },
  async ({ dir }) => {
    try {
      const graph = await makeEngine(dir).scan();
      return text(
        [
          `✓ Scan concluído em "${dir}"`,
          `Arquivos: ${graph.files.size}`,
          `Dependências: ${graph.edges.length}`,
          `Módulos: ${graph.modules.length}`,
          `Entry points: ${graph.entryPoints.join(", ") || "nenhum"}`,
        ].join("\n")
      );
    } catch (e: any) {
      return fail(e.message);
    }
  }
);

server.registerTool(
  "memory_index",
  {
    description:
      "Indexa semanticamente o projeto (propósito, intenção, responsabilidade, domínio e tags por arquivo). Requer um scan prévio. Persiste em .memory-layer/semantic-index.json.",
    inputSchema: { dir: DIR },
  },
  async ({ dir }) => {
    try {
      const indices = await makeEngine(dir).index();
      return text(`✓ Indexação concluída em "${dir}": ${indices.length} arquivos indexados.`);
    } catch (e: any) {
      return fail(e.message);
    }
  }
);

server.registerTool(
  "memory_init",
  {
    description:
      "Conveniência: roda scan + index em sequência. Ideal como primeiro passo ao abrir um projeto novo.",
    inputSchema: { dir: DIR },
  },
  async ({ dir }) => {
    try {
      const engine = makeEngine(dir);
      const graph = await engine.scan();
      const indices = await engine.index();
      return text(
        `✓ Memory Layer inicializada em "${dir}": ${graph.files.size} arquivos, ${graph.edges.length} dependências, ${graph.modules.length} módulos, ${indices.length} indexados.`
      );
    } catch (e: any) {
      return fail(e.message);
    }
  }
);

server.registerTool(
  "memory_query",
  {
    description:
      "Consulta o grafo/índice e devolve o contexto arquitetural relevante (arquivos, módulos, decisões e regras) para uma tarefa. Requer scan + index prévios.",
    inputSchema: {
      dir: DIR,
      query: z.string().describe("A pergunta ou tarefa, ex.: 'Adicionar autenticação por refresh token'."),
    },
  },
  async ({ dir, query }) => {
    try {
      const result = makeEngine(dir).query(query);
      return text(result.context);
    } catch (e: any) {
      return fail(e.message);
    }
  }
);

server.registerTool(
  "memory_analyze",
  {
    description:
      "Como memory_query, mas retorna um relatório de contexto formatado e detalhado (com scores e razões) para a tarefa descrita. Use para alimentar o LLM antes de implementar.",
    inputSchema: {
      dir: DIR,
      task: z.string().describe("Descrição da tarefa, ex.: 'Criar módulo de usuários com CRUD'."),
    },
  },
  async ({ dir, task }) => {
    try {
      return text(makeEngine(dir).analyze(task));
    } catch (e: any) {
      return fail(e.message);
    }
  }
);

server.registerTool(
  "memory_show",
  {
    description:
      "Mostra a memória arquitetural persistida: stack oficial, decisões, regras, anti-patterns e padrões.",
    inputSchema: { dir: DIR },
  },
  async ({ dir }) => {
    try {
      const m = makeEngine(dir).getMemory();
      return text(JSON.stringify(m, null, 2));
    } catch (e: any) {
      return fail(e.message);
    }
  }
);

server.registerTool(
  "memory_set_stack",
  {
    description:
      "Define a stack oficial do projeto (frontend/backend/mobile/infra), incluindo tecnologias proibidas/permitidas. Essas regras entram no contexto retornado pelas queries.",
    inputSchema: {
      dir: DIR,
      stack: z
        .string()
        .describe(
          'JSON da stack. Ex.: {"frontend":{"framework":"React","styling":"Tailwind","forbidden":["Material UI"]},"backend":{"architecture":"modular","framework":"NestJS"}}'
        ),
    },
  },
  async ({ dir, stack }) => {
    try {
      const parsed: StackConfig = JSON.parse(stack);
      makeEngine(dir).setStack(parsed);
      return text("✓ Stack configurada.");
    } catch (e: any) {
      return fail(`stack inválida (JSON): ${e.message}`);
    }
  }
);

server.registerTool(
  "memory_add_decision",
  {
    description:
      "Registra uma decisão/regra/convenção/anti-pattern arquitetural na memória persistente do projeto.",
    inputSchema: {
      dir: DIR,
      title: z.string().describe("Título curto da decisão."),
      content: z.string().describe("Descrição/conteúdo da decisão."),
      category: z
        .enum(["pattern", "convention", "rule", "anti-pattern", "decision"])
        .default("decision")
        .describe("Categoria da decisão."),
      scope: z.enum(["global", "module", "domain"]).default("global").describe("Escopo de aplicação."),
    },
  },
  async ({ dir, title, content, category, scope }) => {
    try {
      makeEngine(dir).addDecision({ title, description: content, content, category, scope });
      return text(`✓ Decisão registrada: [${category}] ${title}`);
    } catch (e: any) {
      return fail(e.message);
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout é reservado ao protocolo MCP; logs vão para stderr.
  console.error("memory-layer MCP server pronto (stdio).");
}

main().catch((err) => {
  console.error("Falha ao iniciar memory-layer MCP server:", err);
  process.exit(1);
});
