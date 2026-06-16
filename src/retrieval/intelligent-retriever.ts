import { ProjectGraph, SemanticIndex, ArchMemory, RetrievalQuery, RetrievalResult, ScoredItem } from "../core/types";

// Fator aplicado ao score de arquivos de teste em intenções de implementação.
// Mantém o teste visível, mas abaixo do fonte equivalente.
const TEST_DERANK_FACTOR = 0.5;

export class IntelligentRetriever {
  retrieve(query: RetrievalQuery, graph: ProjectGraph, indices: SemanticIndex[], memory: ArchMemory): RetrievalResult {
    const relevantFiles = this.findRelevantFiles(query, indices);
    const relevantModules = this.findRelevantModules(query, graph, indices);
    const relevantDecisions = this.findRelevantDecisions(query, memory);
    const relevantRules = this.findRelevantRules(query, memory);
    const context = this.buildContext(query, relevantFiles, relevantModules, relevantDecisions, relevantRules);

    return { query, relevantFiles, relevantModules, relevantDecisions, relevantRules, context };
  }

  formatContext(result: RetrievalResult): string {
    const lines: string[] = [];
    lines.push("=".repeat(60));
    lines.push("MEMORY LAYER - CONTEXTO ARQUITETURAL");
    lines.push("=".repeat(60));
    lines.push("");
    lines.push("--- QUERY ---");
    lines.push(`  Intenção: ${result.query.intent}`);
    lines.push(`  Entidades detectadas: ${result.query.entities.join(", ") || "nenhuma"}`);
    lines.push("");

    if (result.relevantFiles.length > 0) {
      lines.push("--- ARQUIVOS CRÍTICOS ---");
      for (const f of result.relevantFiles) {
        lines.push(`  [${f.score.toFixed(2)}] ${f.item}`);
        lines.push(`        → ${f.reason}`);
      }
      lines.push("");
    }

    if (result.relevantModules.length > 0) {
      lines.push("--- MÓDULOS RELEVANTES ---");
      for (const m of result.relevantModules) {
        lines.push(`  [${m.score.toFixed(2)}] ${m.item}`);
        lines.push(`        → ${m.reason}`);
      }
      lines.push("");
    }

    if (result.relevantDecisions.length > 0) {
      lines.push("--- DECISÕES ARQUITETURAIS ---");
      for (const d of result.relevantDecisions) {
        lines.push(`  [${d.score.toFixed(2)}] ${d.item}`);
        lines.push(`        → ${d.reason}`);
      }
      lines.push("");
    }

    if (result.relevantRules.length > 0) {
      lines.push("--- REGRAS ARQUITETURAIS ---");
      for (const r of result.relevantRules) {
        lines.push(`  • ${r}`);
      }
      lines.push("");
    }

    lines.push("=".repeat(60));
    return lines.join("\n");
  }

  private findRelevantFiles(query: RetrievalQuery, indices: SemanticIndex[]): ScoredItem[] {
    const scored: ScoredItem[] = [];
    const queryWords = query.raw.toLowerCase().split(/\s+/);

    for (const idx of indices) {
      let score = 0;
      const reasons: string[] = [];

      const domainScore = this.calculateRelevance(idx.domain, queryWords);
      if (domainScore > 0) { score += domainScore * 0.3; reasons.push(`domínio "${idx.domain}" relevante`); }

      const purposeScore = this.calculateRelevance(idx.purpose, queryWords);
      if (purposeScore > 0) { score += purposeScore * 0.25; reasons.push(`propósito: ${idx.purpose}`); }

      const tagScore = this.calculateTagScore(idx.tags, queryWords);
      if (tagScore > 0) { score += tagScore * 0.15; reasons.push(`tags: ${idx.tags.join(", ")}`); }

      const fileNameScore = this.calculateFilenameScore(idx.file, queryWords);
      if (fileNameScore > 0) { score += fileNameScore; reasons.push(`nome do arquivo corresponde à consulta`); }

      const depScore = this.calculateDependencyScore(idx, queryWords);
      if (depScore > 0) { score += depScore * 0.1; }

      for (const entity of query.entities) {
        if (idx.file.toLowerCase().includes(entity.toLowerCase())) {
          score += 0.3;
          reasons.push(`nome corresponde à entidade "${entity}"`);
        }
      }

      // De-rank leve de arquivos de teste quando a intenção é implementar uma
      // feature: nesse caso o que importa é o fonte, não o .spec. O teste não
      // é removido — só passa a rankear abaixo do fonte equivalente.
      if (query.intent === "feature" && this.isTestFile(idx)) {
        score *= TEST_DERANK_FACTOR;
        reasons.push("arquivo de teste (de-rank p/ intenção 'feature')");
      }

      score = Math.min(score, 1);

      if (score > 0.1) {
        scored.push({ item: idx.file, score, reason: reasons.join("; ") || "relevante para a query" });
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, 10);
  }

  private findRelevantModules(query: RetrievalQuery, graph: ProjectGraph, indices: SemanticIndex[]): ScoredItem[] {
    const scored: ScoredItem[] = [];
    const queryWords = query.raw.toLowerCase().split(/\s+/);

    for (const mod of graph.modules) {
      let score = 0;
      const reasons: string[] = [];

      const domainScore = this.calculateRelevance(mod.domain, queryWords);
      if (domainScore > 0) { score += domainScore * 0.4; reasons.push(`domínio "${mod.domain}"`); }

      const nameScore = this.calculateRelevance(mod.name, queryWords);
      if (nameScore > 0) { score += nameScore * 0.3; reasons.push(`nome "${mod.name}"`); }

      // Bônus por tamanho do módulo só faz sentido como desempate quando o
      // módulo já é relevante. Aplicá-lo a score 0 faz módulos grandes
      // aparecerem para qualquer query (falso-positivo por tamanho).
      if (score > 0) {
        const moduleIndices = indices.filter(i => mod.files.includes(i.file));
        const fileCount = moduleIndices.length;
        if (fileCount > 0) score += Math.min(fileCount * 0.05, 0.2);
      }

      score = Math.min(score, 1);

      if (score > 0.15) {
        scored.push({ item: `${mod.name} (${mod.domain})`, score, reason: reasons.join("; ") || `${mod.files.length} arquivos no módulo` });
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, 8);
  }

  private findRelevantDecisions(query: RetrievalQuery, memory: ArchMemory): ScoredItem[] {
    const scored: ScoredItem[] = [];
    const queryWords = query.raw.toLowerCase().split(/\s+/);

    for (const dec of memory.decisions) {
      let score = 0;
      const reasons: string[] = [];

      const titleScore = this.calculateRelevance(dec.title, queryWords);
      if (titleScore > 0) { score += titleScore * 0.4; reasons.push(`título: ${dec.title}`); }

      const contentScore = this.calculateRelevance(dec.content, queryWords);
      if (contentScore > 0) { score += contentScore * 0.3; reasons.push(`contém "${query.raw}"`); }

      for (const entity of query.entities) {
        if (dec.content.toLowerCase().includes(entity.toLowerCase())) {
          score += 0.2;
        }
      }

      if (dec.scope === "global") score += 0.1;

      score = Math.min(score, 1);

      if (score > 0.2) {
        scored.push({ item: `[${dec.category}] ${dec.title}`, score, reason: reasons.join("; ") });
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  private findRelevantRules(query: RetrievalQuery, memory: ArchMemory): string[] {
    const queryWords = query.raw.toLowerCase().split(/\s+/);
    const rules: string[] = [];

    for (const rule of memory.rules) {
      for (const word of queryWords) {
        if (word.length > 2 && rule.toLowerCase().includes(word)) {
          rules.push(rule);
          break;
        }
      }
    }

    const antiPatternHits = memory.antiPatterns.filter(ap => {
      return queryWords.some(w => w.length > 2 && ap.toLowerCase().includes(w));
    });

    if (antiPatternHits.length > 0) {
      rules.push("⚠️ EVITAR: " + antiPatternHits.join(", "));
    }

    const stackUsed = memory.stack.frontend || memory.stack.backend;
    if (stackUsed) {
      rules.push("Stack oficial disponível. Consulte 'ml memory stack' para detalhes.");
    }

    return [...new Set(rules)];
  }

  private buildContext(
    query: RetrievalQuery,
    files: ScoredItem[],
    modules: ScoredItem[],
    decisions: ScoredItem[],
    rules: string[]
  ): string {
    const ctx: string[] = [];
    ctx.push(`Query: "${query.raw}" (intenção: ${query.intent})`);
    ctx.push(`Entidades: ${query.entities.join(", ") || "não detectadas"}`);

    if (files.length > 0) {
      ctx.push(`\nArquivos mais relevantes (${files.length}):`);
      files.slice(0, 5).forEach(f => ctx.push(`  - ${f.item} (score: ${f.score.toFixed(2)})`));
    }

    if (modules.length > 0) {
      ctx.push(`\nMódulos relevantes:`);
      modules.slice(0, 3).forEach(m => ctx.push(`  - ${m.item}`));
    }

    if (decisions.length > 0) {
      ctx.push(`\nDecisões arquiteturais relevantes:`);
      decisions.slice(0, 3).forEach(d => ctx.push(`  - ${d.item}`));
    }

    if (rules.length > 0) {
      ctx.push(`\nRegras aplicáveis:`);
      rules.slice(0, 5).forEach(r => ctx.push(`  • ${r}`));
    }

    return ctx.join("\n");
  }

  private isTestFile(idx: SemanticIndex): boolean {
    return idx.tags.includes("test") || idx.intent === "validation" || idx.domain === "testing";
  }

  private calculateRelevance(text: string, queryWords: string[]): number {
    const lower = text.toLowerCase();
    let matches = 0;
    for (const word of queryWords) {
      if (word.length <= 2) continue;
      if (lower.includes(word)) matches++;
    }
    return queryWords.length > 0 ? matches / queryWords.length : 0;
  }

  private calculateTagScore(tags: string[], queryWords: string[]): number {
    let score = 0;
    for (const tag of tags) {
      for (const word of queryWords) {
        if (tag.includes(word)) score += 0.1;
      }
    }
    return score;
  }

  private calculateFilenameScore(filePath: string, queryWords: string[]): number {
    const fileName = filePath.split("/").pop()?.toLowerCase() || filePath.toLowerCase();
    let score = 0;
    for (const word of queryWords) {
      if (word.length <= 2) continue;
      if (fileName.includes(word)) score += 0.35;
    }
    return Math.min(score, 0.7);
  }

  private calculateDependencyScore(idx: SemanticIndex, queryWords: string[]): number {
    let score = 0;
    for (const dep of idx.dependsOn) {
      for (const word of queryWords) {
        if (dep.toLowerCase().includes(word)) score += 0.1;
      }
    }
    for (const user of idx.usedBy) {
      for (const word of queryWords) {
        if (user.toLowerCase().includes(word)) score += 0.05;
      }
    }
    return score;
  }
}
