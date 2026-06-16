import * as fs from "fs";
import * as path from "path";
import { MemoryLayerConfig, ProjectFile, FileType, FunctionDecl, ClassDecl } from "../core/types";

export class ProjectScanner {
  private config: MemoryLayerConfig;

  constructor(config: MemoryLayerConfig) {
    this.config = config;
  }

  async scan(root: string): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];
    const absRoot = path.resolve(root);
    await this.walk(absRoot, absRoot, files);
    return files;
  }

  private async walk(dir: string, root: string, acc: ProjectFile[]): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (this.shouldIgnore(entry.name)) continue;
        await this.walk(fullPath, root, acc);
      } else if (entry.isFile()) {
        if (this.shouldIgnore(entry.name)) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (!this.config.supportedExtensions.includes(ext)) continue;
        const file = this.parseFile(fullPath, root);
        if (file) acc.push(file);
      }
    }
  }

  private shouldIgnore(name: string): boolean {
    return this.config.ignoredDirs.includes(name) || this.config.ignoredFiles.includes(name);
  }

  private parseFile(fullPath: string, root: string): ProjectFile | null {
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      const relativePath = path.relative(root, fullPath).replace(/\\/g, "/");
      const name = path.basename(fullPath);
      const ext = path.extname(fullPath).toLowerCase();
      const imports = this.extractImports(content, ext);
      const exports = this.extractExports(content, ext);
      const functions = this.extractFunctions(content, ext);
      const classes = this.extractClasses(content, ext);

      return {
        path: relativePath,
        name,
        extension: ext,
        size: content.length,
        imports,
        exports,
        functions,
        classes,
        type: this.classifyFile(name, ext),
      };
    } catch {
      return null;
    }
  }

  private extractImports(content: string, ext: string): string[] {
    const imports: string[] = [];
    if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
      const regex = /from\s+["']([^"']+)["']|require\s*\(\s*["']([^"']+)["']\)/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        imports.push(match[1] || match[2]);
      }
    } else if (ext === ".py") {
      const regex = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        imports.push(match[1] || match[2]);
      }
    } else if (ext === ".go") {
      const regex = /"([^"]+)"/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        if (match[1].includes("/")) imports.push(match[1]);
      }
    }
    return [...new Set(imports)];
  }

  private extractExports(content: string, ext: string): string[] {
    const exports: string[] = [];
    if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
      const regex = /export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        exports.push(match[1]);
      }
      const namedRegex = /export\s+\{\s*([^}]+)\s*\}/g;
      while ((match = namedRegex.exec(content)) !== null) {
        match[1].split(",").map(s => s.trim()).filter(Boolean).forEach(e => exports.push(e));
      }
    } else if (ext === ".py") {
      const regex = /^def\s+(\w+)|^class\s+(\w+)/gm;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        exports.push(match[1] || match[2]);
      }
    }
    return [...new Set(exports)];
  }

  private extractFunctions(content: string, ext: string): FunctionDecl[] {
    const functions: FunctionDecl[] = [];
    if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
      const regex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*(\w+))?/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        functions.push({
          name: match[1],
          params: match[2].split(",").map(s => s.trim()).filter(Boolean),
          returnType: match[3] || "any",
          isExported: match[0].startsWith("export"),
          startLine: this.getLine(content, match.index),
        });
      }
    }
    return functions;
  }

  private extractClasses(content: string, ext: string): ClassDecl[] {
    const classes: ClassDecl[] = [];
    if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
      const regex = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        classes.push({
          name: match[1],
          methods: [],
          isExported: match[0].startsWith("export"),
          startLine: this.getLine(content, match.index),
        });
      }
    }
    return classes;
  }

  private classifyFile(name: string, ext: string): FileType {
    if (/\.(config|conf|rc)/.test(name) || name.includes("config")) return "config";
    if (/\.(spec|test|e2e)\./.test(name) || name.endsWith(".test." + ext.slice(1))) return "test";
    if (/\.(d\.ts|types)/.test(name)) return "type-def";
    return "module";
  }

  private getLine(content: string, index: number): number {
    return content.substring(0, index).split("\n").length;
  }
}
