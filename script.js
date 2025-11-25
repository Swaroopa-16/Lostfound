// Your Apps Script URL
const API_URL = "https://script.google.com/macros/s/AKfycbx6aMps78bYxgr1l_t0Tf7hHrk-CkLINr1oL-aykJMZ5Igc6WANjvKGvui4HIAcX_CzQA/exec";

function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// Convert photo → base64
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// LOAD ITEMS
async function loadItems() {
  const list = document.getElementById("list");
  list.innerHTML = "Loading...";

  try {
    const callback = "cb_" + Math.random().toString(36).substring(2);
    const res = await new Promise((resolve, reject) => {
      window[callback] = (data) => {
        resolve(data);
        delete window[callback];
      };
      const script = document.createElement("script");
      script.src = `${API_URL}?callback=${callback}`;
      script.onerror = reject;
      document.body.appendChild(script);
    });

    if (!res || !res.success) {
      list.innerHTML = "<li>Error loading items</li>";
      return;
    }

    list.innerHTML = "";
    res.items.reverse().forEach(item => {
      const li = document.createElement("li");
      const photoHtml = item.photo_url ? 
        `<br><img src="${item.photo_url}" style="max-width:120px;border-radius:6px;">` : "";

      li.innerHTML = `
        <strong>${escapeHtml(item.item)}</strong> (${escapeHtml(item.type)})<br>
        ${escapeHtml(item.description)}<br>
        <small>Location: ${escapeHtml(item.location)} | Contact: ${escapeHtml(item.contact)}</small>
        ${photoHtml}
      `;
      list.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    list.innerHTML = "<li>Error fetching data</li>";
  }
}

// SUBMIT FORM
document.getElementById("itemForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const msg = document.getElementById("msg");
  msg.textContent = "Submitting...";

  let photoBase64 = "";
  const fileInput = document.getElementById("photoFile");

  if (fileInput.files.length > 0) {
    photoBase64 = await readFileAsBase64(fileInput.files[0]);
  }

  const data = {
    type: document.getElementById("type").value,
    item: document.getElementById("item").value,
    description: document.getElementById("description").value,
    location: document.getElementById("location").value,
    contact: document.getElementById("contact").value,
    date_event: document.getElementById("date_event").value,
    reporter: document.getElementById("reporter").value,
    photo: photoBase64
  };

  // POST using fetch
  try {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" }
    });

    msg.textContent = "Submitted!";
    e.target.reset();
    loadItems();
  } catch (err) {
    console.error(err);
    msg.textContent = "Error submitting";
  }
});

// INITIAL LOAD
loadItems();
