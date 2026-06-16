import { ArchMemory, ArchDecision, StackConfig } from "../core/types";
import { FileStore } from "../storage/file-store";

const DEFAULT_ARCH_MEMORY: ArchMemory = {
  stack: {},
  decisions: [],
  patterns: [],
  conventions: {},
  rules: [],
  antiPatterns: [],
};

export class ArchitecturalMemory {
  private store: FileStore;
  private memory: ArchMemory;

  constructor(store: FileStore) {
    this.store = store;
    this.memory = { ...DEFAULT_ARCH_MEMORY };
    const saved = this.store.load("arch-memory");
    if (saved) {
      this.memory = { ...DEFAULT_ARCH_MEMORY, ...saved };
    }
  }

  setStack(stack: StackConfig): void {
    this.memory.stack = stack;
    this.persist();
  }

  addDecision(decision: Omit<ArchDecision, "id" | "date">): void {
    const full: ArchDecision = {
      ...decision,
      id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: new Date().toISOString(),
    };
    this.memory.decisions.push(full);
    this.persist();
  }

  addPattern(pattern: string): void {
    this.memory.patterns.push(pattern);
    this.persist();
  }

  setConvention(key: string, value: string): void {
    this.memory.conventions[key] = value;
    this.persist();
  }

  addRule(rule: string): void {
    this.memory.rules.push(rule);
    this.persist();
  }

  addAntiPattern(ap: string): void {
    this.memory.antiPatterns.push(ap);
    this.persist();
  }

  getAll(): ArchMemory {
    return { ...this.memory };
  }

  getStack(): StackConfig {
    return { ...this.memory.stack };
  }

  getRelevantDecisions(domain: string): ArchDecision[] {
    return this.memory.decisions.filter(d => d.scope === "global" || d.scope === domain || d.content.toLowerCase().includes(domain.toLowerCase()));
  }

  getRelevantRules(domain: string): string[] {
    return this.memory.rules.filter(r => r.toLowerCase().includes(domain.toLowerCase()) || r.startsWith("[global]"));
  }

  private persist(): void {
    this.store.save("arch-memory", this.memory);
  }
}
