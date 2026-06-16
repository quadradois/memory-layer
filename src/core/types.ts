export interface ProjectFile {
  path: string;
  name: string;
  extension: string;
  size: number;
  imports: string[];
  exports: string[];
  functions: FunctionDecl[];
  classes: ClassDecl[];
  type: FileType;
}

export interface FunctionDecl {
  name: string;
  params: string[];
  returnType: string;
  isExported: boolean;
  startLine: number;
}

export interface ClassDecl {
  name: string;
  methods: string[];
  isExported: boolean;
  startLine: number;
}

export type FileType = "module" | "config" | "test" | "type-def" | "unknown";

export interface DependencyEdge {
  from: string;
  to: string;
  type: "import" | "dynamic-import" | "re-export" | "type-ref";
}

export interface ProjectGraph {
  files: Map<string, ProjectFile>;
  edges: DependencyEdge[];
  entryPoints: string[];
  modules: ModuleGroup[];
}

export interface ModuleGroup {
  name: string;
  files: string[];
  domain: string;
}

export interface SemanticIndex {
  file: string;
  purpose: string;
  summary: string;
  intent: string;
  responsibility: string;
  domain: string;
  dependsOn: string[];
  usedBy: string[];
  tags: string[];
}

export interface ArchDecision {
  id: string;
  title: string;
  description: string;
  date: string;
  category: "pattern" | "convention" | "rule" | "anti-pattern" | "decision";
  scope: "global" | "module" | "domain";
  content: string;
}

export interface StackConfig {
  frontend?: {
    framework: string;
    styling: string;
    stateManagement?: string;
    testing?: string;
    forbidden?: string[];
    allowed?: string[];
  };
  backend?: {
    architecture: string;
    framework: string;
    database?: string;
    orm?: string;
    testing?: string;
    forbidden?: string[];
    allowed?: string[];
  };
  mobile?: {
    framework: string;
    language: string;
  };
  infra?: {
    cloud: string;
    ci_cd: string;
    containerization?: string;
  };
}

export interface ArchMemory {
  stack: StackConfig;
  decisions: ArchDecision[];
  patterns: string[];
  conventions: Record<string, string>;
  rules: string[];
  antiPatterns: string[];
}

export interface RetrievalQuery {
  raw: string;
  intent: "feature" | "fix" | "refactor" | "question" | "unknown";
  entities: string[];
}

export interface RetrievalResult {
  query: RetrievalQuery;
  relevantFiles: ScoredItem[];
  relevantModules: ScoredItem[];
  relevantDecisions: ScoredItem[];
  relevantRules: string[];
  context: string;
}

export interface ScoredItem {
  item: string;
  score: number;
  reason: string;
}

export interface MemoryLayerConfig {
  projectRoot: string;
  memoryPath: string;
  ignoredDirs: string[];
  ignoredFiles: string[];
  supportedExtensions: string[];
}

export const DEFAULT_CONFIG: MemoryLayerConfig = {
  projectRoot: ".",
  memoryPath: ".memory-layer",
  ignoredDirs: ["node_modules", ".git", "dist", "build", ".next", "coverage", ".memory-layer"],
  ignoredFiles: ["package-lock.json", "yarn.lock", ".gitignore"],
  supportedExtensions: [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".kt", ".swift"],
};
