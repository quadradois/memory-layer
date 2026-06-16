import { ProjectFile, DependencyEdge, ProjectGraph, ModuleGroup } from "../core/types";

export class DependencyGraph {
  private files: Map<string, ProjectFile> = new Map();
  private edges: DependencyEdge[] = [];

  addFile(file: ProjectFile): void {
    this.files.set(file.path, file);
  }

  build(): ProjectGraph {
    this.edges = [];
    for (const file of this.files.values()) {
      for (const imp of file.imports) {
        const resolved = this.resolveImport(file.path, imp);
        if (resolved && this.files.has(resolved)) {
          this.edges.push({ from: file.path, to: resolved, type: "import" });
        }
      }
    }
    const entryPoints = this.findEntryPoints();
    const modules = this.detectModules();
    return { files: this.files, edges: this.edges, entryPoints, modules };
  }

  private resolveImport(from: string, imp: string): string | null {
    const fromDir = from.substring(0, from.lastIndexOf("/") + 1);
    const candidates = [
      imp,
      imp + ".ts",
      imp + ".tsx",
      imp + ".js",
      imp + ".jsx",
      imp + "/index.ts",
      imp + "/index.tsx",
      imp + "/index.js",
      pathJoin(fromDir, imp),
      pathJoin(fromDir, imp + ".ts"),
      pathJoin(fromDir, imp + ".tsx"),
    ];
    for (const candidate of candidates) {
      const normalized = candidate.replace(/\\/g, "/");
      if (this.files.has(normalized)) return normalized;
    }

    if (imp.startsWith(".")) {
      for (const filePath of this.files.keys()) {
        if (filePath.endsWith("/" + imp.replace(/^\.\//, "")) || filePath.endsWith("/" + imp.replace(/^\.\.\//, ""))) {
          if (imp.includes("/") && filePath.includes(imp.replace(/^\.\//, "").split("/")[0])) {
            return filePath;
          }
        }
      }
    }
    return null;
  }

  private findEntryPoints(): string[] {
    const hasIncoming = new Set<string>();
    for (const edge of this.edges) {
      hasIncoming.add(edge.to);
    }
    const entryPoints: string[] = [];
    for (const file of this.files.keys()) {
      if (!hasIncoming.has(file) && this.isSourceModule(file)) {
        entryPoints.push(file);
      }
    }
    return entryPoints;
  }

  private isSourceModule(filePath: string): boolean {
    return !filePath.startsWith("@") && !filePath.startsWith("node_modules");
  }

  private detectModules(): ModuleGroup[] {
    const groups = new Map<string, string[]>();
    for (const file of this.files.keys()) {
      const parts = file.split("/");
      if (parts.length >= 2) {
        const moduleDir = parts[parts.length - 2];
        if (!groups.has(moduleDir)) groups.set(moduleDir, []);
        groups.get(moduleDir)!.push(file);
      }
    }
    return Array.from(groups.entries()).map(([name, files]) => ({
      name,
      files,
      domain: this.inferDomain(name),
    }));
  }

  private inferDomain(name: string): string {
    const domainMap: Record<string, string> = {
      auth: "authentication",
      user: "user-management",
      payment: "payment",
      order: "order-management",
      product: "catalog",
      notification: "notification",
      email: "communication",
      api: "api-gateway",
      db: "database",
      config: "configuration",
      middleware: "middleware",
      shared: "shared",
      ui: "ui-components",
      component: "ui-components",
      page: "pages",
      hook: "hooks",
      util: "utilities",
      helper: "utilities",
      lib: "library",
      test: "testing",
    };
    return domainMap[name.toLowerCase()] || "unknown";
  }
}

function pathJoin(a: string, b: string): string {
  const sep = a.includes("/") ? "/" : "\\";
  const parts = a.split(sep);
  parts.pop();
  const relParts = b.replace(/\\/g, "/").split("/");
  for (const p of relParts) {
    if (p === ".") continue;
    if (p === "..") { parts.pop(); continue; }
    parts.push(p);
  }
  return parts.join("/");
}
