import { MemoryLayerConfig, DEFAULT_CONFIG, ProjectGraph, SemanticIndex, ArchMemory, RetrievalQuery, RetrievalResult, ArchDecision, StackConfig } from "./types";
import { ProjectScanner } from "../scanner/project-scanner";
import { DependencyGraph } from "../scanner/dependency-graph";
import { SemanticIndexer } from "../indexer/semantic-indexer";
import { ArchitecturalMemory } from "../memory/architectural-memory";
import { IntelligentRetriever } from "../retrieval/intelligent-retriever";
import { FileStore } from "../storage/file-store";

export class MemoryEngine {
  private config: MemoryLayerConfig;
  private scanner: ProjectScanner;
  private dependencyGraph: DependencyGraph;
  private indexer: SemanticIndexer;
  private archMemory: ArchitecturalMemory;
  private retriever: IntelligentRetriever;
  private store: FileStore;

  constructor(config?: Partial<MemoryLayerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.store = new FileStore(this.config.memoryPath);
    this.scanner = new ProjectScanner(this.config);
    this.dependencyGraph = new DependencyGraph();
    this.indexer = new SemanticIndexer();
    this.archMemory = new ArchitecturalMemory(this.store);
    this.retriever = new IntelligentRetriever();
  }

  async scan(): Promise<ProjectGraph> {
    const files = await this.scanner.scan(this.config.projectRoot);
    this.dependencyGraph = new DependencyGraph();
    this.dependencyGraph.setRootDir(this.config.projectRoot);
    for (const file of files) {
      this.dependencyGraph.addFile(file);
    }
    const graph = this.dependencyGraph.build();
    this.store.save("graph", {
      files: Array.from(graph.files.entries()),
      edges: graph.edges,
      entryPoints: graph.entryPoints,
      modules: graph.modules,
    });
    return graph;
  }

  async index(): Promise<SemanticIndex[]> {
    const raw = this.store.load("graph");
    if (!raw) throw new Error("Run scan first");
    const graph: ProjectGraph = {
      files: new Map(raw.files as [string, any][]),
      edges: raw.edges,
      entryPoints: raw.entryPoints,
      modules: raw.modules,
    };
    const indices = this.indexer.index(graph);
    this.store.save("semantic-index", indices);
    return indices;
  }

  setStack(stack: StackConfig): void {
    this.archMemory.setStack(stack);
  }

  addDecision(decision: Omit<ArchDecision, "id" | "date">): void {
    this.archMemory.addDecision(decision);
  }

  getMemory(): ArchMemory {
    return this.archMemory.getAll();
  }

  query(raw: string): RetrievalResult {
    const graph = this.loadGraph();
    const indices = this.loadIndices();
    const memory = this.archMemory.getAll();

    const query: RetrievalQuery = {
      raw,
      intent: this.classifyIntent(raw),
      entities: this.extractEntities(raw),
    };

    return this.retriever.retrieve(query, graph, indices, memory);
  }

  analyze(raw: string): string {
    const result = this.query(raw);
    return this.retriever.formatContext(result);
  }

  private classifyIntent(raw: string): RetrievalQuery["intent"] {
    const lower = raw.toLowerCase().trim();
    const starts = (words: string[]) => words.some(w => lower.startsWith(w));

    if (starts(["add", "create", "implement", "build", "adicionar", "criar", "implementar", "construir", "desenvolver"])) return "feature";
    if (starts(["fix", "bug", "error", "corrigir", "consertar", "resolver", "erro"])) return "fix";
    if (starts(["refactor", "extract", "rename", "refatorar", "extrair", "renomear", "reorganizar"])) return "refactor";
    if (lower.endsWith("?") || starts(["how", "what", "why", "where", "como", "qual", "quais", "por que", "porque", "onde"])) return "question";
    return "unknown";
  }

  private extractEntities(raw: string): string[] {
    const words = raw.split(/\s+/);
    return words.filter(w => /^[A-Z][a-zA-Z]*/.test(w) || /service|module|system|component|controller|handler/i.test(w));
  }

  private loadGraph(): ProjectGraph {
    const raw = this.store.load("graph");
    if (!raw) return { files: new Map(), edges: [], entryPoints: [], modules: [] };
    return {
      files: new Map(raw.files as [string, any][]),
      edges: raw.edges,
      entryPoints: raw.entryPoints,
      modules: raw.modules,
    };
  }

  private loadIndices(): SemanticIndex[] {
    const raw = this.store.load("semantic-index");
    return raw || [];
  }
}
