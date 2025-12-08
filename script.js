/* final script.js - direct upload -> Drive (via Apps Script), show image on list
   1) set SHEET_API_URL to your deployed Apps Script /exec URL
   2) keep Apps Script deployed with Drive scopes (Execute as: Me) and public access
*/

const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbw33RvD6HF4zognGBKK9PhLn5zSTiQFhsgEYqG4louIt71zhT4e5n-p7KOx467fHbiaVQ/exec'; // <-- REPLACE with your /exec URL
const LOGO_PATH = 'cmrit_logo.webp';
const LOGO_ALT_TEXT = 'Campus Logo';

const itemsGrid = document.getElementById('itemsGrid');
const itemsEmpty = document.getElementById('itemsEmpty');
const searchBox = document.getElementById('searchBox');
const logoWrap = document.getElementById('logoWrap');

const imageFileInput = document.getElementById('imageFile');
const imageUrlInput = document.getElementById('imageUrl');
const uploadStatus = document.getElementById('uploadStatus');
const submitBtn = document.getElementById('submitBtn');
const formEl = document.getElementById('itemForm');
const submitMsgEl = document.getElementById('submitMsg');

let cachedItems = [];
let uploadInProgress = false;

/* ---------- Logo loader ---------- */
function loadLogo(){
  if(!logoWrap) return;
  logoWrap.innerHTML = '';
  if(!LOGO_PATH || LOGO_PATH.includes('REPLACE_WITH')){
    logoWrap.innerHTML = inlineSvgLogo();
    return;
  }
  const img = new Image();
  img.alt = LOGO_ALT_TEXT;
  img.onload = () => { logoWrap.innerHTML=''; logoWrap.appendChild(img); };
  img.onerror = () => { logoWrap.innerHTML = inlineSvgLogo(); };
  img.src = LOGO_PATH;
}
function inlineSvgLogo(){
  return `<svg class="placeholder-img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48" aria-hidden="true">
    <rect width="64" height="64" rx="10" fill="#eaf9d6"/><g fill="#6f8a24"><circle cx="20" cy="24" r="6"/><rect x="10" y="36" width="20" height="6" rx="2"/><path d="M40 18h14v28H40z" fill="#cbeaa6"/><circle cx="47" cy="30" r="3" fill="#6f8a24"/></g></svg>`;
}

/* ---------- Utilities ---------- */
function escapeHtml(str=''){ return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function parseDateValue(v){
  if(!v) return null;
  const d = new Date(String(v));
  if(!isNaN(d.getTime())) return d.getTime();
  const p = Date.parse(String(v));
  return isNaN(p) ? null : p;
}
function formatFriendlyDate(value){
  if(!value) return '';
  const t = parseDateValue(value);
  if(!t) return String(value).slice(0,20);
  const d = new Date(t);
  return d.toLocaleString([], { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}
function formatOccurrenceDate(value){
  if(!value) return '';
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m){
    const year=+m[1], month=+m[2]-1, day=+m[3];
    const d = new Date(Date.UTC(year,month,day));
    return d.toLocaleDateString([], { year:'numeric', month:'short', day:'numeric' });
  }
  const t = parseDateValue(s);
  if(!t) return s;
  return new Date(t).toLocaleDateString([], { year:'numeric', month:'short', day:'numeric' });
}

/* sanitize + convert Drive links to uc?id= form */
function sanitizeUrl(u=''){
  if(!u) return '';
  // Drive doc or file link -> convert if possible
  if(u.includes('drive.google.com') || u.includes('docs.google.com')){
    try{
      // If docs.google.com/document/d/... the image itself is inside doc (not usable directly).
      // If it's a file link /view or open?id= convert to uc?id=
      // 1) /file/d/FILEID/...
      if(u.indexOf('/file/d/') !== -1){
        const id = u.split('/file/d/')[1].split('/')[0];
        if(id) return `https://drive.google.com/uc?id=${id}`;
      }
      // 2) ?id=FILEID
      if(u.indexOf('id=') !== -1){
        const id = u.split('id=')[1].split('&')[0];
        if(id) return `https://drive.google.com/uc?id=${id}`;
      }
      // 3) docs.google.com/document/d/... (not an image) — cannot convert here
    }catch(e){}
  }
  // If it's already a valid URL, return as-is
  try { return new URL(u).href; } catch(e) {}
  return '';
}

/* ---------- Rendering ---------- */
function normalizeItem(raw){
  const it = {};
  Object.keys(raw || {}).forEach(k => it[k.trim()] = String(raw[k] || '').trim());
  return {
    title: it.title || it.Title || it.NAME || it.name || '',
    description: it.description || it.Description || it.desc || '',
    place: it.place || it.Place || '',
    date: it.date || it.Date || '',
    imageUrl: it.imageUrl || it.imageURL || it.Image || '',
    contact: it.contact || it.Contact || '',
    type: it.type || it.Type || '',
    reportedDate: it.reportedDate || it.reported || it.timestamp || '',
    timestamp: it.timestamp || it.Timestamp || '',
    raw: it
  };
}

function cardHtml(it){
  let imgUrl = sanitizeUrl(it.imageUrl);
  if(!imgUrl && it.imageUrl) imgUrl = it.imageUrl; // fallback: sometimes already usable
  const thumb = imgUrl ? `<img loading="lazy" src="${escapeHtml(imgUrl)}" alt="${escapeHtml(it.title||'item')}">` : placeholderSvgHtml();
  const tag = (it.type && it.type.toLowerCase() === 'found') ? `<span class="tag" style="background:#e8f6ff;color:#0b4f70">Found</span>` : `<span class="tag">Lost</span>`;
  const occurrenceText = formatOccurrenceDate(it.date);
  const reportedText = formatFriendlyDate(it.reportedDate || it.timestamp);

  return `
    <article class="card" role="article">
      <div class="thumb">${thumb}</div>
      <div class="body">
        <div style="display:flex; gap:8px; align-items:center;">
          ${tag}
          <h3 style="flex:1">${escapeHtml(it.title || 'Untitled')}</h3>
        </div>
        <div class="desc">${escapeHtml(it.description || '')}</div>
        <div class="meta">
          <div><strong>Place:</strong> ${escapeHtml(it.place || '—')}</div>
          <div><strong>Occurrence Date:</strong> ${escapeHtml(occurrenceText || '—')}</div>
          <div><strong>Reported on:</strong> ${escapeHtml(reportedText || '—')}</div>
          <div><strong>Contact:</strong> ${escapeHtml(it.contact || '—')}</div>
        </div>
      </div>
    </article>`;
}

function placeholderSvgHtml(){
  return `<svg class="placeholder-img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#f5f6f7"/><g fill="#c7c9cc"><rect x="10" y="10" width="44" height="12" rx="3"/><rect x="10" y="28" width="44" height="26" rx="3"/></g></svg>`;
}

/* ---------- Fetch items ---------- */
async function fetchItems(){
  if(!itemsGrid) return;
  itemsGrid.innerHTML = '<div class="muted" style="padding:12px">Loading items...</div>';
  try{
    if(!SHEET_API_URL || SHEET_API_URL.includes('REPLACE_WITH')) throw new Error('SHEET_API_URL not set. Edit script.js and paste your Web App /exec URL.');
    const res = await fetch(SHEET_API_URL + '?action=getItems', { cache:'no-cache' });
    if(!res.ok) throw new Error('Network response not ok: ' + res.status);
    const json = await res.json();
    const items = Array.isArray(json) ? json : (json.items || []);
    cachedItems = items.map(normalizeItem);

    cachedItems.sort((a,b)=>{
      const ta = parseDateValue(a.reportedDate || a.timestamp || '');
      const tb = parseDateValue(b.reportedDate || b.timestamp || '');
      if(!ta && !tb) return 0;
      if(!ta) return -1;
      if(!tb) return 1;
      return ta - tb;
    });

    renderItems();
  } catch(err){
    console.error('Error fetching items:', err);
    itemsGrid.innerHTML = `<div class="error" style="padding:12px">Could not load items. ${escapeHtml(err.message)}</div>`;
  }
}

function renderItems(){
  if(!itemsGrid) return;
  const query = searchBox ? searchBox.value.trim().toLowerCase() : '';
  if(!cachedItems || cachedItems.length === 0){
    itemsGrid.innerHTML = '';
    if(itemsEmpty) itemsEmpty.style.display = 'block';
    return;
  }
  if(itemsEmpty) itemsEmpty.style.display = 'none';
  const filtered = cachedItems.filter(it => `${it.title} ${it.description} ${it.place} ${it.contact} ${it.type}`.toLowerCase().includes(query));
  if(filtered.length === 0){
    itemsGrid.innerHTML = `<div class="muted" style="padding:12px">No matches for "<strong>${escapeHtml(query)}</strong>"</div>`;
    return;
  }
  itemsGrid.innerHTML = filtered.map(it => cardHtml(it)).join('');
  document.querySelectorAll('.card .thumb img').forEach(img=>{
    img.addEventListener('error', ()=> {
      img.style.display='none';
      const parent = img.parentElement;
      if(parent && !parent.querySelector('svg')) parent.insertAdjacentHTML('beforeend', placeholderSvgHtml());
    });
  });
}

// ---------- Image upload handler (form-encoded, no custom headers) ----------
if (imageFileInput) {
  imageFileInput.addEventListener('change', async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;

    // Quick size guard
    if (f.size > 8 * 1024 * 1024) {
      alert('Image too large. Choose an image smaller than 8 MB.');
      imageFileInput.value = '';
      return;
    }

    // Prevent re-entrant uploads
    if (uploadInProgress) {
      alert('An upload is already in progress. Please wait.');
      return;
    }
    uploadInProgress = true;
    if (uploadStatus) uploadStatus.textContent = 'Uploading image...';
    if (submitBtn) submitBtn.disabled = true;

    try {
      // Read file as data URL
      const dataUrl = await readFileAsDataURL(f);

      // Build form-encoded body — do NOT set Content-Type header manually
      const params = new URLSearchParams();
      params.append('action', 'uploadImage');
      params.append('filename', f.name);
      params.append('imageBase64', dataUrl);

      // Perform POST (no custom headers) — this avoids OPTIONS preflight
      const res = await fetch(SHEET_API_URL, {
        method: 'POST',
        body: params
      });

      // parse response
      const text = await res.text();
      let j;
      try { j = JSON.parse(text); } catch (e) { j = { success:false, message: 'Invalid JSON response', raw:text }; }

      if (!res.ok) {
        throw new Error('Server returned status ' + res.status + (j && j.message ? (': ' + j.message) : ''));
      }

      if (j && j.success && j.url) {
        // Fill the imageUrl with the server-returned direct link
        if (imageUrlInput) imageUrlInput.value = j.url;
        if (uploadStatus) uploadStatus.textContent = 'Uploaded ✓';
        console.log('Upload succeeded:', j.url);
      } else {
        throw new Error(j && j.message ? j.message : 'Upload failed, server response: ' + JSON.stringify(j));
      }
    } catch (err) {
      console.error('Upload error', err);
      if (uploadStatus) uploadStatus.textContent = 'Upload failed';
      alert('Image upload failed: ' + (err.message || err));
    } finally {
      uploadInProgress = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}


/* ---------- Form submit ---------- */
if(formEl){
  formEl.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    // require item name
    const titleEl = document.getElementById('title');
    if(!titleEl || !titleEl.value.trim()){ alert('Please tell us what the item is.'); if(titleEl) titleEl.focus(); return; }

    // if uploading, ask user to wait
    if(uploadInProgress){ alert('Please wait for the image upload to complete before submitting.'); return; }

    submitMsgEl.textContent = 'Submitting...';
    if(submitBtn) submitBtn.disabled = true;

    const payload = {
      timestamp: new Date().toISOString(),
      reportedDate: new Date().toISOString(),
      type: document.getElementById('type') ? document.getElementById('type').value : '',
      title: document.getElementById('title') ? document.getElementById('title').value.trim() : '',
      description: document.getElementById('desc') ? document.getElementById('desc').value.trim() : '',
      place: document.getElementById('place') ? document.getElementById('place').value.trim() : '',
      date: document.getElementById('date') ? document.getElementById('date').value || '' : '',
      imageUrl: imageUrlInput ? imageUrlInput.value.trim() : '',
      contact: document.getElementById('contact') ? document.getElementById('contact').value.trim() : ''
    };

    try{
      const params = new URLSearchParams();
      Object.keys(payload).forEach(k => params.append(k, payload[k] || ''));
      const res = await fetch(SHEET_API_URL, { method:'POST', body: params });
      if(!res.ok) throw new Error('Network response not ok: ' + res.status);
      const data = await res.json();
      if(data && (data.success === true || data === true)){
        submitMsgEl.textContent = 'Added ✓';
        cachedItems.push(normalizeItem(payload));
        renderItems();
        formEl.reset();
        if(uploadStatus) uploadStatus.textContent = '';
        setTimeout(()=> submitMsgEl.textContent = '', 900);
      } else {
        throw new Error((data && data.message) ? data.message : 'Unknown server response');
      }
    } catch(err){
      console.error('Submit error', err);
      submitMsgEl.textContent = 'Failed to submit';
      alert('Submit failed: ' + err.message + '\nCheck that SHEET_API_URL is set and Apps Script is deployed.');
    } finally {
      if(submitBtn) submitBtn.disabled = false;
    }
  });
}

/* ---------- read file helper ---------- */
function readFileAsDataURL(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ---------- search debounce ---------- */
let searchTimer = 0;
if(searchBox){
  searchBox.addEventListener('input', ()=> {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderItems, 150);
  });
}

/* ---------- init ---------- */
loadLogo();
fetchItems();
