function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    sheet.appendRow([
      data.name || "",
      data.headline || "",
      data.company || "",
      data.location || "",
      data.followers || "",
      data.profileUrl || "",
      data.savedAt || new Date().toISOString(),
    ]);

    return ContentService.createTextOutput(
      JSON.stringify({ status: "ok", message: "Lead saved." })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({
      status: "ok",
      message: "LeadSaver webhook is active.",
    })
  ).setMimeType(ContentService.MimeType.JSON);
}
