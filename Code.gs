/**
 * Trainingsapp — Google Sheets backend
 * -----------------------------------------------------------------
 * Plak dit hele bestand in een Apps Script project (Extensies >
 * Apps Script vanuit je Google Spreadsheet) en deploy het als Web App.
 * Zie README.md in het project voor de volledige stappen.
 *
 * Werking: dit script gebruikt één tabblad "Data" met de kolommen
 * key | value | updatedAt | (vervolgdelen van value ...), als eenvoudige
 * key-value opslag. De app bewaart zijn hele state onder de key
 * "triathlon-state" als JSON-tekst.
 *
 * Let op: één cel in Google Sheets mag maximaal 50.000 tekens bevatten. Een
 * trainingsplan met veel weken en een logboek komt daar snel overheen. Daarom
 * wordt de JSON hier in stukken van 45.000 tekens verdeeld: het eerste stuk
 * staat in kolom B (zoals voorheen, dus bestaande data blijft werken), de
 * rest in kolom D, E, F, ...
 *
 * Na het wijzigen van dit bestand: Implementeren > Implementaties beheren >
 * (potlood) > Versie: Nieuwe versie > Implementeren.
 */

const SHEET_NAME = 'Data';
const CHUNK_SIZE = 45000;
const FIRST_EXTRA_COL = 4; // kolom D

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['key', 'value', 'updatedAt']);
  }
  return sheet;
}

function findRow_(sheet, key) {
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const keys = sheet.getRange(1, 1, last, 1).getValues();
  for (let i = 1; i < keys.length; i++) {
    if (keys[i][0] === key) return i + 1; // 1-indexed rows
  }
  return -1;
}

function doGet(e) {
  const key = e.parameter.key;
  const sheet = getSheet_();
  if (!key) {
    return jsonResponse_({ error: 'Parameter "key" ontbreekt.' });
  }
  const row = findRow_(sheet, key);
  if (row === -1) {
    return jsonResponse_({ key: key, value: null });
  }
  const cols = Math.max(sheet.getLastColumn(), 3);
  const cells = sheet.getRange(row, 1, 1, cols).getValues()[0];
  // kolom B = eerste stuk, kolom D en verder = vervolgstukken (kolom C is updatedAt)
  let value = String(cells[1]);
  for (let c = FIRST_EXTRA_COL - 1; c < cells.length; c++) {
    if (cells[c] === '' || cells[c] === null) break;
    value += String(cells[c]);
  }
  return jsonResponse_({ key: key, value: value });
}

function doPost(e) {
  const sheet = getSheet_();
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ error: 'Ongeldige JSON in verzoek.' });
  }
  const key = body.key;
  const value = String(body.value == null ? '' : body.value);
  if (!key) {
    return jsonResponse_({ error: 'Veld "key" ontbreekt.' });
  }

  const chunks = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) chunks.push(value.substring(i, i + CHUNK_SIZE));
  if (chunks.length === 0) chunks.push('');
  const extraChunks = chunks.length - 1;

  let row = findRow_(sheet, key);
  const now = new Date().toISOString();
  if (row === -1) {
    sheet.appendRow([key, '', now]);
    row = sheet.getLastRow();
  }

  // genoeg kolommen beschikbaar maken
  const neededCols = FIRST_EXTRA_COL - 1 + extraChunks;
  if (sheet.getMaxColumns() < neededCols) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), neededCols - sheet.getMaxColumns());
  }

  // oude vervolgstukken wissen, daarna schrijven. Tekstformaat voorkomt dat Sheets een stuk
  // JSON als getal of formule interpreteert (bijvoorbeeld een stuk dat met "=" of "0012" begint).
  const maxCols = sheet.getMaxColumns();
  if (maxCols >= FIRST_EXTRA_COL) {
    sheet.getRange(row, FIRST_EXTRA_COL, 1, maxCols - FIRST_EXTRA_COL + 1).clearContent();
  }
  sheet.getRange(row, 2).setNumberFormat('@').setValue(chunks[0]);
  for (let i = 1; i < chunks.length; i++) {
    sheet.getRange(row, FIRST_EXTRA_COL + i - 1).setNumberFormat('@').setValue(chunks[i]);
  }
  sheet.getRange(row, 3).setValue(now);
  SpreadsheetApp.flush();
  return jsonResponse_({ ok: true, key: key, updatedAt: now, chunks: chunks.length });
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
