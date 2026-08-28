function doPost(e) {
  const sheet = getOrCreateSheet();
  const data = JSON.parse(e.postData.contents);

  sheet.appendRow([
    data.id,
    data.date,
    data.type,
    data.category || "",
    data.subcategory || "",
    data.amount,
    data.note || "",
    data.createdAt,
  ]);

  return ContentService.createTextOutput(JSON.stringify({ status: "ok" })).setMimeType(
    ContentService.MimeType.JSON
  );
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
