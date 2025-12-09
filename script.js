// final script.js — ready to paste into your GitHub repo
// Proxy Worker URL (YOUR Worker)
const PROXY_URL = 'https://lostfound.anandaswaroopa16.workers.dev';
const SHEET_API_URL = PROXY_URL; // used for getItems, uploadImage, and append

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const logoWrap = document.getElementById('logoWrap');
  const itemsGrid = document.getElementById('itemsGrid');
  const itemsEmpty = document.getElementById('itemsEmpty');
  const searchBox = document.getElementById('searchBox');

  const imageFileInput = document.getElementById('imageFile');
  const imageUrlInput = document.getElementById('imageUrl');
  const uploadStatus = document.getElementById('uploadStatus');
  const submitBtn = document.getElementById('submitBtn');
  const formEl = document.getElementById('itemForm');
  const submitMsgEl = document.getElementById('submitMsg');

  // State
  let cachedItems = [];
  let uploadInProgress = false;

  /* ---------- Utilities ---------- */
  function escapeHtml(str='') {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function parseDateValue(v) {
    if(!v) return null;
    const d = new Date(String(v));
    if(!isNaN(d.getTime())) return d.getTime();
    const p = Date.parse(String(v));
    return isNaN(p) ? null : p;
  }
  function formatFriendlyDate(value) {
    if(!value) return '';
    const t = parseDateValue(value);
    if(!t) return String(value).slice(0,20);
    const d = new Date(t);
    return d.toLocaleString([], { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  }
  function formatOccurrenceDate(value) {
    if(!value) return '';
    const s = String(value).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m) {
      const year=+m[1], month=+m[2]-1, day=+m[3];
      const d = new Date(year, month, day);
      return d.toLocaleDateString([], { year:'numeric', month:'short', day:'numeric' });
    }
    const t = parseDateValue(s);
    if(!t) return s;
    return new Date(t).toLocaleDateString([], { year:'numeric', month:'short', day:'numeric' });
  }

  function sanitizeUrl(u='') {
    if(!u) return '';
    if(u.includes('drive.google.com') || u.includes('docs.google.com')) {
      try {
        if(u.indexOf('/file/d/') !== -1) {
          const id = u.split('/file/d/')[1].split('/')[0];
          if(id) return `https://drive.google.com/uc?id=${id}`;
        }
        if(u.indexOf('id=') !== -1) {
          const id = u.split('id=')[1].split('&')[0];
          if(id) return `https://drive.google.com/uc?id=${id}`;
        }
      } catch(e){}
    }
    try { return new URL(u).href; } catch(e){}
    return u;
  }

  function placeholderSvgHtml(){
    return `<svg class="placeholder-img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%"><rect width="64" height="64" rx="6" fill="#f5f6f7"/><g fill="#d8d9db"><rect x="8" y="10" width="48" height="12" rx="3"/><rect x="8" y="28" width="48" height="26" rx="3"/></g></svg>`;
  }

  function inlineSvgLogo(){
    return `<svg class="placeholder-img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
      <rect width="64" height="64" rx="10" fill="#eaf9d6"/><g fill="#6f8a24">
      <circle cx="20" cy="24" r="6"/><rect x="10" y="36" width="20" height="6" rx="2"/>
      <path d="M40 18h14v28H40z" fill="#cbeaa6"/><circle cx="47" cy="30" r="3" fill="#6f8a24"/></g></svg>`;
  }

  /* ---------- Logo ---------- */
  function loadLogo(){
    if(!logoWrap) return;
    logoWrap.innerHTML = '';
    const img = new Image();
    img.alt = 'Campus Logo';
    img.onload = () => { logoWrap.innerHTML=''; logoWrap.appendChild(img); };
    img.onerror = () => { logoWrap.innerHTML = inlineSvgLogo(); };
    img.src = 'cmrit_logo.webp'; // keep file in repo root (you already have cmrit_logo.webp)
  }
  loadLogo();

  /* ---------- Rendering items ---------- */
  function normalizeItem(raw){
    const it = {};
    Object.keys(raw || {}).forEach(k => it[k.trim()] = String(raw[k] || '').trim());
    return {
      title: it.title || it.Title || it.NAME || '',
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
    let imgUrl = sanitizeUrl(it.imageUrl || '');
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
            <h3 style="flex:1; margin:0">${escapeHtml(it.title || 'Untitled')}</h3>
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

  async function fetchItems(){
    if(!itemsGrid) return;
    itemsGrid.innerHTML = '<div class="muted" style="padding:12px">Loading items...</div>';
    try{
      if(!SHEET_API_URL || SHEET_API_URL.includes('REPLACE_WITH')) throw new Error('SHEET_API_URL not set. Edit script and add your Worker URL.');
      const res = await fetch(SHEET_API_URL + '?action=getItems', { cache: 'no-cache' });
      if(!res.ok) throw new Error('Network response not ok: ' + res.status);
      const json = await res.json();
      const items = Array.isArray(json) ? json : (json.items || []);
      cachedItems = items.map(normalizeItem);
      // most recent first
      cachedItems.sort((a,b)=>{
        const ta = parseDateValue(b.reportedDate || b.timestamp || '') || 0;
        const tb = parseDateValue(a.reportedDate || a.timestamp || '') || 0;
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
    const q = searchBox ? searchBox.value.trim().toLowerCase() : '';
    if(!cachedItems || cachedItems.length === 0){
      itemsGrid.innerHTML = '';
      if(itemsEmpty) itemsEmpty.style.display = 'block';
      return;
    }
    itemsEmpty.style.display = 'none';
    const filtered = cachedItems.filter(it => (`${it.title} ${it.description} ${it.place} ${it.contact} ${it.type}`).toLowerCase().includes(q));
    if(filtered.length === 0){
      itemsGrid.innerHTML = `<div class="muted" style="padding:12px">No matches for "<strong>${escapeHtml(q)}</strong>"</div>`;
      return;
    }
    itemsGrid.innerHTML = filtered.map(cardHtml).join('');
    // attach error fallback for images
    document.querySelectorAll('.card .thumb img').forEach(img => {
      img.addEventListener('error', () => {
        img.style.display = 'none';
        const p = img.parentElement;
        if(p && !p.querySelector('svg')) p.insertAdjacentHTML('beforeend', placeholderSvgHtml());
      });
    });
  }

  /* ---------- Image upload ---------- */
  function readFileAsDataURL(file){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  if(imageFileInput){
    imageFileInput.addEventListener('change', async (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if(!f) return;
      if(f.size > 8 * 1024 * 1024){ alert('Image too large. Choose an image < 8 MB.'); imageFileInput.value=''; return; }
      if(uploadInProgress){ alert('Another upload in progress. Please wait.'); return; }
      uploadInProgress = true;
      if(uploadStatus) uploadStatus.textContent = 'Uploading image...';
      if(submitBtn) submitBtn.disabled = true;
      try{
        const dataUrl = await readFileAsDataURL(f);
        const params = new URLSearchParams();
        params.append('action','uploadImage');
        params.append('filename', f.name);
        params.append('imageBase64', dataUrl);
        const res = await fetch(SHEET_API_URL, { method: 'POST', body: params });
        const text = await res.text();
        let j;
        try { j = JSON.parse(text); } catch(e) { j = { success:false, message:'Invalid JSON', raw:text }; }
        if(!res.ok) throw new Error('Server returned status ' + res.status + (j && j.message ? (': ' + j.message) : ''));
        if(j && j.success){
          let imageUrl = '';
          if(j.url) imageUrl = j.url;
          else if(j.id) imageUrl = 'https://drive.google.com/uc?id=' + j.id;
          if(imageUrl){
            if(imageUrlInput) imageUrlInput.value = imageUrl;
            if(uploadStatus) uploadStatus.textContent = 'Uploaded ✓';
            console.log('Upload succeeded:', imageUrl);
          } else {
            if(uploadStatus) uploadStatus.textContent = '';
            alert('Image uploaded but server did not return a direct link. Please paste a public image URL manually.');
          }
        } else {
          throw new Error(j && j.message ? j.message : 'Upload failed');
        }
      } catch(err){
        console.error('Upload error', err);
        if(uploadStatus) uploadStatus.textContent = 'Upload failed';
        alert('Image upload failed: ' + err.message);
      } finally {
        uploadInProgress = false;
        if(submitBtn) submitBtn.disabled = false;
      }
    });
  }

  /* ---------- Form submit ---------- */
  if(formEl){
    formEl.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const titleEl = document.getElementById('title');
      if(!titleEl || !titleEl.value.trim()){
        alert('Please tell us what the item is.');
        if(titleEl) titleEl.focus();
        return;
      }
      if(uploadInProgress){
        alert('Please wait for the image upload to complete before submitting.');
        return;
      }
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
        const res = await fetch(SHEET_API_URL, { method: 'POST', body: params });
        if(!res.ok) throw new Error('Network response not ok: ' + res.status);
        const data = await res.json();
        if(data && (data.success === true || data === true)){
          submitMsgEl.textContent = 'Added ✓';
          cachedItems.unshift(normalizeItem(payload)); // show immediately
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
        alert('Submit failed: ' + err.message + '\nCheck that the Worker URL is correct and Apps Script is deployed.');
      } finally {
        if(submitBtn) submitBtn.disabled = false;
      }
    });
  }

  /* ---------- Search debounce ---------- */
  let searchTimer = 0;
  if(searchBox){
    searchBox.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderItems, 150);
    });
  }

  /* ---------- Init ---------- */
  fetchItems();
});
