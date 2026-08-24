/**
 * Testa a integração com a planilha de ponta a ponta.
 *
 *   node scripts/verificar-planilha.mjs
 *
 * Lê SHEETS_WEBHOOK_URL e SHEETS_TOKEN do .env e simula o ciclo real:
 * cria um parcial, atualiza o mesmo id, e confirma que virou "completo".
 * Deixa UMA linha de teste na planilha (id começando com "TESTE-"), que
 * você pode apagar depois.
 */

import fs from "node:fs";

function loadEnv() {
  const env = {};
  if (!fs.existsSync(".env")) return env;
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const url = env.SHEETS_WEBHOOK_URL;
const token = env.SHEETS_TOKEN;

const die = (msg) => {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
};

if (!url) die("SHEETS_WEBHOOK_URL não está no .env");
if (!token) die("SHEETS_TOKEN não está no .env");
if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) {
  console.warn(
    "\n  ! A URL não tem a cara de um Web App do Apps Script.\n" +
      "    O esperado termina em /exec, algo como:\n" +
      "    https://script.google.com/macros/s/AKfyc.../exec\n"
  );
}

const COLUMNS = (await import("../src/lib/survey-row.ts").catch(() => null))?.COLUMNS;

// Colunas mínimas para o teste (o script cria o resto do cabeçalho sozinho).
const columns = COLUMNS ?? [
  "id", "createdAt", "updatedAt", "status", "lastStep", "progress",
  "respondentName", "respondentEmail", "respondentWhatsapp", "npsScore",
];

const id = `TESTE-${new Date().toISOString().slice(0, 19)}`;

async function send(row, label) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token, columns, row }),
    redirect: "follow",
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    die(
      `${label}: a resposta não foi JSON (HTTP ${res.status}).\n` +
        `    Isso quase sempre significa que a implantação está com acesso\n` +
        `    restrito — refaça com "Quem pode acessar: Qualquer pessoa".\n\n` +
        `    Primeiros 200 caracteres da resposta:\n    ${text.slice(0, 200)}`
    );
  }
  if (!data.ok) {
    if (data.error === "unauthorized") {
      die(
        `${label}: token recusado.\n` +
          `    O TOKEN no topo do Codigo.gs precisa ser exatamente igual ao\n` +
          `    SHEETS_TOKEN do .env — e é preciso reimplantar depois de mudar.`
      );
    }
    die(`${label}: ${data.error}`);
  }
  return data;
}

console.log(`\n  Testando ${url}\n`);

const a = await send(
  {
    id,
    status: "parcial",
    lastStep: "identity",
    progress: "1/17",
    respondentName: "Teste Integração",
    respondentEmail: "teste@exemplo.com",
    respondentWhatsapp: "11900000000",
  },
  "1/3 parcial"
);
console.log(`  ✓ 1/3  linha criada (created: ${a.created})`);

const b = await send(
  { id, status: "parcial", lastStep: "origin", progress: "5/17" },
  "2/3 atualização"
);
if (b.created) die("2/3: criou uma linha nova em vez de atualizar a existente");
console.log("  ✓ 2/3  mesma linha atualizada, sem duplicar");

const c = await send(
  { id, status: "completo", lastStep: "preserve", progress: "17/17", npsScore: 9 },
  "3/3 final"
);
if (c.created) die("3/3: criou uma linha nova em vez de completar a existente");
console.log("  ✓ 3/3  linha concluída como \"completo\"");

console.log(
  `\n  Integração funcionando.\n\n` +
    `  Confira na planilha a linha com id ${id}\n` +
    `  (status "completo", progress "17/17") e apague depois do teste.\n`
);
