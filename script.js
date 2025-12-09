/* updated script.js — improved upload debugging + preview
   Cloudinary: do48yblyi / lostandfound
   Sheet Worker: https://lostfound.anandaswaroopa16.workers.dev
*/

const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbxgfPFloo-72SZ-VedN3x2G0OaSrSvRGQ7sR3a22btFNhq3-9J_-lzyuuaxFTLNzHeE0g/exec";
const CLOUD_NAME = "do48yblyi";
const UPLOAD_PRESET = "lostandfound";

const MAX_IMAGE_WIDTH = 700;
const IMAGE_QUALITY = 0.6;

document.addEventListener("DOMContentLoaded", () => {
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

  // create preview element under imageUrl input (if not present)
  function ensurePreview() {
    let p = document.getElementById('imagePreviewWrap');
    if (p) return p;
    p = document.createElement('div');
    p.id = 'imagePreviewWrap';
    p.style.marginTop = '8px';
    p.style.display = 'flex';
    p.style.alignItems = 'center';
    p.style.gap = '10px';
    if (imageUrlInput && imageUrlInput.parentNode) {
      imageUrlInput.parentNode.appendChild(p);
    } else if (imageFileInput && imageFileInput.parentNode) {
      imageFileInput.parentNode.appendChild(p);
    }
    return p;
  }

  function showPreview(url){
    const wrap = ensurePreview();
    wrap.innerHTML = '';
    if(!url) return;
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Preview';
    img.style.width = '120px';
    img.style.height = '80px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '6px';
    img.addEventListener('error', () => { img.style.display = 'none'; });
    wrap.appendChild(img);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Open image';
    a.style.fontSize = '13px';
    a.style.color = '#0b6';
    wrap.appendChild(a);
  }

  /* ---------- UTIL ---------- */
  function logDebug(...args){
    // visible console logging helper
    try { console.log('[LF]', ...args); } catch(e){}
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
    logDebug('Uploading to Cloudinary', url, 'preset=', UPLOAD_PRESET);

    const res = await fetch(url, { method: "POST", body: form });
    const text = await res.text();
    logDebug('Cloudinary raw response status=', res.status, 'text=', text.slice(0,300));
    if (!res.ok) {
      // attach body for debugging
      throw new Error('Cloudinary upload failed: status ' + res.status + ' body: ' + text.slice(0,300));
    }
    try {
      return JSON.parse(text);
    } catch(e) {
      throw new Error('Cloudinary returned invalid JSON: ' + text.slice(0,300));
    }
  }

  imageFileInput && imageFileInput.addEventListener('change', async function(ev){
    var f = ev.target.files && ev.target.files[0];
    if (!f) return;
    if (window.uploadInProgress) { alert("Please wait for current upload to finish."); return; }
    window.uploadInProgress = true;
    if (uploadStatus) uploadStatus.textContent = "Compressing & uploading...";
    if (submitBtn) submitBtn.disabled = true;

    try {
      logDebug('Selected file', f.name, f.size, f.type);
      var blob = await compressImageFile(f, MAX_IMAGE_WIDTH, IMAGE_QUALITY);
      logDebug('Compressed blob size', blob.size);
      var cloudResp = await uploadToCloudinary(blob, f.name || ("upload_" + Date.now() + ".jpg"));
      logDebug('Cloudinary parsed response', cloudResp);
      // prefer secure_url, then url, then construct from public_id
      var imageUrl = cloudResp.secure_url || cloudResp.url || (cloudResp.public_id ? ('https://res.cloudinary.com/' + CLOUD_NAME + '/image/upload/' + encodeURIComponent(cloudResp.public_id) + '.jpg') : '');
      if(!imageUrl){
        // show entire response text in console and throw
        throw new Error('No image URL found in Cloudinary response. Response: ' + JSON.stringify(cloudResp).slice(0,400));
      }
      // fill input and show preview
      if(imageUrlInput) imageUrlInput.value = imageUrl;
      showPreview(imageUrl);
      if (uploadStatus) uploadStatus.textContent = "Uploaded ✓";
      logDebug('Upload succeeded, imageUrl set');
    } catch (err) {
      console.error('Upload error:', err);
      if (uploadStatus) uploadStatus.textContent = "Upload failed: " + (err.message || err);
      alert('Image upload failed: ' + (err.message || err));
      // keep imageUrl input unchanged
    } finally {
      window.uploadInProgress = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  /* ---------- fetch items / render (unchanged) ---------- */

  function escapeHtml(str = "") { return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function sanitizeUrl(url = "") { try { return new URL(url).href; } catch(e) { return url; } }
  function formatDate(val){ if(!val) return ""; var d=new Date(val); if(isNaN(d.getTime())) return val; return d.toLocaleDateString("en-IN",{year:"numeric",month:"short",day:"numeric"}); }
  function formatDateTime(val){ if(!val) return ""; var d=new Date(val); if(isNaN(d.getTime())) return val; return d.toLocaleString("en-IN",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); }
  function placeholderSvgHtml(){ return '<svg class="placeholder-img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#f5f6f7"/><g fill="#c7c9cc"><rect x="10" y="10" width="44" height="12" rx="3"/><rect x="10" y="28" width="44" height="26" rx="3"/></g></svg>'; }

  function normalizeItem(raw){
    var it = {};
    try { Object.keys(raw || {}).forEach(function(k){ it[k.trim()] = String(raw[k] || "").trim(); }); } catch(e){}
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
             '<div class="body">' + tag +
               '<h3>' + escapeHtml(item.title || "Untitled") + '</h3>' +
               '<p class="desc">' + escapeHtml(item.description || "") + '</p>' +
               '<p><b>Place:</b> ' + escapeHtml(item.place || "—") + '</p>' +
               '<p><b>Occurred:</b> ' + escapeHtml(formatDate(item.date) || "—") + '</p>' +
               '<p><b>Reported:</b> ' + escapeHtml(formatDateTime(item.reportedDate) || "—") + '</p>' +
               '<p><b>Contact:</b> ' + escapeHtml(item.contact || "—") + '</p>' +
             '</div></article>';
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
    Array.prototype.forEach.call(itemsGrid.querySelectorAll('.thumb img'), function(img){
      img.addEventListener('error', function(){ img.style.display = 'none'; if (img.parentNode && !img.parentNode.querySelector('svg')) img.parentNode.insertAdjacentHTML('beforeend', placeholderSvgHtml()); });
    });
  }

  /* ---------- submit (unchanged behavior) ---------- */
  (function attachSubmit(){
    if (!formEl) { console.error('#itemForm not found — cannot attach submit handler'); return; }
    try { var cloned = formEl.cloneNode(true); formEl.parentNode.replaceChild(cloned, formEl); window.formEl = cloned; } catch(e) { window.formEl = formEl; }

    window.formEl.addEventListener('submit', async function(ev){
      ev.preventDefault(); ev.stopPropagation();
      if (window.uploadInProgress) { alert("Please wait until the image upload completes."); return; }
      var titleEl = document.getElementById('title');
      if (!titleEl || !titleEl.value.trim()) { alert("Please enter the item name."); if (titleEl) titleEl.focus(); return; }

      var payload = {
        action: 'appendItem',
        timestamp: new Date().toISOString(),
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
      logDebug('Submitting payload', payload);

      try {
        var params = new URLSearchParams(); Object.keys(payload).forEach(function(k){ params.append(k, payload[k] || ''); });
        if (!SHEET_API_URL) throw new Error("SHEET_API_URL not defined");
        var res = await fetch(SHEET_API_URL, { method: 'POST', body: params, mode: 'cors' });
        logDebug('Submit network status', res.status);
        var text = await res.text(); logDebug('Submit raw response', text.slice(0,400));
        var json;
        try { json = JSON.parse(text); } catch(e) { throw new Error('Server returned non-JSON response: ' + text.slice(0,300)); }
        if (!json || (json.success !== true && json.success !== 'true')) throw new Error('Server error: ' + (json && json.message ? json.message : JSON.stringify(json)));
        if (submitMsgEl) submitMsgEl.textContent = 'Added ✓';
        try { window.cachedItems.unshift(normalizeItem(payload)); renderItems(); } catch(e){ console.warn('UI update skipped', e); }
        window.formEl.reset(); if (uploadStatus) uploadStatus.textContent = ''; setTimeout(function(){ if (submitMsgEl) submitMsgEl.textContent = ''; }, 1200);
      } catch (err) {
        console.error('Submit failed:', err);
        alert('Submit failed: ' + (err.message || err));
        if (submitMsgEl) submitMsgEl.textContent = 'Submit failed';
      } finally { if (submitBtn) submitBtn.disabled = false; }
    }, false);

    logDebug('Submit handler attached');
  })();

  if (searchBox) {
    var searchTimer = 0;
    searchBox.addEventListener('input', function(){
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderItems, 150);
    });
  }

  fetchItems();
});
