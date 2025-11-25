// FINAL script.js (JSONP-safe, date display, preview, logo override)
// Replace API_URL if you redeploy Apps Script; keep this as the /exec URL.
const API_URL = "https://script.google.com/macros/s/AKfycbx6aMps78bYxgr1l_t0Tf7hHrk-CkLINr1oL-aykJMZ5Igc6WANjvKGvui4HIAcX_CzQA/exec";

// LOCAL UPLOADED LOGO PATH (testing only)
// The file you uploaded in this chat is available at: /mnt/data/0.png
// On GitHub Pages you should upload the same file to your repo and use "0.png" (or cmrit_logo.webp).
const LOGO_LOCAL_PATH = "/mnt/data/0.png";

// Set page logo (if image element exists). On GitHub use <img src="0.png"> in index.html instead.
(function setLogo() {
  try {
    const el = document.querySelector("img.cmr-logo");
    if (el) el.src = LOGO_LOCAL_PATH;
  } catch (e) {
    console.warn("logo override failed", e);
  }
})();

// ----------------------
// Utility: escape HTML
function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// ----------------------
// JSONP loader (generic)
function jsonpFetch(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    let timer = null;

    window[cb] = (data) => {
      clearTimeout(timer);
      resolve(data);
      // cleanup
      try { delete window[cb]; } catch(e) { window[cb] = undefined; }
      script.remove();
    };

    script.onerror = (err) => {
      clearTimeout(timer);
      reject(new Error("JSONP load error"));
      try { delete window[cb]; } catch(e) { window[cb] = undefined; }
      script.remove();
    };

    // timeout guard
    timer = setTimeout(() => {
      try { delete window[cb]; } catch(e) { window[cb] = undefined; }
      script.remove();
      reject(new Error("JSONP timeout"));
    }, timeout);

    script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb;
    document.body.appendChild(script);
  });
}

// ----------------------
// Load items (JSONP GET)
async function loadItems() {
  const list = document.getElementById("list");
  if (!list) return;
  list.innerHTML = "Loading...";

  try {
    const res = await jsonpFetch(API_URL);
    if (!res || !res.success) {
      list.innerHTML = "<li>No items or error</li>";
      console.warn("loadItems: invalid response", res);
      return;
    }

    const items = Array.isArray(res.items) ? res.items.slice().reverse() : [];
    if (items.length === 0) {
      list.innerHTML = "<li>No items yet</li>";
      return;
    }

    list.innerHTML = "";
    items.forEach(item => {
      const posted = item.date_reported ? formatDate(item.date_reported) : "—";
      const eventDate = item.date_event ? formatDate(item.date_event) : "—";
      const photoHtml = item.photo_url ? `<br><img src="${escapeHtml(item.photo_url)}" alt="photo">` : "";

      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${escapeHtml(item.item)}</strong> (${escapeHtml(item.type)})<br>
        ${escapeHtml(item.description)}<br>
        <small>
          📍 ${escapeHtml(item.location)} • 📞 ${escapeHtml(item.contact)}<br>
          Posted: ${posted} • Event: ${eventDate}
        </small>
        ${photoHtml}
      `;
      list.appendChild(li);
    });
  } catch (err) {
    console.error("loadItems error", err);
    list.innerHTML = "<li>Error loading items</li>";
  }
}

// small date helper
function formatDate(v) {
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toLocaleDateString();
  } catch (e) {
    return v;
  }
}

// ----------------------
// Photo preview (local only)
(function wirePhotoPreview() {
  const fileInput = document.getElementById("photoFile");
  const preview = document.getElementById("photoPreview");
  const hidden = document.getElementById("photo"); // we keep hidden field for optional future use
  if (!fileInput) return;

  fileInput.addEventListener("change", function () {
    const f = this.files && this.files[0];
    if (!f) {
      if (preview) preview.innerHTML = "";
      if (hidden) hidden.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      if (preview) preview.innerHTML = `<img src="${e.target.result}" style="max-width:120px;border-radius:6px;">`;
      if (hidden) hidden.value = e.target.result; // NOT sent in JSONP submit (too large)
      console.log("photo preview ready, base64 length=", (e.target.result||"").length);
    };
    reader.onerror = function(err) {
      console.error("photo reader error", err);
      if (preview) preview.innerHTML = "";
      if (hidden) hidden.value = "";
    };
    reader.readAsDataURL(f);
  });
})();

// ----------------------
// Submit via JSONP GET (no photos)
// This constructs a query string (fields truncated to avoid extremely long URLs)
document.getElementById("itemForm").addEventListener("submit", function(e) {
  e.preventDefault();
  const msg = document.getElementById("msg");
  msg.textContent = "Submitting... (photo not uploaded in this mode)";

  // gather values (IDs used in index.html)
  const params = {
    type: document.getElementById("type")?.value || "",
    item: document.getElementById("item")?.value || "",
    description: document.getElementById("description")?.value || "",
    location: document.getElementById("location")?.value || "",
    contact: document.getElementById("contact")?.value || "",
    date_event: document.getElementById("date_event")?.value || "",
    reporter: document.getElementById("reporter")?.value || ""
    // note: we intentionally DO NOT include large photo base64 in the GET
  };

  // limit field lengths (safety)
  const MAX = 700;
  Object.keys(params).forEach(k => {
    if (params[k] && params[k].length > MAX) params[k] = params[k].slice(0, MAX);
  });

  const qs = Object.keys(params).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k]||"")}`).join("&");
  const submitUrl = API_URL + (API_URL.includes("?") ? "&" : "?") + qs;

  // perform JSONP injection for submit (will call doGet and append)
  const cbname = "submitcb_" + Math.random().toString(36).slice(2);
  window[cbname] = function(res) {
    try {
      if (res && res.success) {
        msg.textContent = "Submitted!";
        document.getElementById("itemForm").reset();
        const pv = document.getElementById("photoPreview");
        if (pv) pv.innerHTML = "";
        // small delay to allow sheet write
        setTimeout(() => loadItems(), 700);
      } else {
        msg.textContent = "Submit failed";
        console.warn("submit response", res);
      }
    } finally {
      try { delete window[cbname]; } catch(e) { window[cbname] = undefined; }
      const s = document.getElementById(cbname);
      if (s) s.remove();
    }
  };

  const s = document.createElement("script");
  s.id = cbname;
  s.src = submitUrl + "&callback=" + cbname;
  s.onerror = function() {
    msg.textContent = "Network/submit error";
    try { delete window[cbname]; } catch(e) { window[cbname] = undefined; }
    s.remove();
  };
  document.body.appendChild(s);
});

// ----------------------
// initial load
document.addEventListener("DOMContentLoaded", function() {
  try {
    loadItems();
    console.log("script.js initialized (JSONP mode).");
  } catch (e) {
    console.error("initial load error", e);
  }
});
