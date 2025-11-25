// Full script.js for Lost & Found app
// Replace API_URL with your deployed Apps Script /exec URL if it changes
const API_URL = "https://script.google.com/macros/s/AKfycbx6aMps78bYxgr1l_t0Tf7hHrk-CkLINr1oL-aykJMZ5Igc6WANjvKGvui4HIAcX_CzQA/exec";

// -----------------------------
// JSONP loader (works around CORS)
function jsonpFetch(url) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).substring(2);
    const script = document.createElement("script");

    // Create global callback
    window[cb] = (data) => {
      try {
        resolve(data);
      } finally {
        // cleanup
        script.remove();
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
      }
    };

    // Build URL with callback param
    script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'callback=' + cb;
    script.onerror = () => {
      // cleanup and reject
      script.remove();
      try { delete window[cb]; } catch(e) { window[cb] = undefined; }
      reject(new Error('JSONP load error'));
    };
    document.body.appendChild(script);
  });
}

// -----------------------------
// small HTML escape
function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// -----------------------------
// loadItems: fetch items and render list (with thumbnails)
async function loadItems() {
  const list = document.getElementById("list");
  if (!list) return;
  list.innerHTML = "Loading...";
  try {
    const res = await jsonpFetch(API_URL);
    if (!res || !res.success) {
      list.innerHTML = "<li>No items or error</li>";
      console.warn('loadItems: no res or not success', res);
      return;
    }
    const items = res.items || [];
    if (items.length === 0) {
      list.innerHTML = "<li>No items yet</li>";
      return;
    }
    list.innerHTML = "";
    // show newest first
    items.reverse().forEach(item => {
      const li = document.createElement("li");
      const photoHtml = item.photo_url ? `<a href="${item.photo_url}" target="_blank" rel="noopener"><img src="${item.photo_url}" alt="photo"></a>` : '';
      li.innerHTML = `
        <strong>${escapeHtml(item.item)}</strong> (${escapeHtml(item.type)})<br>
        ${escapeHtml(item.description)}<br>
        <small>Location: ${escapeHtml(item.location)} | Contact: ${escapeHtml(item.contact)}</small>
        ${photoHtml}
      `;
      list.appendChild(li);
    });
  } catch (err) {
    list.innerHTML = "<li>Error loading items</li>";
    console.error('loadItems error', err);
  }
}

// -----------------------------
// Photo reading + submit-blocking logic
(function initPhotoHandling() {
  const photoFileInput = document.getElementById('photoFile');
  const photoHiddenInput = document.getElementById('photo');
  const photoPreview = document.getElementById('photoPreview');
  const itemForm = document.getElementById('itemForm');
  const submitBtn = document.getElementById('submitBtn');

  if (!itemForm) {
    console.warn('initPhotoHandling: #itemForm not found');
    return;
  }

  // state
  let photoReady = true; // true unless we're reading a file

  function setSubmitEnabled(ok) {
    if (submitBtn) submitBtn.disabled = !ok;
  }

  // default: allow submit
  setSubmitEnabled(true);

  if (!photoFileInput || !photoHiddenInput) {
    // no photo UI present — nothing to wire
    return;
  }

  photoFileInput.addEventListener('change', function() {
    const file = this.files && this.files[0];
    if (!file) {
      photoHiddenInput.value = '';
      if (photoPreview) photoPreview.innerHTML = '';
      photoReady = true;
      setSubmitEnabled(true);
      console.log('photo removed or none selected');
      return;
    }

    // begin reading
    photoReady = false;
    setSubmitEnabled(false);

    // small preview reader
    const readerP = new FileReader();
    readerP.onload = function(e) {
      if (photoPreview) photoPreview.innerHTML = `<img src="${e.target.result}" style="max-width:160px; max-height:120px; border-radius:6px;">`;
    };
    readerP.onerror = function(err) {
      console.warn('preview FileReader error', err);
    };
    readerP.readAsDataURL(file);

    // main reader to place base64 into hidden input
    const reader = new FileReader();
    reader.onload = function(e) {
      const dataUrl = e.target.result; // data:image/..;base64,...
      photoHiddenInput.value = dataUrl;
      photoReady = true;
      setSubmitEnabled(true);
      console.log('photo base64 length=', dataUrl.length);
    };
    reader.onerror = function(err) {
      console.error('FileReader error', err);
      photoHiddenInput.value = '';
      photoReady = true;
      setSubmitEnabled(true);
    };
    reader.readAsDataURL(file);
  });

  // Prevent submit until file reading completes
  itemForm.addEventListener('submit', function(ev) {
    const hasFileSelected = photoFileInput && photoFileInput.files && photoFileInput.files.length > 0;
    if (hasFileSelected && !photoReady) {
      // block submission, wait until ready then submit automatically
      ev.preventDefault();
      console.log('Waiting for file encoding before submit...');
      const start = Date.now();
      const wait = setInterval(() => {
        if (photoReady) {
          clearInterval(wait);
          // submit programmatically
          try {
            itemForm.submit();
          } catch (e) {
            console.error('Auto-submit failed', e);
          }
        } else if (Date.now() - start > 5000) {
          clearInterval(wait);
          console.warn('File encoding timeout — try a smaller image or try again.');
          setSubmitEnabled(true);
        }
      }, 150);
    }
    // otherwise allow submit to proceed normally
  });
})();

// -----------------------------
// Submit UX: show message and refresh list after iframe loads
(function initSubmitListener(){
  const itemForm = document.getElementById('itemForm');
  const iframe = document.getElementById('post_target');
  const msg = document.getElementById('msg');

  if (!itemForm || !iframe) {
    // nothing to do
    return;
  }

  itemForm.addEventListener('submit', function(e) {
    if (msg) msg.textContent = 'Submitting...';
    const onLoad = function() {
      // small delay to allow server write
      setTimeout(async () => {
        if (msg) msg.textContent = 'Submitted!';
        try {
          // reset form UI
          itemForm.reset();
          const pv = document.getElementById('photoPreview');
          if (pv) pv.innerHTML = '';
          // refresh list
          await loadItems();
        } catch (err) {
          console.warn('Error after submit', err);
        } finally {
          iframe.removeEventListener('load', onLoad);
          setTimeout(()=> { if (msg) msg.textContent = ''; }, 2000);
        }
      }, 900);
    };
    iframe.addEventListener('load', onLoad);
  });
})();

// -----------------------------
// initial load
document.addEventListener('DOMContentLoaded', function() {
  // debug: confirm script loaded
  console.log('script.js loaded, API_URL=', API_URL);
  try {
    loadItems();
  } catch (e) {
    console.error('Initial loadItems failed', e);
  }
});
