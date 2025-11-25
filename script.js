// script.js — JSONP GET-based submit + load (no CORS), shows dates
const API_URL = "https://script.google.com/macros/s/AKfycbx6aMps78bYxgr1l_t0Tf7hHrk-CkLINr1oL-aykJMZ5Igc6WANjvKGvui4HIAcX_CzQA/exec";

function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function jsonpFetch(url) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).substring(2);
    window[cb] = (data) => {
      resolve(data);
      try { delete window[cb]; } catch(e) { window[cb] = undefined; }
      const el = document.getElementById(cb);
      if (el) el.remove();
    };
    const script = document.createElement("script");
    script.id = cb;
    script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'callback=' + cb;
    script.onerror = function() {
      reject(new Error('JSONP load error'));
      try { delete window[cb]; } catch(e) { window[cb] = undefined; }
      script.remove();
    };
    document.body.appendChild(script);
  });
}

async function loadItems() {
  const list = document.getElementById("list");
  if (!list) return;
  list.innerHTML = "Loading...";
  try {
    const res = await jsonpFetch(API_URL);
    if (!res || !res.success) {
      list.innerHTML = "<li>No items or error</li>";
      return;
    }
    const items = res.items || [];
    if (items.length === 0) {
      list.innerHTML = "<li>No items yet</li>";
      return;
    }
    list.innerHTML = "";
    items.reverse().forEach(item => {
      const posted = item.date_reported ? new Date(item.date_reported).toLocaleDateString() : "—";
      const eventDate = item.date_event ? new Date(item.date_event).toLocaleDateString() : "—";
      const photoHtml = item.photo_url ? `<br><img src="${escapeHtml(item.photo_url)}" style="max-width:120px;border-radius:6px;">` : '';
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${escapeHtml(item.item)}</strong> (${escapeHtml(item.type)})<br>
        ${escapeHtml(item.description)}<br>
        <small>Location: ${escapeHtml(item.location)} | Contact: ${escapeHtml(item.contact)}<br>
        Posted: ${posted} • Event: ${eventDate}</small>
        ${photoHtml}
      `;
      list.appendChild(li);
    });
  } catch (err) {
    list.innerHTML = "<li>Error loading items</li>";
    console.error(err);
  }
}

// preview only (does NOT upload the photo)
(function wirePreview(){
  const photoFileInput = document.getElementById('photoFile');
  const photoPreview = document.getElementById('photoPreview');
  if (!photoFileInput) return;
  photoFileInput.addEventListener('change', function() {
    const file = this.files && this.files[0];
    if (!file) { if (photoPreview) photoPreview.innerHTML = ''; return; }
    const reader = new FileReader();
    reader.onload = function(e){ if (photoPreview) photoPreview.innerHTML = `<img src="${e.target.result}" style="max-width:160px;max-height:120px;border-radius:6px;">`; };
    reader.readAsDataURL(file);
  });
})();

document.getElementById("itemForm").addEventListener("submit", function(e){
  e.preventDefault();
  const msg = document.getElementById("msg");
  msg.textContent = "Submitting... (no photo uploaded in this mode)";

  const params = {
    type: document.getElementById("type").value,
    item: document.getElementById("item").value,
    description: document.getElementById("description").value,
    location: document.getElementById("location").value,
    contact: document.getElementById("contact").value,
    date_event: document.getElementById("date_event").value,
    reporter: document.getElementById("reporter").value
  };

  const maxLen = 700;
  Object.keys(params).forEach(k => { if (params[k] && params[k].length > maxLen) params[k] = params[k].substring(0, maxLen); });

  const query = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join("&");
  const url = API_URL + "?" + query;

  const cb = "submitcb_" + Math.random().toString(36).substring(2);
  window[cb] = function(res) {
    try {
      if (res && res.success) {
        msg.textContent = "Submitted!";
        document.getElementById("itemForm").reset();
        document.getElementById("photoPreview").innerHTML = '';
        loadItems();
      } else {
        msg.textContent = "Submit failed";
      }
    } finally {
      try { delete window[cb]; } catch(e) { window[cb] = undefined; }
      const el = document.getElementById(cb);
      if (el) el.remove();
    }
  };

  const s = document.createElement("script");
  s.id = cb;
  s.src = url + "&callback=" + cb;
  s.onerror = function(){ msg.textContent = "Submit failed (network)"; try { delete window[cb]; } catch(e){}; s.remove(); };
  document.body.appendChild(s);
});

document.addEventListener('DOMContentLoaded', loadItems);
