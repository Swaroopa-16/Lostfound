// updated script.js — CORS-safe, robust, ready for GitHub Pages
const PROXY_URL = 'https://lostfound.anandaswaroopa16.workers.dev'; // <-- replace if your worker URL differs
const SHEET_API_URL = PROXY_URL;

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

  let cachedItems = [];
  let uploadInProgress = false;

  /* ---------- Utilities ---------- */
  function escapeHtml(str = '') {
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
    return `<svg class="placeholder-img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#f5f6f7"/><g fill="#c7c9cc"><rect x="10" y="10" width="44" height="12" rx="3"/><rect x="10" y="28" width="44" height="26" rx="3"/></g></svg>`;
  }
  function inlineSvgLogo(){
    return `<svg class="placeholder-img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="56" height="56" aria-hidden="true"><rect width="64" height="64" rx="10" fill="#eaf9d6"/><g fill="#6f8a24"><circle cx="20" cy="24" r="6"/><rect x="10" y="36" width="20" height="6" rx="2"/><path d="M40 18h14v28H40z" fill="#cbeaa6"/><circle cx="47" cy="30" r="3" fill="#6f8a24"/></g></svg>`;
  }

  /* ---------- Logo ---------- */
  function loadLogo(){
    if(!logoWrap) return;
    logoWrap.innerHTML = '';
    var img = new Image();
    img.alt = 'Campus Logo';
    img.onload = function(){ logoWrap.innerHTML=''; logoWrap.appendChild(img); };
    img.onerror = function(){ logoWrap.innerHTML = inlineSvgLogo(); };
    img.src = 'cmrit_logo.webp';
  }
  loadLogo();

  /* ---------- Render items ---------- */
  function normalizeItem(raw){
    var it = {};
    Object.keys(raw || {}).forEach(function(k){ it[k.trim()] = String(raw[k] || '').trim(); });
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
    var imgUrl = sanitizeUrl(it.imageUrl || '');
    var thumb = imgUrl ? '<img loading="lazy" src="' + escapeHtml(imgUrl) + '" alt="' + escapeHtml(it.title||'item') + '">' : placeholderSvgHtml();
    var tag = (it.type && it.type.toLowerCase() === 'found') ? '<span class="tag" style="background:#e8f6ff;color:#0b4f70">Found</span>' : '<span class="tag">Lost</span>';
    var occurrenceText = formatOccurrenceDate(it.date);
    var reportedText = formatFriendlyDate(it.reportedDate || it.timestamp);
    return ''
      + '<article class="card" role="article">'
      +   '<div class="thumb">'+thumb+'</div>'
      +   '<div class="body">'
      +     '<div style="display:flex; gap:8px; align-items:center;">'
      +       tag
      +       '<h3 style="flex:1; margin:0">'+ escapeHtml(it.title || 'Untitled') +'</h3>'
      +     '</div>'
      +     '<div class="desc">'+ escapeHtml(it.description || '') +'</div>'
      +     '<div class="meta">'
      +       '<div><strong>Place:</strong> ' + escapeHtml(it.place || '—') + '</div>'
      +       '<div><strong>Occurrence Date:</strong> ' + escapeHtml(occurrenceText || '—') + '</div>'
      +       '<div><strong>Reported on:</strong> ' + escapeHtml(reportedText || '—') + '</div>'
      +       '<div><strong>Contact:</strong> ' + escapeHtml(it.contact || '—') + '</div>'
      +     '</div>'
      +   '</div>'
      + '</article>';
  }

  async function fetchItems(){
    if(!itemsGrid) return;
    itemsGrid.innerHTML = '<div class="muted" style="padding:12px">Loading items...</div>';
    try{
      if(!SHEET_API_URL || SHEET_API_URL.indexOf('REPLACE_WITH') !== -1) throw new Error('SHEET_API_URL not set. Edit script and add your Worker URL.');
      var res = await fetch(SHEET_API_URL + '?action=getItems', { cache: 'no-cache', mode: 'cors' });
      if(!res.ok) throw new Error('Network response not ok: ' + res.status);
      var json = await res.json();
      var items = Array.isArray(json) ? json : (json.items || []);
      cachedItems = items.map(normalizeItem);
      // newest first
      cachedItems.sort(function(a,b){
        var ta = parseDateValue(b.reportedDate || b.timestamp || '') || 0;
        var tb = parseDateValue(a.reportedDate || a.timestamp || '') || 0;
        return ta - tb;
      });
      renderItems();
    } catch(err){
      console.error('Error fetching items:', err);
      itemsGrid.innerHTML = '<div class="error" style="padding:12px">Could not load items. ' + escapeHtml(String(err.message || err)) + '</div>';
    }
  }

  function renderItems(){
    if(!itemsGrid) return;
    var q = searchBox ? searchBox.value.trim().toLowerCase() : '';
    if(!cachedItems || cachedItems.length === 0){
      itemsGrid.innerHTML = '';
      if(itemsEmpty) itemsEmpty.style.display = 'block';
      return;
    }
    if(itemsEmpty) itemsEmpty.style.display = 'none';
    var filtered = cachedItems.filter(function(it){
      return ('' + (it.title + ' ' + it.description + ' ' + it.place + ' ' + it.contact + ' ' + it.type)).toLowerCase().indexOf(q) !== -1;
    });
    if(filtered.length === 0){
      itemsGrid.innerHTML = '<div class="muted" style="padding:12px">No matches for "<strong>' + escapeHtml(q) + '</strong>"</div>';
      return;
    }
    itemsGrid.innerHTML = filtered.map(cardHtml).join('');
    // attach image error fallback
    Array.prototype.forEach.call(document.querySelectorAll('.card .thumb img'), function(img){
      img.addEventListener('error', function(){
        img.style.display = 'none';
        var p = img.parentElement;
        if(p && !p.querySelector('svg')) p.insertAdjacentHTML('beforeend', placeholderSvgHtml());
      });
    });
  }

  /* ---------- Image upload ---------- */
  function readFileAsDataURL(file){
    return new Promise(function(resolve, reject){
      var r = new FileReader();
      r.onload = function(){ resolve(r.result); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  if(imageFileInput){
    imageFileInput.addEventListener('change', async function(ev){
      var f = ev.target.files && ev.target.files[0];
      if(!f) return;
      if(f.size > 8 * 1024 * 1024){ alert('Image too large. Choose an image < 8 MB.'); imageFileInput.value=''; return; }
      if(uploadInProgress){ alert('Another upload in progress. Please wait.'); return; }
      uploadInProgress = true;
      if(uploadStatus) uploadStatus.textContent = 'Uploading image...';
      if(submitBtn) submitBtn.disabled = true;
      try{
        var dataUrl = await readFileAsDataURL(f);
        var params = new URLSearchParams();
        params.append('action','uploadImage');
        params.append('filename', f.name);
        params.append('imageBase64', dataUrl);
        var res = await fetch(SHEET_API_URL, { method: 'POST', body: params, mode: 'cors' });
        var text = await res.text();
        var j;
        try { j = JSON.parse(text); } catch(e) { j = { success:false, message:'Invalid JSON', raw:text }; }
        if(!res.ok) throw new Error('Server returned status ' + res.status + (j && j.message ? (': ' + j.message) : ''));
        if(j && j.success){
          var imageUrl = '';
          if(j.url) imageUrl = j.url;
          else if(j.id) imageUrl = 'https://drive.google.com/uc?id=' + j.id;
          if(imageUrl){
            if(imageUrlInput) imageUrlInput.value = imageUrl;
            if(uploadStatus) uploadStatus.textContent = 'Uploaded ✓';
            console.log('Upload succeeded:', imageUrl);
          } else {
            if(uploadStatus) uploadStatus.textContent = '';
            alert('Image uploaded but server did not return a direct link. Paste a public image URL manually.');
          }
        } else {
          throw new Error(j && j.message ? j.message : 'Upload failed');
        }
      } catch(err){
        console.error('Upload error', err);
        if(uploadStatus) uploadStatus.textContent = 'Upload failed';
        alert('Image upload failed: ' + String(err.message || err));
      } finally {
        uploadInProgress = false;
        if(submitBtn) submitBtn.disabled = false;
      }
    });
  }

  /* ---------- Form submit ---------- */
  if(formEl){
    formEl.addEventListener('submit', async function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      var titleEl = document.getElementById('title');
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
      var payload = {
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
        var params = new URLSearchParams();
        Object.keys(payload).forEach(function(k){ params.append(k, payload[k] || ''); });
        var res = await fetch(SHEET_API_URL, { method: 'POST', body: params, mode: 'cors' });
        if(!res.ok) throw new Error('Network response not ok: ' + res.status);
        var data = await res.json();
        if(data && (data.success === true || data === true)){
          submitMsgEl.textContent = 'Added ✓';
          cachedItems.unshift(normalizeItem(payload));
          renderItems();
          formEl.reset();
          if(uploadStatus) uploadStatus.textContent = '';
          setTimeout(function(){ submitMsgEl.textContent = ''; }, 900);
        } else {
          throw new Error((data && data.message) ? data.message : 'Unknown server response');
        }
      } catch(err){
        console.error('Submit error', err);
        submitMsgEl.textContent = 'Failed to submit';
        alert('Submit failed: ' + String(err.message || err) + '\nCheck that the Worker URL is correct and Apps Script is deployed.');
      } finally {
        if(submitBtn) submitBtn.disabled = false;
      }
    });
  }

  /* ---------- Search debounce ---------- */
  var searchTimer = 0;
  if(searchBox){
    searchBox.addEventListener('input', function(){
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderItems, 150);
    });
  }

  /* Init */
  fetchItems();
});
