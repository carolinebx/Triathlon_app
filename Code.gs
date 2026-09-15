/**
 * Triatlon Coach — Google Sheets backend
 * -----------------------------------------------------------------
 * Plakt dit hele bestand in een nieuw Apps Script project (Extensies >
 * Apps Script vanuit je Google Spreadsheet) en deploy het als Web App.
 * Zie README.md in het project voor de volledige stappen.
 *
 * Werking: dit script gebruikt één tabblad "Data" met de kolommen
 * key | value | updatedAt, als eenvoudige key-value opslag. De app
 * bewaart zijn hele trainingsplan onder de key "triathlon-state" als
 * JSON-tekst in de "value"-kolom — zo blijft alles overzichtelijk in
 * één rij, ook als je meerdere gebruikers/plannen aan losse keys wilt
 * hangen.
 */

const SHEET_NAME = 'Data';

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
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === key) return i + 1; // 1-indexed rows
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
  const value = sheet.getRange(row, 2).getValue();
  return jsonResponse_({ key: key, value: String(value) });
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
  const value = body.value;
  if (!key) {
    return jsonResponse_({ error: 'Veld "key" ontbreekt.' });
  }
  const row = findRow_(sheet, key);
  const now = new Date().toISOString();
  if (row === -1) {
    sheet.appendRow([key, value, now]);
  } else {
    sheet.getRange(row, 2).setValue(value);
    sheet.getRange(row, 3).setValue(now);
  }
  return jsonResponse_({ ok: true, key: key, updatedAt: now });
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
