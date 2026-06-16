import * as fs from "fs";
import * as path from "path";
import { ProjectFile, DependencyEdge, ProjectGraph, ModuleGroup } from "../core/types";
import { inferDomain, findModulesByPackage } from "../core/domains";

export class DependencyGraph {
  private files: Map<string, ProjectFile> = new Map();
  private edges: DependencyEdge[] = [];
  private rootDir: string = "";
  private tsconfigPaths: Map<string, string> = new Map();
  private workspaceNames: Map<string, string> = new Map();

  setRootDir(dir: string): void {
    this.rootDir = path.resolve(dir);
    this.loadTsconfigPaths();
    this.loadWorkspaceNames();
  }

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
    // 1) Try path alias resolution (@/..., @scope/pkg/...)
    const aliasResolved = this.resolveAlias(from, imp);
    if (aliasResolved && this.files.has(aliasResolved)) return aliasResolved;

    // 2) Try workspace package name resolution
    const wsResolved = this.resolveWorkspace(from, imp);
    if (wsResolved && this.files.has(wsResolved)) return wsResolved;

    // 3) Try relative path resolution
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
      pathJoin(fromDir, imp + "/index.ts"),
      pathJoin(fromDir, imp + "/index.tsx"),
    ];
    for (const candidate of candidates) {
      const normalized = candidate.replace(/\\/g, "/");
      if (this.files.has(normalized)) return normalized;
    }

    return null;
  }

  private resolveAlias(from: string, imp: string): string | null {
    for (const [alias, target] of this.tsconfigPaths) {
      const isGlobAlias = alias.endsWith("/");
      const matches = isGlobAlias
        ? imp.startsWith(alias)
        : imp === alias || imp.startsWith(alias + "/");

      if (!matches) continue;

      const relativePath = isGlobAlias ? imp.slice(alias.length) : (imp === alias ? "" : imp.slice(alias.length + 1));
      const fromPkg = this.findNearestPackage(from);
      const tsconfigDir = fromPkg
        ? path.dirname(path.resolve(this.rootDir, fromPkg, "tsconfig.json"))
        : this.rootDir;
      const targetAbs = path.resolve(tsconfigDir, target);
      const resolved = this.toPosix(path.relative(this.rootDir, targetAbs)) +
        (relativePath ? "/" + relativePath : "");

      const exts = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"];
      const candidates = [resolved, ...exts.map(e => resolved + e)];
      for (const c of candidates) {
        if (this.files.has(c)) return c;
      }
    }
    return null;
  }

  private resolveWorkspace(from: string, imp: string): string | null {
    // Check if import matches a workspace package name
    for (const [pkgName, pkgDir] of this.workspaceNames) {
      if (imp === pkgName || imp.startsWith(pkgName + "/")) {
        // Map to the package's src/index or the specific subpath
        const subPath = imp === pkgName ? "" : imp.slice(pkgName.length + 1);
        const pkgAbs = path.resolve(this.rootDir, pkgDir, "src", subPath);
        const relative = this.toPosix(path.relative(this.rootDir, pkgAbs));
        const exts = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"];
        const candidates = [relative, ...exts.map(e => relative + e)];
        for (const c of candidates) {
          if (this.files.has(c)) return c;
        }
      }
    }
    return null;
  }

  private loadTsconfigPaths(): void {
    // Walk from root to find tsconfig files at known locations
    const searchPaths = [""];  // root
    // Also check apps/*/tsconfig.json for monorepo
    try {
      const appsDir = path.join(this.rootDir, "apps");
      if (fs.existsSync(appsDir)) {
        for (const app of fs.readdirSync(appsDir)) {
          const tsconfigPath = path.join(appsDir, app, "tsconfig.json");
          if (fs.existsSync(tsconfigPath)) {
            searchPaths.push(path.join("apps", app));
          }
        }
      }
    } catch {}

    for (const base of searchPaths) {
      const tsconfigPath = path.join(this.rootDir, base, "tsconfig.json");
      if (!fs.existsSync(tsconfigPath)) continue;
      try {
        const raw = fs.readFileSync(tsconfigPath, "utf-8");
        const tsconfig = JSON.parse(raw);
        const paths = tsconfig.compilerOptions?.paths;
        if (!paths) continue;

        const baseDir = base ? path.join(this.rootDir, base) : this.rootDir;
        for (const [alias, targets] of Object.entries(paths)) {
          const isGlob = alias.endsWith("/*");
          const aliasClean = isGlob ? alias.slice(0, -2) : alias;
          let target = (targets as string[])[0] || "";
          if (isGlob) target = target.replace("/*", "");
          if (target) {
            const absTarget = path.resolve(baseDir, target);
            const relTarget = this.toPosix(path.relative(baseDir, absTarget));
            this.tsconfigPaths.set(aliasClean, isGlob ? relTarget + "/" : relTarget);
          }
        }
      } catch {}
    }
  }

  private loadWorkspaceNames(): void {
    const rootPkgPath = path.join(this.rootDir, "package.json");
    if (!fs.existsSync(rootPkgPath)) return;
    try {
      const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));
      const workspaces: string[] = rootPkg.workspaces || [];
      for (const pattern of workspaces) {
        // pattern like "apps/*" → scan apps/ for subdirs
        if (pattern.endsWith("/*")) {
          const parent = path.join(this.rootDir, pattern.slice(0, -2));
          if (!fs.existsSync(parent)) continue;
          for (const entry of fs.readdirSync(parent)) {
            const pkgPath = path.join(parent, entry, "package.json");
            if (fs.existsSync(pkgPath)) {
              try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
                if (pkg.name) {
                  this.workspaceNames.set(pkg.name, path.join(pattern.slice(0, -2), entry));
                }
              } catch {}
            }
          }
        }
      }
    } catch {}
  }

  private findNearestPackage(filePath: string): string | null {
    const absFile = path.resolve(this.rootDir, filePath);
    let dir = path.dirname(absFile);
    const rootAbs = path.resolve(this.rootDir);
    while (dir.length >= rootAbs.length) {
      const pkgPath = path.join(dir, "package.json");
      if (fs.existsSync(pkgPath)) {
        return this.toPosix(path.relative(rootAbs, dir));
      }
      const parent = path.dirname(dir);
      if (parent === dir || parent.length < rootAbs.length) break;
      dir = parent;
    }
    return null;
  }

  private findEntryPoints(): string[] {
    const hasIncoming = new Set<string>();
    for (const edge of this.edges) {
      hasIncoming.add(edge.to);
    }
    return Array.from(this.files.keys()).filter(f => !hasIncoming.has(f) && !f.includes("node_modules"));
  }

  private detectModules(): ModuleGroup[] {
    // Group by package (nearest package.json), not by parent folder
    const fileList = Array.from(this.files.keys());
    const pkgGroups = findModulesByPackage(fileList, this.rootDir);

    return Array.from(pkgGroups.entries()).map(([pkgName, files]) => ({
      name: pkgName,
      files,
      domain: inferDomain(pkgName + "/" + (files[0] || "")),
    }));
  }

  private toPosix(p: string): string {
    return p.replace(/\\/g, "/");
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
