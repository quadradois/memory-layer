#!/usr/bin/env node
import { MemoryEngine } from "./core/engine";
import { StackConfig, MemoryLayerConfig } from "./core/types";

function parseGlobalArgs(args: string[]): { rest: string[]; dir: string } {
  const dirIdx = args.indexOf("--dir");
  let dir = ".";
  const filtered: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dir" && i + 1 < args.length) {
      dir = args[i + 1];
      i++;
    } else {
      filtered.push(args[i]);
    }
  }
  return { rest: filtered, dir };
}

async function main() {
  const { rest: args, dir } = parseGlobalArgs(process.argv.slice(2));
  const command = args[0];

  const config: Partial<MemoryLayerConfig> = { projectRoot: dir };
  if (dir !== ".") {
    config.memoryPath = `${dir}/.memory-layer`;
  }
  const engine = new MemoryEngine(config);

  if (!command || command === "help" || command === "--help") {
    showHelp();
    return;
  }

  try {
    runCommand(engine, command, args.slice(1));
  } catch (err: any) {
    console.error(`Erro: ${err.message}`);
    process.exit(1);
  }
}

function runCommand(engine: MemoryEngine, command: string, args: string[]): void {
  switch (command) {
    case "scan":
      cmdScan(engine);
      break;
    case "index":
      cmdIndex(engine);
      break;
    case "query":
    case "q":
      cmdQuery(engine, args.join(" "));
      break;
    case "analyze":
      cmdAnalyze(engine, args.join(" "));
      break;
    case "memory":
      cmdMemory(engine, args);
      break;
    case "stack":
      cmdStack(engine, args);
      break;
    default:
      console.log(`Comando desconhecido: "${command}". Use "ml help" para ajuda.`);
  }
}

async function cmdScan(engine: MemoryEngine): Promise<void> {
  console.log("Escaneando estrutura do projeto...");
  const graph = await engine.scan();
  console.log(`✓ Scan concluído: ${graph.files.size} arquivos, ${graph.edges.length} dependências`);
  console.log(`  Entry points: ${graph.entryPoints.join(", ") || "nenhum"}`);
  console.log(`  Módulos: ${graph.modules.length}`);
}

async function cmdIndex(engine: MemoryEngine): Promise<void> {
  console.log("Indexando semântica do projeto...");
  const indices = await engine.index();
  console.log(`✓ Indexação concluída: ${indices.length} arquivos indexados`);
}

function cmdQuery(engine: MemoryEngine, query: string): void {
  if (!query) {
    console.log("Uso: ml query <sua pergunta>");
    return;
  }
  console.log(`Consultando: "${query}"\n`);
  const result = engine.query(query);
  console.log(result.context);
}

function cmdAnalyze(engine: MemoryEngine, query: string): void {
  if (!query) {
    console.log("Uso: ml analyze <descrição da tarefa>");
    return;
  }
  console.log(`Analisando: "${query}"\n`);
  const context = engine.analyze(query);
  console.log(context);
}

function cmdMemory(engine: MemoryEngine, args: string[]): void {
  const sub = args[0];

  if (sub === "show" || !sub) {
    const memory = engine.getMemory();
    console.log("=== MEMÓRIA ARQUITETURAL ===\n");
    if (memory.stack.frontend || memory.stack.backend) {
      console.log("Stack:");
      console.log(`  ${JSON.stringify(memory.stack, null, 2)}`);
    }
    if (memory.decisions.length > 0) {
      console.log(`\nDecisões (${memory.decisions.length}):`);
      memory.decisions.forEach(d => console.log(`  [${d.category}] ${d.title} (${d.date.slice(0, 10)})`));
    }
    if (memory.rules.length > 0) {
      console.log(`\nRegras (${memory.rules.length}):`);
      memory.rules.forEach(r => console.log(`  • ${r}`));
    }
    if (memory.antiPatterns.length > 0) {
      console.log(`\nAnti-patterns (${memory.antiPatterns.length}):`);
      memory.antiPatterns.forEach(a => console.log(`  ⚠ ${a}`));
    }
    if (memory.patterns.length > 0) {
      console.log(`\nPadrões (${memory.patterns.length}):`);
      memory.patterns.forEach(p => console.log(`  ✓ ${p}`));
    }
  } else if (sub === "decision") {
    const title = args[1];
    const content = args.slice(2).join(" ");
    if (!title || !content) {
      console.log("Uso: ml memory decision <título> <descrição>");
      return;
    }
    engine.addDecision({ title, description: content, category: "decision", scope: "global", content });
    console.log("✓ Decisão registrada");
  } else if (sub === "rule") {
    const rule = args.slice(1).join(" ");
    if (!rule) {
      console.log("Uso: ml memory rule <descrição da regra>");
      return;
    }
    engine.addDecision({ title: `Regra: ${rule.slice(0, 50)}`, description: rule, category: "rule", scope: "global", content: rule });
    console.log("✓ Regra registrada");
  } else {
    console.log("Subcomandos: show, decision, rule");
  }
}

function cmdStack(engine: MemoryEngine, args: string[]): void {
  if (args.length === 0) {
    const memory = engine.getMemory();
    console.log("Stack atual:", JSON.stringify(memory.stack, null, 2));
    return;
  }

  const fileIdx = args.indexOf("--file");
  if (fileIdx >= 0 && fileIdx + 1 < args.length) {
    const fs = require("fs");
    const content = fs.readFileSync(args[fileIdx + 1], "utf-8");
    try {
      const stack: StackConfig = JSON.parse(content);
      engine.setStack(stack);
      console.log("✓ Stack configurada de " + args[fileIdx + 1]);
      return;
    } catch (e: any) {
      console.log("Erro ao ler arquivo: " + e.message);
      return;
    }
  }

  const json = args.join(" ");
  try {
    const stack: StackConfig = JSON.parse(json);
    engine.setStack(stack);
    console.log("✓ Stack configurada");
  } catch {
    console.log("Forneça a stack como JSON inline ou use --file <caminho>. Exemplo:");
    console.log('  ml stack \'{"frontend":{"framework":"React"}}\'');
    console.log("  ml stack --file stack.json");
  }
}

function showHelp(): void {
  console.log(`
╔══════════════════════════════════════════════╗
║     Memory Layer for AI Development CLI      ║
╚══════════════════════════════════════════════╝

USO:
  ml [--dir <path>] scan                   Escaneia estrutura do projeto
  ml [--dir <path>] index                  Indexa semântica do código
  ml [--dir <path>] query <texto>          Consulta o sistema de memória
  ml [--dir <path>] analyze <tarefa>       Análise completa com contexto arquitetural
  ml [--dir <path>] memory [subcomando]    Gerencia memória arquitetural
  ml [--dir <path>] stack [json|--file <caminho>] Configura ou exibe a stack oficial

EXEMPLOS:
  ml --dir meu-projeto scan
  ml --dir meu-projeto index
  ml --dir meu-projeto query "Adicionar sistema de notificações"
  ml --dir meu-projeto analyze "Criar módulo de usuários com CRUD"
  ml --dir meu-projeto memory decision "Usar NestJS modular" "Todo backend deve seguir módulos NestJS"
  ml --dir meu-projeto memory rule "Nunca usar any - prefira tipos explícitos"
  ml --dir meu-projeto stack --file stack.json
`);
}

main();
