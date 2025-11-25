// JSONP + iframe-based POST approach (no CORS issues)

// Replace with your Apps Script URL (same as form action)
const API_URL = "https://script.google.com/macros/s/AKfycbzcZZaOv5aeHTC8t7Zn8ze9CsNJ1wn3CzcJrMn_n041oFlVX9wnNSR7VWDl0_0eDJ-keA/exec";

// Helper: JSONP loader
function jsonpFetch(url, callbackName) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const cb = 'cb_' + Math.random().toString(36).substring(2,10);
    window[cb] = function(data) {
      resolve(data);
      // cleanup
      script.remove();
      try { delete window[cb]; } catch(e) { window[cb] = undefined; }
    };
    script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'callback=' + cb;
    script.onerror = function(e) {
      reject(new Error('JSONP load error'));
      script.remove();
      try { delete window[cb]; } catch(e) { window[cb] = undefined; }
    };
    document.body.appendChild(script);
  });
}

// Load items via JSONP
async function loadItems() {
  const list = document.getElementById('list');
  list.innerHTML = 'Loading...';
  try {
    const res = await jsonpFetch(API_URL);
    if (!res || !res.success) {
      list.innerHTML = '<li class="muted">No items or error: ' + (res && res.error ? res.error : 'unknown') + '</li>';
      return;
    }
    const items = res.items || [];
    if (items.length === 0) {
      list.innerHTML = '<li class="muted">No listings found.</li>';
      return;
    }
    list.innerHTML = '';
    items.reverse().forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${escapeHtml(item.item)}</strong> (${escapeHtml(item.type)})<br>
        ${escapeHtml(item.description)}<br>
        <small>Location: ${escapeHtml(item.location)} | Contact: ${escapeHtml(item.contact)}</small>`;
      list.appendChild(li);
    });
  } catch (err) {
    list.innerHTML = '<li class="muted">Error loading items.</li>';
    console.error(err);
  }
}

function escapeHtml(s) {
  if (!s) return '';
  return s.toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Form submit UX: show submitting message and wait for iframe load
document.getElementById('itemForm').addEventListener('submit', function(e) {
  const msg = document.getElementById('msg');
  msg.textContent = 'Submitting...';
  // When iframe loads, assume success
  const iframe = document.getElementById('post_target');
  const onload = function() {
    // small delay to allow Apps Script write to finish
    setTimeout(async () => {
      msg.textContent = 'Submitted successfully!';
      document.getElementById('itemForm').reset();
      await loadItems();
      // cleanup listener so it doesn't fire repeatedly
      iframe.removeEventListener('load', onload);
      setTimeout(()=> msg.textContent = '', 2500);
    }, 700);
  };
  iframe.addEventListener('load', onload);
});

// initial load
loadItems();
