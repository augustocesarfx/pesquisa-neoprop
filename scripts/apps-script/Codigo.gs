/**
 * Pesquisa de Experiência Neoprop — receptor da planilha.
 *
 * Publique este arquivo como Web App (Implantar › Nova implantação ›
 * App da Web, executar como "Eu", acesso "Qualquer pessoa") e guarde a URL
 * em SHEETS_WEBHOOK_URL no site.
 *
 * O site manda { token, columns, row }. Aqui o `id` decide tudo:
 *  - id novo      → cria a linha e carimba createdAt;
 *  - id existente → atualiza SÓ as colunas que vieram preenchidas, sem
 *                   apagar o que já estava lá.
 *
 * Esse "não apaga o que já existe" é o que faz o abandono funcionar: o
 * parcial da pergunta 5 continua na planilha mesmo que a pessoa nunca volte,
 * e se ela voltar, a mesma linha vira "completo".
 */

// Cole aqui o MESMO valor que estiver em SHEETS_TOKEN no site.
var TOKEN = 'TROQUE_POR_UM_TOKEN_LONGO_E_ALEATORIO';

// Nome da aba que recebe as respostas, exatamente como aparece na guia
// lá embaixo — acento e espaço contam. Se o nome não bater, o script usa a
// PRIMEIRA aba da planilha em vez de criar uma solta.
var SHEET_NAME = 'Página 1';

/**
 * Rode esta função UMA VEZ no editor (botão "Executar") antes de publicar.
 *
 * Publicar não pede as permissões — só a execução pede. Sem essa concessão,
 * o Web App responde 403 "Acesso negado" para quem chama de fora, mesmo com
 * "Quem pode acessar: Qualquer pessoa" configurado.
 *
 * O Google vai mostrar um aviso de app não verificado: Avançado ›
 * Acessar <nome do projeto> (não seguro). É o seu próprio script.
 */
function autorizar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  Logger.log('Planilha: %s | Aba: %s', ss.getName(), sheet.getName());
  Logger.log('Autorização concedida. Agora reimplante o Web App.');
}

function doPost(e) {
  // Uma trava por vez: dois passos do mesmo respondente chegando juntos
  // não podem criar duas linhas para o mesmo id.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return json({ ok: false, error: 'lock_timeout' });
  }

  try {
    var body = JSON.parse(e.postData.contents);

    if (!body.token || body.token !== TOKEN) {
      return json({ ok: false, error: 'unauthorized' });
    }

    // Ação "check": o site pergunta se este e-mail ou WhatsApp já concluiu a
    // pesquisa. Só responde sim/não — nunca devolve dados de quem respondeu.
    if (body.action === 'check') {
      return json(checkConcluido(body.email, body.whatsapp));
    }

    // Ação "list": devolve a planilha inteira para o painel de análise.
    // Só o site chama isso, e só com o token — os dados são de clientes.
    if (body.action === 'list') {
      return json(listarTudo());
    }

    var columns = body.columns;
    var row = body.row;
    if (!columns || !columns.length || !row || !row.id) {
      return json({ ok: false, error: 'invalid_payload' });
    }

    var sheet = getSheet(columns);
    var header = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];

    var idCol = header.indexOf('id') + 1;
    if (idCol === 0) return json({ ok: false, error: 'sem_coluna_id' });

    var rowIndex = findRow(sheet, idCol, row.id);
    var created = rowIndex === -1;

    if (created) {
      rowIndex = sheet.getLastRow() + 1;
      row.createdAt = new Date().toISOString();
    }

    var current = created
      ? new Array(header.length).fill('')
      : sheet.getRange(rowIndex, 1, 1, header.length).getValues()[0];

    for (var i = 0; i < header.length; i++) {
      var key = header[i];
      if (!Object.prototype.hasOwnProperty.call(row, key)) continue;
      var value = row[key];
      // null/'' = "ainda não respondido": preserva o que já havia na célula
      if (value === null || value === undefined || value === '') continue;
      current[i] = value;
    }

    sheet.getRange(rowIndex, 1, 1, header.length).setValues([current]);
    return json({ ok: true, created: created });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Procura um respondente que JÁ CONCLUIU a pesquisa, pelo e-mail ou pelo
 * WhatsApp. Quem está com a linha em "parcial" não conta: essa pessoa ainda
 * está no meio do caminho e precisa poder continuar.
 *
 * A comparação normaliza dos dois lados — e-mail em minúsculas e sem espaços,
 * telefone só com dígitos — porque a planilha pode ter valores digitados em
 * formatos diferentes ao longo do tempo.
 */
function checkConcluido(email, whatsapp) {
  var mail = String(email || '').trim().toLowerCase();
  var phone = String(whatsapp || '').replace(/\D/g, '');
  if (!mail && !phone) return { ok: true, found: false };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  var last = sheet.getLastRow();
  if (last < 2) return { ok: true, found: false };

  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var iMail = header.indexOf('respondentEmail');
  var iPhone = header.indexOf('respondentWhatsapp');
  var iStatus = header.indexOf('status');
  if (iMail === -1 && iPhone === -1) return { ok: true, found: false };

  var values = sheet.getRange(2, 1, last - 1, header.length).getValues();
  for (var i = 0; i < values.length; i++) {
    if (iStatus !== -1 && String(values[i][iStatus]).trim() !== 'completo') continue;

    if (mail && iMail !== -1) {
      var rowMail = String(values[i][iMail]).trim().toLowerCase();
      if (rowMail && rowMail === mail) return { ok: true, found: true, by: 'email' };
    }
    if (phone && iPhone !== -1) {
      var rowPhone = String(values[i][iPhone]).replace(/\D/g, '');
      if (rowPhone && rowPhone === phone) return { ok: true, found: true, by: 'whatsapp' };
    }
  }
  return { ok: true, found: false };
}

/** Devolve cabeçalho + todas as linhas, para o painel calcular as métricas. */
function listarTudo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  var last = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (last < 2 || lastCol < 1) return { ok: true, header: [], rows: [] };

  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var values = sheet.getRange(2, 1, last - 1, lastCol).getValues();

  // Datas viram texto ISO: o JSON do Apps Script serializa Date de forma
  // inconsistente entre fusos, e o painel só precisa da string.
  var rows = values.map(function (linha) {
    return linha.map(function (celula) {
      return celula instanceof Date ? celula.toISOString() : celula;
    });
  });

  return { ok: true, header: header, rows: rows };
}

/** Busca a linha do id varrendo só a coluna de ids. */
function findRow(sheet, idCol, id) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var ids = sheet.getRange(2, idCol, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

/** Garante a aba e o cabeçalho, criando colunas novas no fim se preciso. */
function getSheet(columns) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // Nome errado não pode virar aba nova sem ninguém perceber: cai na primeira.
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }

  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var missing = columns.filter(function (c) {
    return header.indexOf(c) === -1;
  });
  if (missing.length) {
    sheet
      .getRange(1, header.length + 1, 1, missing.length)
      .setValues([missing])
      .setFontWeight('bold');
  }
  return sheet;
}

function json(payload) {
  return ContentService.createTextOutput(
    JSON.stringify(payload)
  ).setMimeType(ContentService.MimeType.JSON);
}
