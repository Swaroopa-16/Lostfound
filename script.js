// Your Apps Script URL
const API_URL = "https://script.google.com/macros/s/AKfycbx6aMps78bYxgr1l_t0Tf7hHrk-CkLINr1oL-aykJMZ5Igc6WANjvKGvui4HIAcX_CzQA/exec";

// JSONP Loader
function jsonpFetch(url) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).substring(2);
    const script = document.createElement("script");
    window[cb] = (data) => {
      resolve(data);
      delete window[cb];
      script.remove();
    };
    script.src = url + "?callback=" + cb;
    script.onerror = () => reject("Failed");
    document.body.appendChild(script);
  });
}

function escapeHtml(s) {
  return s ? s.replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m])) : "";
}

async function loadItems() {
  const list = document.getElementById("list");
  list.innerHTML = "Loading...";

  try {
    const res = await jsonpFetch(API_URL);
    if (!res.success) throw "Error";

    const items = res.items.reverse();

    list.innerHTML = "";
    items.forEach(item => {
      const posted = item.date_reported
        ? new Date(item.date_reported).toLocaleDateString()
        : "—";

      const eventDate = item.date_event
        ? new Date(item.date_event).toLocaleDateString()
        : "—";

      const photo = item.photo_url
        ? `<img src="${item.photo_url}">`
        : "";

      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${escapeHtml(item.item)}</strong> (${escapeHtml(item.type)})<br>
        ${escapeHtml(item.description)}<br>
        <small>
          Location: ${escapeHtml(item.location)}<br>
          Contact: ${escapeHtml(item.contact)}<br>
          Posted: ${posted} <br>
          Event: ${eventDate}
        </small>
        ${photo}
      `;
      list.appendChild(li);
    });

  } catch (e) {
    list.innerHTML = "<li>Error loading data</li>";
  }
}

// PHOTO → Base64
document.getElementById("photoFile").addEventListener("change", function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();

  reader.onload = e => {
    document.getElementById("photo").value = e.target.result;
    document.getElementById("photoPreview").innerHTML =
      `<img src="${e.target.result}">`;
  };

  reader.readAsDataURL(file);
});

// FORM SUBMIT
document.getElementById("itemForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = document.getElementById("msg");
  msg.textContent = "Submitting...";

  const data = {
    type: type.value,
    item: item.value,
    description: description.value,
    location: location.value,
    contact: contact.value,
    date_event: date_event.value,
    reporter: reporter.value,
    photo: photo.value
  };

  try {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(data)
    });

    msg.textContent = "Submitted!";
    e.target.reset();
    photoPreview.innerHTML = "";

    loadItems();

    setTimeout(() => (msg.textContent = ""), 2000);
  } catch (err) {
    msg.textContent = "Error submitting!";
  }
});

loadItems();
