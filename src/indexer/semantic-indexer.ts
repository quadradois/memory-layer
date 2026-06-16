import { ProjectGraph, SemanticIndex, FileType } from "../core/types";

export class SemanticIndexer {
  index(graph: ProjectGraph): SemanticIndex[] {
    const indices: SemanticIndex[] = [];
    for (const [filePath, file] of graph.files) {
      indices.push(this.indexFile(filePath, file, graph));
    }
    return indices;
  }

  private indexFile(filePath: string, file: any, graph: ProjectGraph): SemanticIndex {
    const dependsOn = this.findDependencies(filePath, graph);
    const usedBy = this.findDependents(filePath, graph);
    const domain = this.inferDomain(filePath, file);
    const purpose = this.inferPurpose(file, domain);
    const intent = this.inferIntent(file);
    const responsibility = this.inferResponsibility(file, domain);
    const tags = this.inferTags(file, domain);

    return {
      file: filePath,
      purpose,
      summary: this.generateSummary(file, purpose),
      intent,
      responsibility,
      domain,
      dependsOn,
      usedBy,
      tags,
    };
  }

  private findDependencies(filePath: string, graph: ProjectGraph): string[] {
    return graph.edges.filter(e => e.from === filePath).map(e => e.to);
  }

  private findDependents(filePath: string, graph: ProjectGraph): string[] {
    return graph.edges.filter(e => e.to === filePath).map(e => e.from);
  }

  private inferDomain(filePath: string, file: any): string {
    const parts = filePath.toLowerCase().split("/");
    const domainKeywords: Record<string, string> = {
      auth: "authentication",
      user: "user-management",
      payment: "payment",
      order: "order",
      product: "catalog",
      notification: "notification",
      email: "communication",
      api: "api",
      db: "database",
      config: "configuration",
      middleware: "middleware",
      shared: "shared",
      ui: "ui",
      component: "ui",
      page: "ui",
      hook: "hooks",
      util: "utilities",
      helper: "utilities",
      lib: "library",
      test: "testing",
      service: "service",
      controller: "controller",
      module: "module",
      dto: "data-transfer",
      entity: "entity",
      model: "model",
      schema: "schema",
    };

    for (const part of parts) {
      if (domainKeywords[part]) return domainKeywords[part];
    }
    return "unknown";
  }

  private inferPurpose(file: any, domain: string): string {
    const name = file.name.replace(file.extension, "");
    const parts: string[] = name.split(/[.\-_]/);

    if (file.type === "config") return `Configuração de ${domain}`;
    if (file.type === "test") return `Testes de ${name.replace(/\.(spec|test|e2e)$/, "")}`;
    if (file.type === "type-def") return `Definições de tipos para ${domain}`;

    const hasController = parts.some((p: string) => /controller/i.test(p));
    if (hasController) return `Gerencia requisições HTTP para ${domain}`;

    const hasService = parts.some((p: string) => /service/i.test(p));
    if (hasService) return `Implementa lógica de negócio de ${domain}`;

    const hasModule = parts.some((p: string) => /module/i.test(p));
    if (hasModule) return `Modulo de ${domain}`;

    const hasRepo = parts.some((p: string) => /repo/i.test(p));
    if (hasRepo) return `Acesso a dados de ${domain}`;

    const hasDto = parts.some((p: string) => /dto/i.test(p));
    if (hasDto) return `DTO para transferência de dados de ${domain}`;

    const hasGuard = parts.some((p: string) => /guard/i.test(p));
    if (hasGuard) return `Guard de proteção para ${domain}`;

    const hasUtil = parts.some((p: string) => /util/i.test(p));
    if (hasUtil) return `Utilitários para ${domain}`;

    if (name === "index" || name === "main" || file.exports.length === 0) return `Agregação/exportação de ${domain}`;

    return `Gerencia funcionalidades de ${domain}`;
  }

  private inferIntent(file: any): string {
    if (file.type === "config") return "configuration";
    if (file.type === "test") return "validation";
    if (file.type === "type-def") return "type-definition";
    if (file.functions.length > 0 || file.classes.length > 0) return "implementation";
    return "declaration";
  }

  private inferResponsibility(file: any, domain: string): string {
    const responsibilities: string[] = [];
    if (file.exports.length > 0) responsibilities.push(`exporta ${file.exports.length} símbolos`);
    if (file.functions.length > 0) responsibilities.push(`define ${file.functions.length} funções`);
    if (file.classes.length > 0) responsibilities.push(`define ${file.classes.length} classes`);
    if (file.imports.length > 0) responsibilities.push(`depende de ${file.imports.length} módulos externos`);
    responsibilities.push(`opera no domínio de ${domain}`);
    return responsibilities.join("; ");
  }

  private inferTags(file: any, domain: string): string[] {
    const tags = [domain, file.type];
    const name = file.name.toLowerCase();
    if (name.includes("service")) tags.push("service");
    if (name.includes("controller")) tags.push("controller");
    if (name.includes("module")) tags.push("module");
    if (name.includes("middleware")) tags.push("middleware");
    if (name.includes("guard")) tags.push("guard");
    if (name.includes("decorator")) tags.push("decorator");
    if (name.includes("pipe")) tags.push("pipe");
    if (name.includes("filter")) tags.push("filter");
    if (name.includes("interceptor")) tags.push("interceptor");
    if (name.includes("dto")) tags.push("dto");
    if (name.includes("entity")) tags.push("entity");
    if (name.includes("test") || name.includes("spec")) tags.push("test");
    if (file.isExported !== undefined && file.isExported) tags.push("public-api");
    return [...new Set(tags)];
  }

  private generateSummary(file: any, purpose: string): string {
    let summary = purpose;
    if (file.functions.length > 0) {
      const fnNames = file.functions.map((f: any) => f.name).slice(0, 5);
      summary += `. Funções: ${fnNames.join(", ")}`;
    }
    if (file.classes.length > 0) {
      const classNames = file.classes.map((c: any) => c.name).slice(0, 3);
      summary += `. Classes: ${classNames.join(", ")}`;
    }
    return summary;
  }
}
