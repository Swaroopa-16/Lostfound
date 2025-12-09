/* final script.js — Cloudinary upload + robust submit
   - Cloud name: do48yblyi
   - Upload preset: lostandfound
   - Sheet API URL: your Worker that proxies to Apps Script
*/

const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbw33RvD6HF4zognGBKK9PhLn5zSTiQFhsgEYqG4louIt71zhT4e5n-p7KOx467fHbiaVQ/exec"; // Worker (sheet API)
const CLOUD_NAME = "do48yblyi";
const UPLOAD_PRESET = "lostandfound";

// Compression settings
const MAX_IMAGE_WIDTH = 700;
const IMAGE_QUALITY = 0.6; // 0.0 - 1.0

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const imageFileInput = document.getElementById("imageFile");
  const imageUrlInput  = document.getElementById("imageUrl");
  const uploadStatus   = document.getElementById("uploadStatus");
  const submitBtn      = document.getElementById("submitBtn");
  const formEl         = document.getElementById("itemForm");
  const submitMsgEl    = document.getElementById("submitMsg");

  const itemsGrid      = document.getElementById("itemsGrid");
  const itemsEmpty     = document.getElementById("itemsEmpty");
  const searchBox      = document.getElementById("searchBox");

  window.uploadInProgress = false;
  window.cachedItems = window.cachedItems || [];

  /* ---------- Utilities ---------- */
  function escapeHtml(str = "") {
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function sanitizeUrl(url = "") {
    try { return new URL(url).href; } catch(e) { return url; }
  }

  function formatDate(val){
    if(!val) return "";
    var d = new Date(val);
    if(isNaN(d.getTime())) return val;
    return d.toLocaleDateString("en-IN", { year:"numeric", month:"short", day:"numeric" });
  }
  function formatDateTime(val){
    if(!val) return "";
    var d = new Date(val);
    if(isNaN(d.getTime())) return val;
    return d.toLocaleString("en-IN", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
  }

  function placeholderSvgHtml(){
    return '<svg class="placeholder-img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#f5f6f7"/><g fill="#c7c9cc"><rect x="10" y="10" width="44" height="12" rx="3"/><rect x="10" y="28" width="44" height="26" rx="3"/></g></svg>';
  }

  /* ---------- Image compression & Cloudinary upload ---------- */

  function readFileAsDataURL(file){
    return new Promise(function(resolve, reject){
      var r = new FileReader();
      r.onload = function(){ resolve(r.result); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function compressImageFile(file, maxWidth, quality) {
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(e){
        var img = new Image();
        img.onload = function(){
          var ratio = img.width / img.height || 1;
          var w = Math.min(maxWidth, img.width);
          var h = Math.round(w / ratio);
          var canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(function(blob){
            if (!blob) return reject(new Error("Compression failed"));
            resolve(blob);
          }, "image/jpeg", quality);
        };
        img.onerror = function(err){ reject(err || new Error("Image load error")); };
        img.src = e.target.result;
      };
      reader.onerror = function(err){ reject(err || new Error("File read error")); };
      reader.readAsDataURL(file);
    });
  }

  async function uploadToCloudinary(blob, filename) {
    var form = new FormData();
    form.append("file", blob, filename || ("upload_" + Date.now() + ".jpg"));
    form.append("upload_preset", UPLOAD_PRESET);
    var url = "https://api.cloudinary.com/v1_1/" + encodeURIComponent(CLOUD_NAME) + "/image/upload";
    var res = await fetch(url, { method: "POST", body: form });
    if (!res.ok) {
      var txt = await res.text();
      throw new Error("Cloudinary upload failed: " + res.status + " " + txt.slice(0,200));
    }
    return await res.json();
  }

  /* ---------- Image input handler ---------- */
  if (imageFileInput) {
    imageFileInput.addEventListener("change", async function(ev){
      var f = ev.target.files && ev.target.files[0];
      if (!f) return;
      if (window.uploadInProgress) { alert("Please wait for current upload to finish."); return; }
      window.uploadInProgress = true;
      if (uploadStatus) uploadStatus.textContent = "Compressing & uploading...";
      if (submitBtn) submitBtn.disabled = true;

      try {
        var blob = await compressImageFile(f, MAX_IMAGE_WIDTH, IMAGE_QUALITY);
        var cloudResp = await uploadToCloudinary(blob, f.name || ("upload_" + Date.now() + ".jpg"));
        var imageUrl = cloudResp && (cloudResp.secure_url || cloudResp.url);
        if (!imageUrl) throw new Error("Cloudinary did not return image URL");
        if (imageUrlInput) imageUrlInput.value = imageUrl;
        if (uploadStatus) uploadStatus.textContent = "Uploaded ✓";
        console.log("Image uploaded:", imageUrl);
      } catch (err) {
        console.error("Upload error:", err);
        if (uploadStatus) uploadStatus.textContent = "Upload failed";
        alert("Image upload failed: " + (err.message || err));
      } finally {
        window.uploadInProgress = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  /* ---------- Fetch & render items ---------- */

  function normalizeItem(raw){
    var it = {};
    try {
      Object.keys(raw || {}).forEach(function(k){ it[k.trim()] = String(raw[k] || "").trim(); });
    } catch(e){}
    return {
      title: it.title || it.Title || it.name || "",
      description: it.description || it.Description || "",
      place: it.place || it.Place || "",
      date: it.date || it.Date || "",
      imageUrl: it.imageUrl || it.imageURL || it.Image || "",
      contact: it.contact || it.Contact || "",
      type: it.type || it.Type || "",
      reportedDate: it.reportedDate || it.timestamp || ""
    };
  }

  function cardHtml(item){
    var imgUrl = sanitizeUrl(item.imageUrl || "");
    var thumb = imgUrl ? '<img loading="lazy" src="' + escapeHtml(imgUrl) + '" alt="' + escapeHtml(item.title || 'item') + '">' : placeholderSvgHtml();
    var tag = (item.type && String(item.type).toLowerCase() === "found") ? '<span class="tag found">Found</span>' : '<span class="tag lost">Lost</span>';
    return '<article class="card">' +
             '<div class="thumb">' + thumb + '</div>' +
             '<div class="body">' +
               tag +
               '<h3>' + escapeHtml(item.title || "Untitled") + '</h3>' +
               '<p class="desc">' + escapeHtml(item.description || "") + '</p>' +
               '<p><b>Place:</b> ' + escapeHtml(item.place || "—") + '</p>' +
               '<p><b>Occurred:</b> ' + escapeHtml(formatDate(item.date) || "—") + '</p>' +
               '<p><b>Reported:</b> ' + escapeHtml(formatDateTime(item.reportedDate) || "—") + '</p>' +
               '<p><b>Contact:</b> ' + escapeHtml(item.contact || "—") + '</p>' +
             '</div>' +
           '</article>';
  }

  async function fetchItems(){
    if (!itemsGrid) return;
    itemsGrid.innerHTML = '<div class="muted" style="padding:12px">Loading items...</div>';
    try {
      if (!SHEET_API_URL) throw new Error("SHEET_API_URL not configured");
      var res = await fetch(SHEET_API_URL + '?action=getItems', { cache: 'no-cache', mode: 'cors' });
      if (!res.ok) throw new Error("Network response not ok: " + res.status);
      var json = await res.json();
      var items = Array.isArray(json) ? json : (json.items || []);
      window.cachedItems = items.map(normalizeItem);
      // newest first by reportedDate/timestamp
      window.cachedItems.sort(function(a,b){
        var ta = new Date(a.reportedDate || a.timestamp || 0).getTime() || 0;
        var tb = new Date(b.reportedDate || b.timestamp || 0).getTime() || 0;
        return tb - ta;
      });
      renderItems();
    } catch (err) {
      console.error("Error fetching items:", err);
      itemsGrid.innerHTML = '<div class="error" style="padding:12px">Could not load items: ' + escapeHtml(String(err.message || err)) + '</div>';
    }
  }

  function renderItems(){
    if (!itemsGrid) return;
    var q = (searchBox && searchBox.value || "").trim().toLowerCase();
    if (!window.cachedItems || window.cachedItems.length === 0) {
      itemsGrid.innerHTML = '';
      if (itemsEmpty) itemsEmpty.style.display = 'block';
      return;
    }
    if (itemsEmpty) itemsEmpty.style.display = 'none';
    var filtered = window.cachedItems.filter(function(it){
      return ("" + (it.title + " " + it.description + " " + it.place + " " + it.contact + " " + it.type)).toLowerCase().indexOf(q) !== -1;
    });
    if (filtered.length === 0) {
      itemsGrid.innerHTML = '<div class="muted" style="padding:12px">No matches</div>';
      return;
    }
    itemsGrid.innerHTML = filtered.map(cardHtml).join('');
    // attach fallback on image error
    Array.prototype.forEach.call(itemsGrid.querySelectorAll('.thumb img'), function(img){
      img.addEventListener('error', function(){
        img.style.display = 'none';
        if (img.parentNode && !img.parentNode.querySelector('svg')) {
          img.parentNode.insertAdjacentHTML('beforeend', placeholderSvgHtml());
        }
      });
    });
  }

  /* ---------- Robust submit handler (reportedDate auto-filled) ---------- */
  (function attachSubmit(){
    if (!formEl) {
      console.error('#itemForm not found — cannot attach submit handler');
      return;
    }

    // remove existing listeners by replacing node (safe)
    try {
      var cloned = formEl.cloneNode(true);
      formEl.parentNode.replaceChild(cloned, formEl);
      window.formEl = cloned;
    } catch(e) { window.formEl = formEl; }

    window.formEl.addEventListener('submit', async function(ev){
      ev.preventDefault();
      ev.stopPropagation();

      if (window.uploadInProgress) {
        alert("Please wait until the image upload completes.");
        return;
      }

      var titleEl = document.getElementById('title');
      if (!titleEl || !titleEl.value.trim()) {
        alert("Please enter the item name.");
        if (titleEl) titleEl.focus();
        return;
      }

      var payload = {
        action: 'appendItem',
        timestamp: new Date().toISOString(),
        // reportedDate auto-generated (no user input)
        reportedDate: new Date().toISOString(),
        type: (document.getElementById('type') && document.getElementById('type').value) || '',
        title: (document.getElementById('title') && document.getElementById('title').value.trim()) || '',
        description: (document.getElementById('desc') && document.getElementById('desc').value.trim()) || '',
        place: (document.getElementById('place') && document.getElementById('place').value.trim()) || '',
        date: (document.getElementById('date') && document.getElementById('date').value) || '',
        imageUrl: (imageUrlInput && imageUrlInput.value.trim()) || '',
        contact: (document.getElementById('contact') && document.getElementById('contact').value.trim()) || ''
      };

      if (submitBtn) submitBtn.disabled = true;
      if (submitMsgEl) submitMsgEl.textContent = 'Submitting...';
      console.log('Submitting payload', payload);

      try {
        var params = new URLSearchParams();
        Object.keys(payload).forEach(function(k){ params.append(k, payload[k] || ''); });

        if (!SHEET_API_URL) throw new Error("SHEET_API_URL not defined");

        var res = await fetch(SHEET_API_URL, { method: 'POST', body: params, mode: 'cors' });
        console.log('Network status:', res.status);
        var text = await res.text();
        console.log('Server response text:', text);

        var json;
        try { json = JSON.parse(text); } catch(e) { throw new Error('Server returned non-JSON response: ' + text.slice(0,300)); }

        if (!json || (json.success !== true && json.success !== 'true')) {
          throw new Error('Server error: ' + (json && json.message ? json.message : JSON.stringify(json)));
        }

        // success
        if (submitMsgEl) submitMsgEl.textContent = 'Added ✓';
        // update UI optimistically
        try {
          window.cachedItems.unshift(normalizeItem(payload));
          renderItems();
        } catch(e) { console.warn('UI update skipped', e); }

        window.formEl.reset();
        if (uploadStatus) uploadStatus.textContent = '';
        setTimeout(function(){ if (submitMsgEl) submitMsgEl.textContent = ''; }, 1200);

      } catch (err) {
        console.error('Submit failed:', err);
        alert('Submit failed: ' + (err.message || err));
        if (submitMsgEl) submitMsgEl.textContent = 'Submit failed';
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }

    }, false);

    console.log('Submit handler attached');
  })();

  /* ---------- Search debounce ---------- */
  if (searchBox) {
    var searchTimer = 0;
    searchBox.addEventListener('input', function(){
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderItems, 150);
    });
  }

  /* Init fetch items */
  fetchItems();
});
