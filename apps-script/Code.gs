function doPost(e) {
  const sheet = getOrCreateSheet();
  const data = JSON.parse(e.postData.contents);

  if (Array.isArray(data.rows)) {
    const values = data.rows.map(rowToArray);
    if (values.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, values.length, 8).setValues(values);
    }
    return jsonOutput({ status: "ok", count: values.length });
  }

  sheet.appendRow(rowToArray(data));
  return jsonOutput({ status: "ok" });
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

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Transactions");
  if (!sheet) {
    sheet = ss.insertSheet("Transactions");
    sheet.appendRow(["ID", "Date", "Type", "Category", "Subcategory", "Amount", "Note", "CreatedAt"]);
  }
  return sheet;
}
