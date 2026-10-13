const HEADERS = ["ID", "Date", "Type", "Category", "Subcategory", "Amount", "Note", "CreatedAt"];
// Plain-text formats stop Sheets from auto-converting values like "2026-01-01"
// or a note of "7-11" into dates.
const FORMATS = ["@", "@", "@", "@", "@", "#,##0.00", "@", "@"];

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getOrCreateSheet();
    switch (data.action) {
      case "list":
        return jsonOutput({ status: "ok", rows: listRows(sheet) });
      case "delete":
        deleteById(sheet, data.id);
        return jsonOutput({ status: "ok" });
      case "replaceAll":
        return jsonOutput({ status: "ok", count: replaceAll(sheet, data.rows) });
    }
    if (Array.isArray(data.rows)) {
      return jsonOutput({ status: "ok", count: appendNew(sheet, data.rows) });
    }
    upsert(sheet, data);
    return jsonOutput({ status: "ok" });
  } finally {
    lock.releaseLock();
  }
}

function rowToArray(data) {
  return [
    data.id,
    data.date,
    data.type,
    data.category || "",
    data.subcategory || "",
    data.amount,
    data.note || "",
    data.createdAt,
  ];
}

function writeRows(sheet, startRow, values) {
  if (values.length === 0) return;
  const range = sheet.getRange(startRow, 1, values.length, HEADERS.length);
  range.setNumberFormats(values.map(() => FORMATS));
  range.setValues(values);
}

function findRow(sheet, id) {
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const cell = sheet
    .getRange(2, 1, last - 1, 1)
    .createTextFinder(String(id))
    .matchEntireCell(true)
    .findNext();
  return cell ? cell.getRow() : null;
}

function upsert(sheet, data) {
  const row = findRow(sheet, data.id);
  writeRows(sheet, row || sheet.getLastRow() + 1, [rowToArray(data)]);
}

function deleteById(sheet, id) {
  let row;
  while ((row = findRow(sheet, id))) sheet.deleteRow(row);
}

function appendNew(sheet, rows) {
  const last = sheet.getLastRow();
  const existing = new Set(
    last < 2 ? [] : sheet.getRange(2, 1, last - 1, 1).getValues().map((r) => String(r[0]))
  );
  const values = rows.filter((r) => !existing.has(String(r.id))).map(rowToArray);
  writeRows(sheet, last + 1, values);
  return values.length;
}

function replaceAll(sheet, rows) {
  const ss = sheet.getParent();
  const stamp = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm");
  sheet.copyTo(ss).setName("Backup " + stamp);
  const last = sheet.getLastRow();
  if (last > 1) sheet.deleteRows(2, last - 1);
  writeRows(sheet, 2, rows.map(rowToArray));
  return rows.length;
}

function listRows(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const tz = sheet.getParent().getSpreadsheetTimeZone();
  const asText = (v, fmt) => (v instanceof Date ? Utilities.formatDate(v, tz, fmt) : String(v));
  return sheet
    .getRange(2, 1, last - 1, HEADERS.length)
    .getValues()
    .filter((r) => r[0] !== "")
    .map((r) => ({
      id: String(r[0]),
      date: asText(r[1], "yyyy-MM-dd"),
      type: String(r[2]),
      category: r[3] === "" ? null : String(r[3]),
      subcategory: r[4] === "" ? null : String(r[4]),
      amount: Number(r[5]),
      note: asText(r[6], "M-d"),
      createdAt: r[7] instanceof Date ? r[7].toISOString() : String(r[7]),
    }));
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Transactions");
  if (!sheet) {
    sheet = ss.insertSheet("Transactions");
    sheet.appendRow(HEADERS);
  }
  return sheet;
}
