const API_URL = "https://script.google.com/macros/s/AKfycbx6aMps78bYxgr1l_t0Tf7hHrk-CkLINr1oL-aykJMZ5Igc6WANjvKGvui4HIAcX_CzQA/exec";

function escapeHtml(s) {
  return s ? s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])) : "";
}

function jsonpFetch(url) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).substring(2);
    window[cb] = (data) => {
      resolve(data);
      delete window[cb];
      document.getElementById(cb)?.remove();
    };
    const script = document.createElement("script");
    script.id = cb;
    script.src = url + (url.includes("?")?"&":"?") + "callback=" + cb;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

async function loadItems() {
  const list = document.getElementById("list");
  list.innerHTML = "Loading...";

  try {
    const res = await jsonpFetch(API_URL);
    if (!res.success) return list.innerHTML = "<li>Error loading</li>";

    list.innerHTML = "";
    res.items.reverse().forEach(item => {
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${escapeHtml(item.item)}</strong> (${escapeHtml(item.type)})<br>
        ${escapeHtml(item.description)}<br>
        <small>
          Location: ${escapeHtml(item.location)} |
          Contact: ${escapeHtml(item.contact)} |
          Posted: ${escapeHtml(item.date_reported)}
        </small>
      `;
      list.appendChild(li);
    });

  } catch (e) {
    list.innerHTML = "<li>Error loading items</li>";
  }
}

document.getElementById("itemForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const msg = document.getElementById("msg");
  msg.textContent = "Submitting...";

  const params = {
    type: type.value,
    item: item.value,
    description: description.value,
    location: location.value,
    contact: contact.value,
    date_event: date_event.value,
    reporter: reporter.value
  };

  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");

  jsonpFetch(API_URL + "?" + query)
    .then(res => {
      msg.textContent = res.success ? "Submitted!" : "Failed";
      document.getElementById("itemForm").reset();
      loadItems();
    });
});

loadItems();
