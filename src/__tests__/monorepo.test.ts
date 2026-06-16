import { describe, it, expect } from "vitest";
import * as path from "path";
import { ProjectScanner } from "../scanner/project-scanner";
import { DependencyGraph } from "../scanner/dependency-graph";
import { SemanticIndexer } from "../indexer/semantic-indexer";
import { IntelligentRetriever } from "../retrieval/intelligent-retriever";
import { MemoryLayerConfig, DEFAULT_CONFIG, ProjectGraph, RetrievalQuery } from "../core/types";

const FIXTURE = path.resolve(__dirname, "fixtures", "monorepo");

function makeConfig(): MemoryLayerConfig {
  return {
    ...DEFAULT_CONFIG,
    projectRoot: FIXTURE,
    memoryPath: path.join(FIXTURE, ".memory-layer"),
    supportedExtensions: [".ts", ".tsx", ".js"],
  };
}

async function buildGraph(): Promise<ProjectGraph> {
  const config = makeConfig();
  const scanner = new ProjectScanner(config);
  const files = await scanner.scan(FIXTURE);
  const dg = new DependencyGraph();
  dg.setRootDir(FIXTURE);
  for (const f of files) dg.addFile(f);
  return dg.build();
}

describe("Layer 1 — Scanner", () => {
  it("escaneia arquivos do monorepo", async () => {
    const graph = await buildGraph();
    // 12 source files + tsconfig/package.json count as supported extensions too
    expect(graph.files.size).toBeGreaterThanOrEqual(10);
  });

  it("detecta imports cross-package (@rancho-delivery/shared)", async () => {
    const graph = await buildGraph();
    const asaasFile = graph.files.get("apps/backend/src/services/asaas.service.ts");
    expect(asaasFile).toBeDefined();
    const hasCrossImport = asaasFile!.imports.some(i => i.includes("@rancho-delivery/shared"));
    expect(hasCrossImport).toBe(true);
  });

  it("detecta imports com path alias (@/)", async () => {
    const graph = await buildGraph();
    const pageFile = graph.files.get("apps/frontend/src/app/page.tsx");
    expect(pageFile).toBeDefined();
    const hasAlias = pageFile!.imports.some(i => i.startsWith("@/"));
    expect(hasAlias).toBe(true);
  });
});

describe("Layer 1 — DependencyGraph", () => {
  it("resolve import com path alias @/lib/api-client", async () => {
    const graph = await buildGraph();
    const dep = graph.edges.find(e =>
      e.from === "apps/frontend/src/app/page.tsx" &&
      e.to === "apps/frontend/src/lib/api-client.ts"
    );
    expect(dep).toBeDefined();
  });

  it("resolve import cross-package @rancho-delivery/shared", async () => {
    const graph = await buildGraph();
    const dep = graph.edges.find(e =>
      e.from === "apps/backend/src/services/asaas.service.ts" &&
      e.to === "packages/shared/src/index.ts"
    );
    expect(dep).toBeDefined();
  });

  it("agrupa modulos por pacote (nao por nome de pasta)", async () => {
    const graph = await buildGraph();
    const backendMod = graph.modules.find(m => m.name === "@rancho-delivery/backend");
    const frontendMod = graph.modules.find(m => m.name === "@rancho-delivery/frontend");
    const sharedMod = graph.modules.find(m => m.name === "@rancho-delivery/shared");
    // Must NOT have collisions between apps/backend/src and apps/frontend/src
    expect(backendMod).toBeDefined();
    expect(frontendMod).toBeDefined();
    expect(sharedMod).toBeDefined();
  });
});

describe("Layer 2 — SemanticIndexer", () => {
  it("inferDomain detecta 'bairro' em PT-BR", async () => {
    const graph = await buildGraph();
    const indexer = new SemanticIndexer();
    const indices = indexer.index(graph);
    const bairroService = indices.find(i => i.file.includes("bairro.service.ts"));
    expect(bairroService).toBeDefined();
    expect(bairroService!.domain).toBe("delivery-region");
  });

  it("inferDomain detecta 'asaas' como payment", async () => {
    const graph = await buildGraph();
    const indexer = new SemanticIndexer();
    const indices = indexer.index(graph);
    const asaasService = indices.find(i => i.file.includes("asaas.service.ts"));
    expect(asaasService).toBeDefined();
    expect(asaasService!.domain).toBe("payment");
  });

  it("inferDomain detecta 'conversacao' como whatsapp", async () => {
    const graph = await buildGraph();
    const indexer = new SemanticIndexer();
    const indices = indexer.index(graph);
    const convService = indices.find(i => i.file.includes("conversacao.service.ts"));
    expect(convService).toBeDefined();
    expect(convService!.domain).toBe("whatsapp");
  });
});

describe("Layer 4 — Retrieval (3 cenarios reais)", () => {
  it('Cenario 1: "Cobrança Asaas" → encontra asaas.service.ts no top-3', async () => {
    const graph = await buildGraph();
    const indexer = new SemanticIndexer();
    const indices = indexer.index(graph);
    const retriever = new IntelligentRetriever();
    const query: RetrievalQuery = {
      raw: "Cobrança Asaas",
      intent: "feature",
      entities: ["Asaas"],
    };
    // Use the retriever's findRelevantFiles via a public method
    // We'll test through the full retrieve pipeline
    const memory = { stack: {}, decisions: [], patterns: [], conventions: {}, rules: [], antiPatterns: [] };
    const result = retriever.retrieve(query, graph, indices, memory);
    const topFiles = result.relevantFiles.map(f => f.item);
    expect(topFiles.some(f => f.includes("asaas.service.ts"))).toBe(true);
    const asaasRank = topFiles.findIndex(f => f.includes("asaas.service.ts"));
    expect(asaasRank).toBeGreaterThanOrEqual(0);
    expect(asaasRank).toBeLessThan(3);
  });

  it('Cenario 2: "Opt-out WhatsApp" → encontra arquivo conversacao.service.ts no top-5', async () => {
    const graph = await buildGraph();
    const indexer = new SemanticIndexer();
    const indices = indexer.index(graph);
    const retriever = new IntelligentRetriever();
    const query: RetrievalQuery = {
      raw: "Opt-out WhatsApp",
      intent: "feature",
      entities: ["WhatsApp"],
    };
    const memory = { stack: {}, decisions: [], patterns: [], conventions: {}, rules: [], antiPatterns: [] };
    const result = retriever.retrieve(query, graph, indices, memory);
    const topFiles = result.relevantFiles.map(f => f.item);
    const convRank = topFiles.findIndex(f => f.includes("conversacao.service.ts"));
    expect(convRank).toBeGreaterThanOrEqual(0);
    expect(convRank).toBeLessThan(5);
  });

  it('Cenario 3: "Taxa por bairro" → encontra bairro.service.ts no top-3', async () => {
    const graph = await buildGraph();
    const indexer = new SemanticIndexer();
    const indices = indexer.index(graph);
    const retriever = new IntelligentRetriever();
    const query: RetrievalQuery = {
      raw: "Taxa por bairro",
      intent: "feature",
      entities: [],
    };
    const memory = { stack: {}, decisions: [], patterns: [], conventions: {}, rules: [], antiPatterns: [] };
    const result = retriever.retrieve(query, graph, indices, memory);
    const topFiles = result.relevantFiles.map(f => f.item);
    const bairroRank = topFiles.findIndex(f => f.includes("bairro.service.ts"));
    expect(bairroRank).toBeGreaterThanOrEqual(0);
    expect(bairroRank).toBeLessThan(3);
  });
});
