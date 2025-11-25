// JSONP + iframe-based POST approach (no CORS issues)
// YOUR Apps Script URL:
const API_URL = "https://script.google.com/macros/s/AKfycbzclTSeEeMwdtFt9q0sgorfOk4RFTcpigRt7XCRNJU2EbMzLMxWKtHCoFYv77pwtk-BEQ/exec";

// JSONP loader
function jsonpFetch(url) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).substring(2);
    const script = document.createElement("script");
    window[cb] = (data) => {
      resolve(data);
      script.remove();
      delete window[cb];
    };
    script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'callback=' + cb;
    script.onerror = () => {
      reject(new Error('JSONP load error'));
      script.remove();
      try { delete window[cb]; } catch(e) {}
    };
    document.body.appendChild(script);
  });
}

function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Load items and render list with thumbnails
async function loadItems() {
  const list = document.getElementById("list");
  list.innerHTML = "Loading...";
  try {
    const res = await jsonpFetch(API_URL);
    if (!res || !res.success) {
      list.innerHTML = "<li>No items or error</li>";
      return;
    }
    const items = res.items || [];
    if (items.length === 0) {
      list.innerHTML = "<li>No items yet</li>";
      return;
    }
    list.innerHTML = "";
    items.reverse().forEach(item => {
      const li = document.createElement("li");
      const photoHtml = item.photo_url ? `<a href="${item.photo_url}" target="_blank"><img src="${item.photo_url}" alt="photo"></a>` : '';
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
    console.error(err);
  }
}

// file -> base64 hidden field + preview
(function wirePhotoInput(){
  const photoFileInput = document.getElementById('photoFile');
  const photoHiddenInput = document.getElementById('photo');
  const photoPreview = document.getElementById('photoPreview');

  if (!photoFileInput) return;

  photoFileInput.addEventListener('change', function() {
    const file = this.files && this.files[0];
    if (!file) {
      photoHiddenInput.value = '';
      photoPreview.innerHTML = '';
      return;
    }

    // preview
    const readerP = new FileReader();
    readerP.onload = function(e) {
      photoPreview.innerHTML = `<img src="${e.target.result}" style="max-width:160px; max-height:120px; border-radius:6px;">`;
    };
    readerP.readAsDataURL(file);

    // read as dataURL and put into hidden input
    const reader = new FileReader();
    reader.onload = function(e) {
      photoHiddenInput.value = e.target.result; // data:image/...;base64,...
    };
    reader.readAsDataURL(file);
  });
})();

// Form submit UX: show submitting and refresh after iframe loads
document.getElementById("itemForm").addEventListener("submit", function(e) {
  const msg = document.getElementById("msg");
  msg.textContent = "Submitting...";
  const iframe = document.getElementById("post_target");
  const listener = function() {
    setTimeout(async () => {
      msg.textContent = "Submitted!";
      document.getElementById("itemForm").reset();
      document.getElementById('photoPreview').innerHTML = '';
      await loadItems();
      iframe.removeEventListener("load", listener);
      setTimeout(()=> msg.textContent = '', 2000);
    }, 900);
  };
  iframe.addEventListener("load", listener);
});

// initial load
loadItems();
