/* updated script.js
   - Ensures Cloudinary response is handled reliably:
     sets #imageUrl to secure_url (or builds from public_id), shows preview
   - Keeps existing upload, preview, fetch, submit flows and auto reportedDate
   - No logic changes beyond robust Cloudinary handling
*/

const SHEET_API_URL = "https://lostfound.anandaswaroopa16.workers.dev"; // keep your current endpoint
const CLOUD_NAME = "do48yblyi";
const UPLOAD_PRESET = "lostandfound";

const MAX_IMAGE_WIDTH = 700;
const IMAGE_QUALITY = 0.6;
const FETCH_RETRIES = 2;

document.addEventListener("DOMContentLoaded", () => {
  // DOM refs (defensive)
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

  function log(...a){ try{ console.log("[LF]", ...a); }catch(e){} }
  function escapeHtml(s=""){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function sanitizeUrl(u=""){ try{ return new URL(u).href; }catch(e){ return u||""; } }

  /* ---------- preview helper ---------- */
  function showPreview(url){
    try {
      let wrap = document.getElementById("imagePreviewWrap");
      if(!wrap){
        wrap = document.createElement("div"); wrap.id="imagePreviewWrap"; wrap.style.marginTop="8px";
        if(imageUrlInput && imageUrlInput.parentNode) imageUrlInput.parentNode.appendChild(wrap);
      }
      wrap.innerHTML = "";
      if(!url) return;
      const img = document.createElement("img");
      img.src = url; img.alt = "Preview";
      img.style.width="120px"; img.style.height="80px"; img.style.objectFit="cover"; img.style.borderRadius="6px";
      img.addEventListener("error", ()=> img.style.display='none');
      wrap.appendChild(img);
      const a = document.createElement("a");
      a.href = url; a.target="_blank"; a.rel="noopener"; a.textContent = "Open image";
      a.style.fontSize = "13px"; a.style.marginLeft="8px"; a.style.color = "#0b6";
      wrap.appendChild(a);
    } catch(e){ log("showPreview failed", e); }
  }

  /* ---------- compression ---------- */
  function compressImageFile(file, maxWidth, quality){
    return new Promise((resolve,reject)=>{
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = ()=>{
          const ratio = img.width / (img.height || 1);
          const w = Math.min(maxWidth, img.width || maxWidth);
          const h = Math.round(w / (ratio || 1));
          const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d"); ctx.drawImage(img,0,0,w,h);
          canvas.toBlob(blob => { if(!blob) return reject(new Error("Compression failed")); resolve(blob); }, "image/jpeg", quality);
        };
        img.onerror = err => reject(err || new Error("Image load error"));
        img.src = e.target.result;
      };
      reader.onerror = err => reject(err || new Error("File read error"));
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Cloudinary upload (with robust response handling) ---------- */
  async function uploadBlobToCloudinary(blob, filename){
    const form = new FormData();
    form.append("file", blob, filename || ("upload_" + Date.now() + ".jpg"));
    form.append("upload_preset", UPLOAD_PRESET);
    const url = "https://api.cloudinary.com/v1_1/" + encodeURIComponent(CLOUD_NAME) + "/image/upload";
    log("upload ->", url, "preset=", UPLOAD_PRESET);

    const resp = await fetch(url, { method: "POST", body: form });
    const text = await resp.text();
    log("Cloudinary raw status=", resp.status, "text-start=", text.slice(0,400));
    if(!resp.ok){
      throw new Error("Cloudinary error " + resp.status + ": " + text.slice(0,400));
    }
    let json;
    try { json = JSON.parse(text); } catch (e) { throw new Error("Cloudinary returned invalid JSON"); }
    return json;
  }

  /* ---------- File change handler (integrates cloudResp handling) ---------- */
  if(imageFileInput){
    imageFileInput.addEventListener("change", async (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if(!file) return;
      if(window.uploadInProgress){ alert("Please wait for ongoing upload."); return; }
      window.uploadInProgress = true;
      if(uploadStatus) uploadStatus.textContent = "Compressing & uploading...";
      if(submitBtn) submitBtn.disabled = true;

      try {
        log("Selected file:", file.name, file.size, file.type);
        const blob = await compressImageFile(file, MAX_IMAGE_WIDTH, IMAGE_QUALITY);
        log("Compressed size:", blob.size);
        try {
          const cloudResp = await uploadBlobToCloudinary(blob, file.name);
          log("Cloudinary parsed response:", cloudResp);

          // === START: robust handling of cloudResp (sets #imageUrl and shows preview) ===
          try {
            let imageUrl = cloudResp.secure_url || cloudResp.url || "";
            if(!imageUrl && cloudResp.public_id){
              const fmt = cloudResp.format || "jpg";
              imageUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${encodeURIComponent(cloudResp.public_id)}.${fmt}`;
              log("built imageUrl from public_id:", imageUrl);
            }
            if(!imageUrl) throw new Error("No image URL in Cloudinary response. Keys: " + Object.keys(cloudResp).join(","));
            // set the input and preview
            if(imageUrlInput) imageUrlInput.value = imageUrl;
            showPreview(imageUrl);
            if(uploadStatus) uploadStatus.textContent = "Uploaded ✓";
            log("Upload success, imageUrl=", imageUrl);
          } catch(handleErr){
            // If handling fails, show error and fallback to data URL preview
            console.warn("cloudResp handling failed:", handleErr);
            // fallback to data URL preview
            const reader = new FileReader();
            await new Promise((resolve) => {
              reader.onload = () => {
                const dataUrl = reader.result;
                if(imageUrlInput) imageUrlInput.value = dataUrl;
                showPreview(dataUrl);
                if(uploadStatus) uploadStatus.textContent = "Preview ready (data URL)";
                resolve();
              };
              reader.onerror = () => { if(uploadStatus) uploadStatus.textContent = "Upload failed"; resolve(); };
              reader.readAsDataURL(blob);
            });
          }
          // === END cloudResp handling ===

        } catch(cloudErr){
          // Cloudinary upload failed; fallback to local data URL preview so user has something
          console.error("Cloudinary upload failed:", cloudErr);
          const fr = new FileReader();
          await new Promise((resolve) => {
            fr.onload = () => {
              const dataUrl = fr.result;
              if(imageUrlInput) imageUrlInput.value = dataUrl;
              showPreview(dataUrl);
              if(uploadStatus) uploadStatus.textContent = "Preview ready (data URL)";
              resolve();
            };
            fr.onerror = () => { if(uploadStatus) uploadStatus.textContent = "Upload failed"; resolve(); };
            fr.readAsDataURL(blob);
          });
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

  /* ---------- helper fetch with small retry ---------- */
  async function simpleFetch(url, opts={}, retries=FETCH_RETRIES){
    let lastErr = null;
    for(let i=0;i<retries;i++){
      try {
        const r = await fetch(url, opts);
        if(!r.ok) throw new Error("Network response not ok: " + r.status);
        return r;
      } catch(err){
        lastErr = err;
        await new Promise(res => setTimeout(res, 300 * (i+1)));
      }
    }
    throw lastErr || new Error("Fetch failed");
  }

  /* ---------- fetchItems ---------- */
  async function fetchItems(){
    if(!itemsGrid) return;
    itemsGrid.innerHTML = '<div class="muted" style="padding:12px">Loading items...</div>';
    try {
      if(!SHEET_API_URL) throw new Error("SHEET_API_URL not set");
      const res = await simpleFetch(SHEET_API_URL + '?action=getItems', { cache:'no-cache', mode:'cors' });
      const text = await res.text();

      // detect HTML sign-in page (common Apps Script problem)
      if (/<html|<!doctype html/i.test(text.slice(0,200))) {
        throw new Error("Server returned HTML (likely login/consent). Ensure Apps Script is deployed as 'Execute as: Me' and 'Anyone, even anonymous', or use your Worker proxy.");
      }
      const json = JSON.parse(text);
      const rawItems = Array.isArray(json) ? json : (json.items || []);
      window.cachedItems = (rawItems || []).map(i => {
        const obj = {};
        try { Object.keys(i||{}).forEach(k => obj[k.trim()] = String(i[k]||"").trim()); } catch(e){}
        return {
          title: obj.title || obj.Title || obj.name || "",
          description: obj.description || obj.Description || "",
          place: obj.place || obj.Place || "",
          date: obj.date || obj.Date || "",
          imageUrl: obj.imageUrl || obj.imageURL || obj.Image || "",
          contact: obj.contact || obj.Contact || "",
          type: obj.type || obj.Type || "",
          reportedDate: obj.reportedDate || obj.timestamp || ""
        };
      });
      renderItems();
    } catch(err){
      console.error("fetchItems error:", err);
      itemsGrid.innerHTML = '<div class="error" style="padding:12px">Could not load items: ' + escapeHtml(String(err.message || err)) + '</div>';
    }
  }

  /* ---------- render helpers ---------- */
  function cardHtml(item){
    const img = item.imageUrl ? `<img loading="lazy" src="${escapeHtml(sanitizeUrl(item.imageUrl))}" alt="${escapeHtml(item.title||'item')}">` : '<div class="placeholder" style="width:120px;height:80px;background:#f4f6f8;border-radius:6px"></div>';
    const tag = (item.type && String(item.type).toLowerCase()==="found") ? '<span class="tag found">Found</span>' : '<span class="tag lost">Lost</span>';
    return `<article class="card"><div class="thumb">${img}</div><div class="body">${tag}<h3>${escapeHtml(item.title||'Untitled')}</h3><p class="desc">${escapeHtml(item.description||'')}</p><p><b>Place:</b> ${escapeHtml(item.place||'—')}</p><p><b>Occurred:</b> ${escapeHtml(item.date||'—')}</p><p><b>Reported:</b> ${escapeHtml(item.reportedDate||'—')}</p><p><b>Contact:</b> ${escapeHtml(item.contact||'—')}</p></div></article>`;
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
      img.addEventListener('error', ()=> { img.style.display='none'; if(img.parentNode && !img.parentNode.querySelector('.placeholder')) img.parentNode.insertAdjacentHTML('beforeend','<div class="placeholder" style="width:120px;height:80px;background:#f4f6f8;border-radius:6px"></div>'); });
    });
  }

  /* ---------- submit handler (reportedDate auto) ---------- */
  if(formEl){
    try { const clone = formEl.cloneNode(true); formEl.parentNode.replaceChild(clone, formEl); window.formEl = clone; } catch(e){ window.formEl = formEl; }
    window.formEl.addEventListener('submit', async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      if(window.uploadInProgress){ alert("Please wait until image upload completes."); return; }
      const titleEl = document.getElementById('title');
      if(!titleEl || !titleEl.value.trim()){ alert("Please enter the item name."); if(titleEl) titleEl.focus(); return; }

      const payload = {
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

      if(submitBtn) submitBtn.disabled = true;
      if(submitMsg) submitMsg.textContent = 'Submitting...';
      log("Submitting payload", payload);

      try{
        const params = new URLSearchParams();
        Object.keys(payload).forEach(k => params.append(k, payload[k] || ''));
        if(!SHEET_API_URL) throw new Error("SHEET_API_URL not defined");
        const res = await fetch(SHEET_API_URL, { method:'POST', body: params, mode:'cors' });
        const text = await res.text();
        log("Submit raw response", text.slice(0,400));
        if (/<html|<!doctype html/i.test(text.slice(0,200))) {
          throw new Error("Server returned HTML (likely login/consent). Ensure Apps Script is deployed as 'Execute as: Me' and 'Who has access: Anyone, even anonymous', or use your Worker proxy.");
        }
        const json = JSON.parse(text);
        if(!json || (json.success !== true && json.success !== 'true')) throw new Error('Server error: ' + (json.message || JSON.stringify(json)));
        if(submitMsg) submitMsg.textContent = 'Added ✓';
        try { window.cachedItems.unshift({
          title: payload.title,
          description: payload.description,
          place: payload.place,
          date: payload.date,
          imageUrl: payload.imageUrl,
          contact: payload.contact,
          type: payload.type,
          reportedDate: payload.reportedDate,
          timestamp: payload.timestamp
        }); renderItems(); } catch(e){ log("UI update skipped", e); }
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

  if(searchBox){ let t=0; searchBox.addEventListener('input', ()=>{ clearTimeout(t); t=setTimeout(renderItems, 150); }); }

  // initial load
  fetchItems();
});
