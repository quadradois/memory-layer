# Memory Layer for AI Development

Uma camada de **memória/contexto arquitetural** entre o LLM e o seu projeto. Em
vez de a IA reler o código inteiro a cada tarefa, o Memory Layer mantém um mapa
persistente do projeto — estrutura, grafo de dependências, índice semântico e
decisões arquiteturais — e devolve **apenas o contexto relevante** para a tarefa
em questão.

Disponível como **CLI** (`ml`) e como **servidor MCP** consumível nativamente
pelo Claude Code e outros clientes MCP.

## Como funciona

Pipeline de 4 estágios, persistido em `.memory-layer/*.json`:

| Estágio | Módulo | O que faz |
|---|---|---|
| **Scan** | `scanner/project-scanner` | Extrai imports/exports/funções/classes (TS/JS/PY/Go/…) |
| **Grafo** | `scanner/dependency-graph` | Resolve dependências, detecta entry points e módulos por domínio |
| **Index** | `indexer/semantic-indexer` | Infere propósito, intenção, responsabilidade e tags por arquivo |
| **Retrieval** | `retrieval/intelligent-retriever` | Pontua e devolve arquivos/módulos/decisões/regras relevantes |

A `memory/architectural-memory` guarda a **stack oficial, decisões, regras e
anti-patterns** do time, que entram no contexto retornado.

## Instalação

```bash
npm install
npm run build
```

## Uso — CLI

```bash
node dist/cli.js --dir meu-projeto scan
node dist/cli.js --dir meu-projeto index
node dist/cli.js --dir meu-projeto query "Adicionar autenticação por refresh token"
node dist/cli.js --dir meu-projeto analyze "Criar módulo de usuários com CRUD"
node dist/cli.js --dir meu-projeto stack --file stack.json
node dist/cli.js --dir meu-projeto memory rule "Nunca usar any - prefira tipos explícitos"
```

## Uso — MCP (Claude Code)

O repositório já inclui um [`.mcp.json`](.mcp.json) project-scoped. Ao abrir esta
pasta no Claude Code (VS Code), o servidor `memory-layer` é detectado
automaticamente. Aprove-o e as ferramentas ficam disponíveis para o Claude.

Ferramentas expostas:

| Tool | Descrição |
|---|---|
| `memory_init` | scan + index em um passo |
| `memory_scan` | Escaneia estrutura e grafo |
| `memory_index` | Indexa semanticamente |
| `memory_query` | Contexto relevante (resumido) para uma tarefa |
| `memory_analyze` | Relatório de contexto detalhado (scores + razões) |
| `memory_show` | Mostra a memória arquitetural persistida |
| `memory_set_stack` | Define a stack oficial (com proibições) |
| `memory_add_decision` | Registra decisão/regra/convenção/anti-pattern |

Todas aceitam `dir` (raiz do projeto-alvo; padrão `.`).

Para usar em **qualquer** projeto, registre o servidor globalmente apontando para
o caminho absoluto do build:

```bash
claude mcp add memory-layer -- node /caminho/para/memory-layer/dist/mcp-server.js
```

## Smoke test do MCP

```bash
node mcp-smoke-test.mjs
```

Exercita as ferramentas contra o `test-project/` de exemplo.

## Licença

MIT
