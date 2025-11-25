// JSONP + iframe-based POST approach (no CORS issues)
// Apps Script endpoint (must match the form action)
const API_URL = "https://script.google.com/macros/s/AKfycbzclTSeEeMwdtFt9q0sgorfOk4RFTcpigRt7XCRNJU2EbMzLMxWKtHCoFYv77pwtk-BEQ/exec";


function jsonpFetch(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const cb = 'cb_' + Math.random().toString(36).substring(2,10);
    window[cb] = function(data) {
      resolve(data);
      script.remove();
      try { delete window[cb]; } catch(e) { window[cb] = undefined; }
    };
    script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'callback=' + cb;
    script.onerror = function() {
      reject(new Error('JSONP load error'));
      script.remove();
      try { delete window[cb]; } catch(e) { window[cb] = undefined; }
    };
    document.body.appendChild(script);
  });
}

// Escape HTML
function escapeHtml(s) {
  if (!s) return '';
  return s.toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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

// Form submit UX: show submitting message and wait for iframe load
document.getElementById('itemForm').addEventListener('submit', function(e) {
  const msg = document.getElementById('msg');
  msg.textContent = 'Submitting...';
  const iframe = document.getElementById('post_target');
  const onload = function() {
    setTimeout(async () => {
      msg.textContent = 'Submitted successfully!';
      document.getElementById('itemForm').reset();
      await loadItems();
      iframe.removeEventListener('load', onload);
      setTimeout(()=> msg.textContent = '', 2500);
    }, 700);
  };
  iframe.addEventListener('load', onload);
});

// initial load
loadItems();
