// ===============================
// Lost & Found Apps Script (final)
// JSONP GET + Form POST (with optional photo upload)
// ===============================

const SPREADSHEET_ID = '1WS8mln_1XQblT2rzOdHU8DGZRKsO3ZKty_UrUXBEEKw';
const SHEET_NAME = 'Sheet1';

// helper: return JSON ContentService
function respondJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// get sheet safely
function getSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Sheet "' + SHEET_NAME + '" not found.');
  return sh;
}

// JSONP wrapper
function jsonpResponse(e, obj) {
  const callback = e && e.parameter && e.parameter.callback;
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + JSON.stringify(obj) + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return respondJSON(obj);
}

// GET: return items (supports JSONP ?callback=fn)
function doGet(e) {
  try {
    const sh = getSheet();
    const data = sh.getDataRange().getValues();
    if (!data || data.length < 2) {
      return jsonpResponse(e, { success: true, items: [] });
    }
    const headers = data[0];
    const rows = data.slice(1);
    // limit to last 500 rows
    const recent = rows.length > 500 ? rows.slice(rows.length - 500) : rows;
    const items = recent.map(r => {
      const o = {};
      headers.forEach((h, i) => o[h] = r[i]);
      return o;
    });
    return jsonpResponse(e, { success: true, items: items });
  } catch (err) {
    return jsonpResponse(e, { success: false, error: err.message });
  }
}

// POST: accepts form-data (iframe) or JSON; supports photo dataURL in 'photo' field
function doPost(e) {
  try {
    const sh = getSheet();
    // detect form or JSON
    let data = {};
    if (e.postData && e.postData.type === 'application/json') {
      data = JSON.parse(e.postData.contents || '{}');
    } else {
      data = e.parameter || {};
    }

    // prepare row with photo_url column at end
    const row = [
      Utilities.getUuid(),
      data.type || "",
      data.item || "",
      data.description || "",
      data.location || "",
      data.contact || "",
      new Date().toISOString(),
      data.date_event || "",
      data.reporter || "",
      "open",
      "" // photo_url placeholder
    ];

    // handle photo if present (data.photo = dataURL)
    if (data.photo && typeof data.photo === 'string' && data.photo.indexOf('data:') === 0) {
      try {
        const m = data.photo.match(/^data:(.+);base64,(.*)$/);
        if (m && m.length === 3) {
          const mime = m[1];
          const b64 = m[2];
          const bytes = Utilities.base64Decode(b64);
          const ext = mime.split('/')[1] || 'png';
          const fname = (data.item ? data.item.replace(/[^\w\-]+/g, '_') : 'photo') + '.' + ext;
          const blob = Utilities.newBlob(bytes, mime, fname);
          const file = DriveApp.createFile(blob);
          // try to make viewable
          try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
          row[row.length - 1] = file.getUrl();
        }
      } catch (photoErr) {
        Logger.log('Photo handling error: ' + photoErr);
        // continue without photo
      }
    }

    // append the row
    sh.appendRow(row);

    // return tiny HTML to iframe caller
    return HtmlService.createHtmlOutput("OK");
  } catch (err) {
    return HtmlService.createHtmlOutput("ERROR: " + err.message);
  }
}
