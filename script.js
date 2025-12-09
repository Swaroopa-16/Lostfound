/* final updated script.js
   - Robust Cloudinary upload (do48yblyi / lostandfound)
   - Auto reportedDate (no user input)
   - Sets #imageUrl with returned link and shows preview
   - Falls back to data-URL preview if Cloudinary fails
   - Submits action=appendItem to SHEET_API_URL
*/

const SHEET_API_URL = "https://lostfound.anandaswaroopa16.workers.dev"; // your Worker / sheet endpoint
const CLOUD_NAME = "do48yblyi";
const UPLOAD_PRESET = "lostandfound";

// compression controls
const MAX_IMAGE_WIDTH = 700;
const IMAGE_QUALITY = 0.6; // 0.0 - 1.0

document.addEventListener("DOMContentLoaded", () => {
  // Elements (must match index.html)
  const formEl = document.getElementById("itemForm");
  const imageFileInput = document.getElementById("imageFile");
  const imageUrlInput  = document.getElementById("imageUrl");
  const uploadStatus   = document.getElementById("uploadStatus");
  const submitBtn      = document.getElementById("submitBtn");
  const submitMsg      = document.getElementById("submitMsg");
  const itemsGrid      = document.getElementById("itemsGrid");
  const itemsEmpty     = document.getElementById("itemsEmpty");
  const searchBox      = document.getElementById("searchBox");

  window.uploadInProgress = false;
  window.cachedItems = window.cachedItems || [];

  /* ---------- Helpers ---------- */
  function log(...args){ try{ console.log("[LF]", ...args); } catch(e){} }
  function escapeHtml(s=""){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function sanitizeUrl(u=""){ try{ return new URL(u).href; } catch(e){ return u; } }
  function showPreview(url){
    let wrap = document.getElementById("imagePreviewWrap");
    if(!wrap){
      wrap = document.createElement("div");
      wrap.id = "imagePreviewWrap";
      wrap.style.marginTop = "8px";
      if(imageUrlInput && imageUrlInput.parentNode) imageUrlInput.parentNode.appendChild(wrap);
      else if(imageFileInput && imageFileInput.parentNode) imageFileInput.parentNode.appendChild(wrap);
    }
    wrap.innerHTML = "";
    if(!url) return;
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Preview";
    img.style.width = "120px";
    img.style.height = "80px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "6px";
    img.addEventListener("error", ()=> img.style.display = "none");
    wrap.appendChild(img);
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Open image";
    a.style.fontSize = "13px";
    a.style.marginLeft = "8px";
    a.style.color = "#0b6";
    wrap.appendChild(a);
  }

  /* ---------- Image compression ---------- */
  function compressImageFile(file, maxWidth, quality){
    return new Promise((resolve,reject)=>{
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = ()=>{
          const ratio = img.width / img.height || 1;
          const w = Math.min(maxWidth, img.width);
          const h = Math.round(w / ratio);
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img,0,0,w,h);
          canvas.toBlob(blob => {
            if(!blob) return reject(new Error("Compression failed"));
            resolve(blob);
          }, "image/jpeg", quality);
        };
        img.onerror = err => reject(err || new Error("Image load error"));
        img.src = e.target.result;
      };
      reader.onerror = err => reject(err || new Error("File read error"));
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Robust Cloudinary upload handler ---------- */
  async function uploadBlobToCloudinary(blob, filename){
    const form = new FormData();
    form.append("file", blob, filename || ("upload_" + Date.now() + ".jpg"));
    form.append("upload_preset", UPLOAD_PRESET);

    const url = "https://api.cloudinary.com/v1_1/" + encodeURIComponent(CLOUD_NAME) + "/image/upload";
    log("upload ->", url, "preset=", UPLOAD_PRESET);

    const resp = await fetch(url, { method: "POST", body: form });
    const text = await resp.text();
    log("Cloudinary raw status=", resp.status, "body-start=", text.slice(0,400));
    if(!resp.ok){
      throw new Error("Cloudinary error " + resp.status + ": " + text.slice(0,400));
    }
    let json;
    try { json = JSON.parse(text); } catch(e){ throw new Error("Cloudinary returned invalid JSON"); }
    return json;
  }

  /* ---------- File input change listener (replace old handler) ---------- */
  if(imageFileInput){
    imageFileInput.addEventListener("change", async function(ev){
      const file = ev.target.files && ev.target.files[0];
      if(!file) return;
      if(window.uploadInProgress){ alert("Please wait for ongoing upload to finish."); return; }

      window.uploadInProgress = true;
      if(uploadStatus) uploadStatus.textContent = "Compressing...";
      if(submitBtn) submitBtn.disabled = true;

      try {
        log("Selected file:", file.name, file.size, file.type);
        // compress
        const blob = await compressImageFile(file, MAX_IMAGE_WIDTH, IMAGE_QUALITY);
        log("Compressed size:", blob.size);

        // try Cloudinary upload
        try {
          const cloudResp = await uploadBlobToCloudinary(blob, file.name);
          log("Cloudinary parsed response:", cloudResp);
          // prefer secure_url, url, build from public_id if needed
          let imageUrl = cloudResp.secure_url || cloudResp.url || "";
          if(!imageUrl && cloudResp.public_id){
            const fmt = cloudResp.format || "jpg";
            imageUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${encodeURIComponent(cloudResp.public_id)}.${fmt}`;
            log("built imageUrl from public_id:", imageUrl);
          }
          if(!imageUrl) throw new Error("No image URL in Cloudinary response");
          // set input + preview
          if(imageUrlInput) imageUrlInput.value = imageUrl;
          try { showPreview(imageUrl); } catch(e){ log("preview fail", e); }
          if(uploadStatus) uploadStatus.textContent = "Uploaded ✓";
          log("Upload success:", imageUrl);
        } catch(cloudErr){
          // Cloudinary failed — fallback to data URL preview (works for small compressed images)
          log("Cloudinary upload failed:", cloudErr);
          const fallbackReader = new FileReader();
          fallbackReader.onload = function(e){
            const dataUrl = e.target.result;
            if(imageUrlInput) imageUrlInput.value = dataUrl;
            try { showPreview(dataUrl); } catch(e){ log("preview fail", e); }
            if(uploadStatus) uploadStatus.textContent = "Preview ready (data-url)";
            log("Fallback data URL set (for testing only)");
          };
          fallbackReader.onerror = function(e){ log("fallback read error", e); if(uploadStatus) uploadStatus.textContent = "Upload failed"; };
          fallbackReader.readAsDataURL(blob);
        }

      } catch(err){
        console.error("Image upload flow error:", err);
        alert("Image upload failed: " + (err.message || err));
        if(uploadStatus) uploadStatus.textContent = "Upload failed";
      } finally {
        window.uploadInProgress = false;
        if(submitBtn) submitBtn.disabled = false;
      }
    });
  }

  /* ---------- Fetch & render items (kept safe and simple) ---------- */
  function normalizeItem(raw){
    const it = {};
    try { Object.keys(raw||{}).forEach(k => it[k.trim()] = String(raw[k]||"").trim()); } catch(e){}
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
    const imgUrl = sanitizeUrl(item.imageUrl || "");
    const thumb = imgUrl ? `<img loading="lazy" src="${escapeHtml(imgUrl)}" alt="${escapeHtml(item.title||'item')}">` : '<div class="placeholder">No image</div>';
    const tag = (item.type && String(item.type).toLowerCase()==="found") ? '<span class="tag found">Found</span>' : '<span class="tag lost">Lost</span>';
    return `<article class="card"><div class="thumb">${thumb}</div><div class="body">${tag}<h3>${escapeHtml(item.title||'Untitled')}</h3><p class="desc">${escapeHtml(item.description||'')}</p><p><b>Place:</b> ${escapeHtml(item.place||'—')}</p><p><b>Occurred:</b> ${escapeHtml(item.date||'—')}</p><p><b>Reported:</b> ${escapeHtml(item.reportedDate||'—')}</p><p><b>Contact:</b> ${escapeHtml(item.contact||'—')}</p></div></article>`;
  }

  async function fetchItems(){
    if(!itemsGrid) return;
    itemsGrid.innerHTML = '<div class="muted" style="padding:12px">Loading items...</div>';
    try{
      if(!SHEET_API_URL) throw new Error("SHEET_API_URL not configured");
      const res = await fetch(SHEET_API_URL + '?action=getItems', { cache:'no-cache', mode:'cors' });
      if(!res.ok) throw new Error("Network response not ok: " + res.status);
      const json = await res.json();
      const items = Array.isArray(json) ? json : (json.items || []);
      window.cachedItems = items.map(normalizeItem);
      // newest first by reportedDate/timestamp
      window.cachedItems.sort((a,b)=> (new Date(b.reportedDate||b.timestamp||0).getTime() || 0) - (new Date(a.reportedDate||a.timestamp||0).getTime() || 0));
      renderItems();
    } catch(err){
      console.error("Error fetching items:", err);
      if(itemsGrid) itemsGrid.innerHTML = '<div class="error" style="padding:12px">Could not load items: ' + escapeHtml(String(err.message||err)) + '</div>';
    }
  }

  function renderItems(){
    if(!itemsGrid) return;
    const q = (searchBox && searchBox.value || "").trim().toLowerCase();
    if(!window.cachedItems || window.cachedItems.length === 0){
      itemsGrid.innerHTML = '';
      if(itemsEmpty) itemsEmpty.style.display = 'block';
      return;
    }
    if(itemsEmpty) itemsEmpty.style.display = 'none';
    const filtered = window.cachedItems.filter(it => ("" + (it.title + " " + it.description + " " + it.place + " " + it.contact + " " + it.type)).toLowerCase().includes(q));
    if(filtered.length===0){ itemsGrid.innerHTML = '<div class="muted" style="padding:12px">No matches</div>'; return; }
    itemsGrid.innerHTML = filtered.map(cardHtml).join('');
    Array.prototype.forEach.call(itemsGrid.querySelectorAll('.thumb img'), img => {
      img.addEventListener('error', ()=> { img.style.display='none'; if(img.parentNode && !img.parentNode.querySelector('svg')) img.parentNode.insertAdjacentHTML('beforeend','<div class="placeholder">No image</div>'); });
    });
  }

  /* ---------- Submit (reportedDate auto-filled) ---------- */
  if(formEl){
    // remove previous listeners safely
    try { const clone = formEl.cloneNode(true); formEl.parentNode.replaceChild(clone, formEl); window.formEl = clone; } catch(e){ window.formEl = formEl; }

    window.formEl.addEventListener('submit', async function(ev){
      ev.preventDefault(); ev.stopPropagation();
      if(window.uploadInProgress){ alert("Please wait until image upload completes."); return; }
      const titleEl = document.getElementById('title');
      if(!titleEl || !titleEl.value.trim()){ alert("Please enter the item name."); if(titleEl) titleEl.focus(); return; }

      const payload = {
        action: 'appendItem',
        timestamp: new Date().toISOString(),
        reportedDate: new Date().toISOString(), // auto
        type: (document.getElementById('type') && document.getElementById('type').value) || '',
        title: (document.getElementById('title') && document.getElementById('title').value.trim()) || '',
        description: (document.getElementById('desc') && document.getElementById('desc').value.trim()) || '',
        place: (document.getElementById('place') && document.getElementById('place').value.trim()) || '',
        date: (document.getElementById('date') && document.getElementById('date').value) || '',
        imageUrl: (imageUrlInput && imageUrlInput.value.trim()) || '',
        contact: (document.getElementById('contact') && document.getElementById('contact').value.trim()) || ''
      };

      if(submitBtn) submitBtn.disabled = true;
      if(submitMsg) submitMsg.textContent = 'Submitting...';
      log("Submitting payload", payload);

      try{
        const params = new URLSearchParams();
        Object.keys(payload).forEach(k => params.append(k, payload[k] || ''));
        if(!SHEET_API_URL) throw new Error("SHEET_API_URL not defined");
        const res = await fetch(SHEET_API_URL, { method:'POST', body: params, mode:'cors' });
        log("Submit network status", res.status);
        const text = await res.text();
        log("Submit raw response start", text.slice(0,400));
        let json;
        try { json = JSON.parse(text); } catch(e){ throw new Error('Server returned non-JSON response: ' + text.slice(0,300)); }
        if(!json || (json.success !== true && json.success !== 'true')) throw new Error('Server error: ' + (json && json.message ? json.message : JSON.stringify(json)));
        if(submitMsg) submitMsg.textContent = 'Added ✓';
        try { window.cachedItems.unshift(normalizeItem(payload)); renderItems(); } catch(e){ log("UI update skipped", e); }
        window.formEl.reset(); if(uploadStatus) uploadStatus.textContent = ''; showPreview('');
        setTimeout(()=> { if(submitMsg) submitMsg.textContent = ''; }, 1200);
      } catch(err){
        console.error("Submit failed:", err);
        alert("Submit failed: " + (err.message || err));
        if(submitMsg) submitMsg.textContent = 'Submit failed';
      } finally {
        if(submitBtn) submitBtn.disabled = false;
      }
    }, false);
  }

  if(searchBox){
    let t=0;
    searchBox.addEventListener('input', ()=>{ clearTimeout(t); t = setTimeout(renderItems, 150); });
  }

  // init
  fetchItems();
});
