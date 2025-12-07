/* script.js — drop-in replacement
   Shows the occurrence date (entered with calendar) clearly on each card.
   Kept all existing IDs and behavior intact.
*/

/* ------------------ CONFIG - DO NOT EDIT UNLESS NEEDED ------------------ */
// Your Apps Script /exec URL (you provided this)
const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbw33RvD6HF4zognGBKK9PhLn5zSTiQFhsgEYqG4louIt71zhT4e5n-p7KOx467fHbiaVQ/exec';

// Logo path in repo root
const LOGO_PATH = 'cmrit_logo.webp';
const LOGO_ALT_TEXT = 'Campus Logo';
/* ----------------------------------------------------------------------- */

const itemsGrid = document.getElementById('itemsGrid');
const itemsEmpty = document.getElementById('itemsEmpty');
const searchBox = document.getElementById('searchBox');
const logoWrap = document.getElementById('logoWrap');

let cachedItems = [];

/* ---------------- LOGO loader (unchanged) ---------------- */
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

/* ---------------- FETCH / RENDER ---------------- */
async function fetchItems(){
  itemsGrid.innerHTML = '<div class="muted" style="padding:12px">Loading items...</div>';
  try{
    if(!SHEET_API_URL || SHEET_API_URL.includes('REPLACE_WITH')) throw new Error('SHEET_API_URL not set. Edit script.js and paste your Web App /exec URL.');
    const url = new URL(SHEET_API_URL);
    url.searchParams.set('action', 'getItems');
    const res = await fetch(url.toString(), { cache: 'no-cache' });
    if(!res.ok) throw new Error('Network response not ok: ' + res.status);
    const json = await res.json();
    const items = Array.isArray(json) ? json : (json.items || []);
    cachedItems = items.map(normalizeItem);

    // Sort older -> newer so newest items appear at bottom (as you requested earlier)
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

function normalizeItem(raw){
  const it = {};
  Object.keys(raw || {}).forEach(k => it[k.trim()] = String(raw[k] || '').trim());
  return {
    title: it.title || it.Title || it.NAME || it.name || '',
    description: it.description || it.Description || it.desc || '',
    place: it.place || it.Place || '',
    date: it.date || it.Date || '',            // occurrence date (from calendar)
    imageUrl: it.imageUrl || it.imageURL || it.Image || '',
    contact: it.contact || it.Contact || '',
    type: it.type || it.Type || '',
    reported: it.reportedDate || it.reported || it.timestamp || it.Timestamp || '',
    timestamp: it.timestamp || it.Timestamp || '',
    raw: it
  };
}

/* Render with occurrence date visible and nicely formatted */
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

/* Card HTML: displays 'Date:' as the occurrence date entered by user (formatted) */
function cardHtml(it){
  const imgUrl = sanitizeUrl(it.imageUrl);
  const thumb = imgUrl
    ? `<img loading="lazy" src="${imgUrl}" alt="${escapeHtml(it.title||'item')}">`
    : placeholderSvgHtml();

  const tag = (it.type && it.type.toLowerCase() === 'found')
    ? `<span class="tag" style="background:#e8f6ff;color:#0b4f70">Found</span>`
    : `<span class="tag">Lost</span>`;

  // NEW: format occurrence & reported dates
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
    </article>
  `;
}


function placeholderSvgHtml(){
  return `<svg class="placeholder-img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#f5f6f7"/><g fill="#c7c9cc"><rect x="10" y="10" width="44" height="12" rx="3"/><rect x="10" y="28" width="44" height="26" rx="3"/></g></svg>`;
}

/* ---------------- FORM SUBMIT (unchanged except ensures occurrence date sent) ---------------- */
const formEl = document.getElementById('itemForm');
if(formEl){
  formEl.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const submitMsg = document.getElementById('submitMsg');
    submitMsg.textContent = 'Submitting...';
    const occurrence = document.getElementById('date').value || ''; // calendar value (YYYY-MM-DD)
    const payload = {
      timestamp: new Date().toISOString(),
      reportedDate: new Date().toISOString(),
      type: document.getElementById('type').value,
      title: document.getElementById('title').value.trim(),
      description: document.getElementById('desc').value.trim(),
      place: document.getElementById('place').value.trim(),
      date: occurrence, // important: occurrence date sent to sheet
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
        cachedItems.push(newItem);
        renderItems();
        formEl.reset();
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

/* ---------------- SEARCH (debounced) ---------------- */
let searchTimer = 0;
searchBox.addEventListener('input', ()=> {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderItems, 150);
});

/* ---------------- Utilities: escaping & date formatting ---------------- */
function escapeHtml(str=''){ return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function sanitizeUrl(u=''){ try{ if(!u) return ''; const url = new URL(u); return url.href; }catch(e){ return ''; } }

function parseDateValue(v){
  if(!v) return null;
  // Try ISO or other parseable dates
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

/* New: format occurrence date (user-entered calendar date)
   - If it's YYYY-MM-DD, display as 'DD Mon YYYY' (e.g., 07 Dec 2025)
   - Otherwise attempt parse and friendly format
*/
function formatOccurrenceDate(value){
  if(!value) return '';
  const s = String(value).trim();
  // match YYYY-MM-DD
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m){
    const year = Number(m[1]), month = Number(m[2]) - 1, day = Number(m[3]);
    const d = new Date(Date.UTC(year, month, day));
    // Use locale date (no time)
    return d.toLocaleDateString([], { year:'numeric', month:'short', day:'numeric' });
  }
  // fallback to parse
  const t = parseDateValue(s);
  if(!t) return s;
  return new Date(t).toLocaleDateString([], { year:'numeric', month:'short', day:'numeric' });
}

/* ---------------- INIT ---------------- */
loadLogo();
fetchItems();
