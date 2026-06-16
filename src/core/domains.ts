const DOMAIN_RULES: { patterns: RegExp[]; domain: string }[] = [
  // --- Payment / Financial ---
  { patterns: [/pagamento/, /pagto/, /payment/, /asaas/, /mercadopago/, /gateway/, /fatura/, /boleto/], domain: "payment" },
  // --- Authentication ---
  { patterns: [/auth/, /login/, /jwt/, /token/, /sessao/, /session/], domain: "authentication" },
  // --- User / Customer ---
  { patterns: [/cliente/, /customer/, /user/, /consumidor/, /lead/], domain: "customer" },
  // --- Order ---
  { patterns: [/pedido/, /order/, /checkout/, /carrinho/, /cart/], domain: "order" },
  // --- Product / Menu ---
  { patterns: [/produto/, /product/, /cardapio/, /menu/, /catalogo/, /catalog/], domain: "product" },
  // --- WhatsApp / Communication ---
  { patterns: [/whatsapp/, /conversa/, /mensagem/, /message/, /evolution/, /opt.?out/], domain: "whatsapp" },
  // --- Neighborhood / Delivery region ---
  { patterns: [/bairro/, /neighborhood/, /regiao/, /region/, /entrega/, /delivery/, /rota/, /route/, /frete/, /taxa/], domain: "delivery-region" },
  // --- Store config ---
  { patterns: [/loja/, /store/, /configuracao/, /configuration/, /tenant/], domain: "store" },
  // --- Database / Data ---
  { patterns: [/database/, /db/, /prisma/, /repository/, /repo/, /model/, /entity/, /schema/, /migration/], domain: "database" },
  // --- Notification ---
  { patterns: [/notificacao/, /notification/, /alerta/, /alert/, /push/], domain: "notification" },
  // --- Report / Analytics ---
  { patterns: [/relatorio/, /report/, /dashboard/, /analytics/, /metric/, /estatistic/], domain: "analytics" },
  // --- AI / Agent ---
  { patterns: [/ia/, /ai/, /agente/, /agent/, /skill/, /classificador/, /classifier/], domain: "artificial-intelligence" },
  // --- Campaign / Marketing ---
  { patterns: [/campanha/, /campaign/, /marketing/, /engajamento/, /engagement/], domain: "marketing" },
  // --- Property / Real estate ---
  { patterns: [/imovel/, /property/, /imobiliario/], domain: "real-estate" },
  // --- Geolocation / Map ---
  { patterns: [/geo/, /mapa/, /map/, /coordenada/, /coordinate/, /leaflet/], domain: "geolocation" },
  // --- Security ---
  { patterns: [/seguranca/, /security/, /guard/, /middleware/, /auth.?middleware/], domain: "security" },
  // --- Delivery person ---
  { patterns: [/entregador/, /motoboy/, /courier/, /delivery.?person/], domain: "delivery-person" },
  // --- Webhook ---
  { patterns: [/webhook/], domain: "webhook" },
  // --- Job / Schedule ---
  { patterns: [/job/, /cron/, /agendado/, /scheduled/, /worker/, /fila/, /queue/], domain: "scheduled-jobs" },
  // --- Infrastructure / Config ---
  { patterns: [/config/, /logger/, /log/, /env/, /ambiente/], domain: "infrastructure" },
  // --- Shared / Common ---
  { patterns: [/shared/, /common/, /base/, /core/, /util/, /helper/, /lib/], domain: "shared" },
  // --- UI / Components ---
  { patterns: [/ui/, /component/, /layout/, /page/, /screen/, /tela/], domain: "ui" },
  // --- Hooks / State ---
  { patterns: [/hook/, /context/, /state/], domain: "state-management" },
  // --- API / Network ---
  { patterns: [/api/, /route/, /controller/, /endpoint/, /rest/, /http/], domain: "api" },
  // --- Test ---
  { patterns: [/test/, /spec/, /e2e/, /integration/], domain: "testing" },
];

export function inferDomain(filePath: string): string {
  const lower = filePath.toLowerCase();

  // Normalize plural directory names: services → service, controllers → controller
  const normalized = lower.replace(/\/(services|controllers|routes|middlewares|models|types|schemas|utils|hooks|pages|components|stores|states|providers|configs|jobs|modules)\//g, (_, p) => {
    const singular = p.replace(/s$/, "");
    return `/${singular}/`;
  });

  for (const rule of DOMAIN_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalized)) return rule.domain;
    }
  }

  return "unknown";
}

export function findModulesByPackage(files: string[], rootDir: string): Map<string, string[]> {
  const fs = require("fs");
  const path = require("path");
  const packages = new Map<string, string[]>();

  // Encontra o package.json mais proximo para cada arquivo
  for (const file of files) {
    const absPath = path.resolve(rootDir, file);
    let dir = path.dirname(absPath);
    let pkgName = "root";

    while (dir.startsWith(rootDir)) {
      const pkgPath = path.join(dir, "package.json");
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          pkgName = pkg.name || path.basename(dir);
          break;
        } catch {
          pkgName = path.basename(dir);
          break;
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    if (!packages.has(pkgName)) packages.set(pkgName, []);
    packages.get(pkgName)!.push(file);
  }

  return packages;
}
