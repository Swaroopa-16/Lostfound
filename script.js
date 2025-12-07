/* ------------------ CONFIG - DO NOT FORGET ------------------ */
// Your Apps Script /exec URL (you provided this)
const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbzclTSeEeMwdtFt9q0sgorfOk4RFTcpigRt7XCRNJU2EbMzLMxWKtHCoFYv77pwtk-BEQ/exec';

// Logo path in repo root
const LOGO_PATH = 'cmrit_logo.webp';
const LOGO_ALT_TEXT = 'Campus Logo';
/* ---------------------------------------------------------- */

const itemsGrid = document.getElementById('itemsGrid');
const itemsEmpty = document.getElementById('itemsEmpty');
const searchBox = document.getElementById('searchBox');
const logoWrap = document.getElementById('logoWrap');

let cachedItems = [];

// --- Logo loader with robust fallback ---
function loadLogo(){
  logoWrap.innerHTML = '';
  if(!LOGO_PATH || LOGO_PATH.includes('REPLACE_WITH')){
    logoWrap.innerHTML = inlineSvgLogo();
    return;
  }
  const img = new Image();
  img.alt = LOGO_ALT_TEXT;
  img.onload = () => {
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    logoWrap.innerHTML = '';
    logoWrap.appendChild(img);
  };
  img.onerror = () => {
    logoWrap.innerHTML = inlineSvgLogo();
  };
  img.src = LOGO_PATH;
}
function inlineSvgLogo(){
  return `<svg class="placeholder-img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48" aria-hidden="true">
    <rect width="64" height="64" rx="10" fill="#eaf9d6"/>
    <g fill="#6f8a24">
      <circle cx="20" cy="24" r="6"/>
      <rect x="10" y="36" width="20" height="6" rx="2"/>
      <path d="M40 18h14v28H40z" fill="#cbeaa6"/>
      <circle cx="47" cy="30" r="3" fill="#6f8a24"/>
    </g>
  </svg>`;
}

// --- Fetch items from Apps Script (GET) ---
async function fetchItems(){
  itemsGrid.innerHTML = '<div class="muted" style="padding:12px">Loading items...</div>';
  try{
    if(!SHEET_API_URL || SHEET_API_URL.includes('REPLACE_WITH')){
      throw new Error('SHEET_API_URL not set. Edit script.js and paste your Web App /exec URL.');
    }
    const url = new URL(SHEET_API_URL);
    url.searchParams.set('action', 'getItems');
    const res = await fetch(url.toString(), { cache: 'no-cache' });
    if(!res.ok) throw new Error('Network response not ok: ' + res.status);
    const json = await res.json();
    // Accept array or {success:true, items:[]}
    const items = Array.isArray(json) ? json : (json.items || []);
    cachedItems = items.map(normalizeItem);

    // Sort by reported timestamp ascending, so older appear first and newest at bottom
    cachedItems.sort((a,b) => {
      const ta = parseDateValue(a.reported || a.timestamp || '');
      const tb = parseDateValue(b.reported || b.timestamp || '');
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

// parse various timestamp formats to millis
function parseDateValue(v){
  if(!v) return null;
  // attempt ISO parse
  const d = new Date(String(v));
  if(!isNaN(d.getTime())) return d.getTime();
  // fallback: try Date.parse
  const p = Date.parse(String(v));
  return isNaN(p) ? null : p;
}

// Normalize different header casing and shapes
function normalizeItem(raw){
  const it = {};
  Object.keys(raw || {}).forEach(k => it[k.trim()] = String(raw[k] || '').trim());
  // reported date: prefer explicit reportedDate or timestamp fields returned by server
  const reported = it.reportedDate || it.reported || it.timestamp || it.Timestamp || it.time || '';
  return {
    title: it.title || it.Title || it.NAME || it.name || '',
    description: it.description || it.Description || it.desc || '',
    place: it.place || it.Place || '',
    date: it.date || it.Date || '',
    imageUrl: it.imageUrl || it.imageURL || it.Image || '',
    contact: it.contact || it.Contact || '',
    type: it.type || it.Type || '',
    reported: reported,
    timestamp: it.timestamp || it.Timestamp || '',
    raw: it
  };
}

// --- Render using cachedItems and search input ---
function renderItems(){
  const query = searchBox.value.trim().toLowerCase();
  if(!cachedItems || cachedItems.length === 0){
    itemsGrid.innerHTML = '';
    itemsEmpty.style.display = 'block';
    return;
  }
  itemsEmpty.style.display = 'none';
  const filtered = cachedItems.filter(it => {
    const s = `${it.title} ${it.description} ${it.place} ${it.contact} ${it.type}`.toLowerCase();
    return s.includes(query);
  });
  if(filtered.length === 0){
    itemsGrid.innerHTML = `<div class="muted" style="padding:12px">No matches for "<strong>${escapeHtml(query)}</strong>"</div>`;
    return;
  }
  // Render order preserved (older first -> newer at bottom)
  itemsGrid.innerHTML = filtered.map(it => cardHtml(it)).join('');
  // attach image error handlers
  document.querySelectorAll('.card .thumb img').forEach(img => {
    img.addEventListener('error', ()=> {
      img.style.display = 'none';
      const parent = img.parentElement;
      if(parent && !parent.querySelector('svg')) parent.insertAdjacentHTML('beforeend', placeholderSvgHtml());
    });
  });
}

function cardHtml(it){
  const imgUrl = sanitizeUrl(it.imageUrl);
  const thumb = imgUrl ? `<img loading="lazy" src="${imgUrl}" alt="${escapeHtml(it.title||'item')}">` : placeholderSvgHtml();
  const tag = (it.type && it.type.toLowerCase() === 'found') ? `<span class="tag" style="background:#e8f6ff;color:#0b4f70">Found</span>` : `<span class="tag">Lost</span>`;
  // reported display: prefer reported value else timestamp; format nicely
  const reportedText = formatFriendlyDate(it.reported || it.timestamp);
  return `
    <article class="card" role="article">
      <div class="thumb">${thumb}</div>
      <div class="body">
        <div style="display:flex; gap:8px; align-items:center;">
          ${tag}
          <h3 style="flex:1">${escapeHtml(it.title || 'Untitled')}</h3>
        </div>
        <div style="color:var(--muted); font-size:13px">${escapeHtml(it.description || '')}</div>
        <div class="meta">
          <div>Place: ${escapeHtml(it.place||'—')}</div>
          <div>Date: ${escapeHtml(it.date||'—')}</div>
          <div>Reported: ${escapeHtml(reportedText || '—')}</div>
          <div>Contact: ${escapeHtml(it.contact||'—')}</div>
        </div>
      </div>
    </article>
  `;
}

function placeholderSvgHtml(){
  return `<svg class="placeholder-img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#f5f6f7"/><g fill="#c7c9cc"><rect x="10" y="10" width="44" height="12" rx="3"/><rect x="10" y="28" width="44" height="26" rx="3"/></g></svg>`;
}

// friendly date format (local)
function formatFriendlyDate(value){
  if(!value) return '';
  const t = parseDateValue(value);
  if(!t) return String(value).slice(0, 20);
  const d = new Date(t);
  return d.toLocaleString([], { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

// --- Form submit (urlencoded) ---
// When submitting we send both 'date' (occurrence) and 'reportedDate' (now)
const formEl = document.getElementById('itemForm');
if(formEl){
  formEl.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const submitMsg = document.getElementById('submitMsg');
    submitMsg.textContent = 'Submitting...';
    // build payload
    const occurrence = document.getElementById('date').value || '';
    const payload = {
      timestamp: new Date().toISOString(),
      reportedDate: new Date().toISOString(), // explicit reported date
      type: document.getElementById('type').value,
      title: document.getElementById('title').value.trim(),
      description: document.getElementById('desc').value.trim(),
      place: document.getElementById('place').value.trim(),
      date: occurrence, // occurrence date from calendar (yyyy-mm-dd) or empty
      imageUrl: document.getElementById('imageUrl').value.trim(),
      contact: document.getElementById('contact').value.trim()
    };
    try{
      if(!SHEET_API_URL || SHEET_API_URL.includes('REPLACE_WITH')) throw new Error('SHEET_API_URL not configured in script.js');
      const params = new URLSearchParams();
      Object.keys(payload).forEach(k => params.append(k, payload[k] || ''));
      const res = await fetch(SHEET_API_URL, { method: 'POST', body: params, cache: 'no-cache' });
      if(!res.ok) throw new Error('Network response not ok: ' + res.status);
      const data = await res.json();
      if(data && (data.success === true || data === true)){
        submitMsg.textContent = 'Added ✓';
        // append locally so it appears at bottom (no immediate refetch required)
        const newItem = normalizeItem(payload);
        // push to cachedItems; ensure order preserved (older first -> newest last)
        cachedItems.push(newItem);
        renderItems();
        formEl.reset();
        // clear message after short time
        setTimeout(()=>{ submitMsg.textContent=''; }, 800);
      } else {
        throw new Error((data && data.message) ? data.message : 'Unknown server response');
      }
    } catch(err){
      console.error('Submit error', err);
      submitMsg.textContent = 'Failed to submit';
      alert('Failed to submit. Check SHEET_API_URL and Apps Script deployment.\n' + err.message);
    }
  });
}

// --- Search (debounced) ---
let searchTimer = 0;
searchBox.addEventListener('input', ()=> {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderItems, 150);
});

// --- Utilities ---
function escapeHtml(str=''){ return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function sanitizeUrl(u=''){ try{ if(!u) return ''; const url = new URL(u); return url.href; }catch(e){ return ''; } }

// --- Init ---
loadLogo();
fetchItems();
