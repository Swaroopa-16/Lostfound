/* ---------------------- CONFIG ---------------------- */

// Your Worker URL (for sheet data only — NOT for images)
const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbw33RvD6HF4zognGBKK9PhLn5zSTiQFhsgEYqG4louIt71zhT4e5n-p7KOx467fHbiaVQ/exec";

// Cloudinary config (FINAL)
const CLOUD_NAME = "do48yblyi";
const UPLOAD_PRESET = "lostandfound";

// Image compression settings
const MAX_IMAGE_WIDTH = 700;
const IMAGE_QUALITY = 0.6;

/* ---------------------- MAIN SCRIPT ---------------------- */
document.addEventListener("DOMContentLoaded", () => {

  const imageFileInput = document.getElementById("imageFile");
  const imageUrlInput  = document.getElementById("imageUrl");
  const uploadStatus   = document.getElementById("uploadStatus");
  const submitBtn      = document.getElementById("submitBtn");
  const formEl         = document.getElementById("itemForm");

  const itemsGrid      = document.getElementById("itemsGrid");
  const itemsEmpty     = document.getElementById("itemsEmpty");
  const searchBox      = document.getElementById("searchBox");

  let cachedItems = [];
  let uploadInProgress = false;

  /* ---------------------- UTILITIES ---------------------- */
  function escapeHtml(str = "") {
    return String(str)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;");
  }

  function sanitizeUrl(url="") {
    try { return new URL(url).href; } catch { return url; }
  }

  function formatDate(val){
    if(!val) return "";
    const d = new Date(val);
    if(isNaN(d)) return val;
    return d.toLocaleDateString("en-IN", {year:"numeric", month:"short", day:"numeric"});
  }

  function formatDateTime(val){
    if(!val) return "";
    const d = new Date(val);
    if(isNaN(d)) return val;
    return d.toLocaleString("en-IN", {year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit"});
  }

  /* ---------------------- IMAGE COMPRESSION ---------------------- */
  function compressImage(file){
    return new Promise((resolve,reject)=>{
      const reader = new FileReader();
      reader.onload = e =>{
        const img = new Image();
        img.onload = ()=>{
          const canvas = document.createElement("canvas");
          const ratio = img.width / img.height;
          canvas.width = Math.min(MAX_IMAGE_WIDTH, img.width);
          canvas.height = canvas.width / ratio;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img,0,0,canvas.width,canvas.height);

          canvas.toBlob(
            blob => blob ? resolve(blob) : reject("Compression failed"),
            "image/jpeg",
            IMAGE_QUALITY
          );
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------------------- CLOUDINARY UPLOAD ---------------------- */
  async function uploadToCloudinary(file) {
    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append("file", compressed, file.name);
    formData.append("upload_preset", UPLOAD_PRESET);

    uploadStatus.textContent = "Uploading image...";

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData }
    );

    if (!res.ok) {
      throw new Error("Cloudinary upload failed");
    }

    const json = await res.json();
    return json.secure_url;
  }

  /* ---------------------- IMAGE INPUT HANDLER ---------------------- */
  if (imageFileInput) {
    imageFileInput.addEventListener("change", async evt => {
      const file = evt.target.files[0];
      if (!file) return;

      uploadInProgress = true;
      submitBtn.disabled = true;
      uploadStatus.textContent = "Starting upload...";

      try {
        const url = await uploadToCloudinary(file);
        imageUrlInput.value = url;
        uploadStatus.textContent = "Image uploaded ✔";
      } catch (err) {
        console.error(err);
        alert("Image upload failed: " + err.message);
        uploadStatus.textContent = "Upload failed";
      }

      uploadInProgress = false;
      submitBtn.disabled = false;
    });
  }

  /* ---------------------- FETCH ITEMS ---------------------- */
  async function fetchItems() {
    itemsGrid.innerHTML = `<div>Loading...</div>`;

    try {
      const res = await fetch(`${SHEET_API_URL}?action=getItems`);
      if (!res.ok) throw new Error("Network error: " + res.status);
      const data = await res.json();

      cachedItems = (data.items || []).map(it => ({
        ...it,
        title: it.title || "",
        description: it.description || "",
        place: it.place || "",
        date: it.date || "",
        imageUrl: it.imageUrl || "",
        contact: it.contact || "",
        type: it.type || "",
        reportedDate: it.reportedDate || it.timestamp
      }));

      renderItems();
    } catch (err) {
      itemsGrid.innerHTML = `<div style="color:red">Failed to load items</div>`;
      console.error(err);
    }
  }

  /* ---------------------- RENDER ITEMS ---------------------- */
  function renderItems() {
    const q = searchBox.value.trim().toLowerCase();

    const filtered = cachedItems.filter(it => (
      (it.title + it.description + it.place + it.type + it.contact)
      .toLowerCase()
      .includes(q)
    ));

    if (filtered.length === 0) {
      itemsGrid.innerHTML = `<div>No items found</div>`;
      return;
    }

    itemsGrid.innerHTML = filtered.map(it => `
      <article class="card">
        <div class="thumb">
          <img src="${sanitizeUrl(it.imageUrl)}" alt="item" onerror="this.style.display='none'">
        </div>
        <div class="body">
          <span class="tag">${it.type}</span>
          <h3>${escapeHtml(it.title)}</h3>
          <p>${escapeHtml(it.description)}</p>

          <p><b>Place:</b> ${escapeHtml(it.place)}</p>
          <p><b>Occurred:</b> ${formatDate(it.date)}</p>
          <p><b>Reported:</b> ${formatDateTime(it.reportedDate)}</p>
          <p><b>Contact:</b> ${escapeHtml(it.contact)}</p>
        </div>
      </article>
    `).join("");
  }

  /* ---------------------- SUBMIT FORM ---------------------- */
  formEl.addEventListener("submit", async evt => {
    evt.preventDefault();

    if (uploadInProgress) {
      alert("Please wait — image is still uploading.");
      return;
    }

    const payload = {
      action: "appendItem",
      timestamp: new Date().toISOString(),
      reportedDate: document.getElementById("reportedDate").value,
      type: document.getElementById("type").value,
      title: document.getElementById("title").value.trim(),
      description: document.getElementById("desc").value.trim(),
      place: document.getElementById("place").value.trim(),
      date: document.getElementById("date").value,
      imageUrl: imageUrlInput.value,
      contact: document.getElementById("contact").value.trim()
    };

    submitBtn.disabled = true;

    try {
      const formData = new URLSearchParams(payload);
      const res = await fetch(SHEET_API_URL, {
        method: "POST",
        body: formData
      });

      const json = await res.json();
      if (!json.success) throw new Error("Server rejected");

      alert("Item added ✔");
      formEl.reset();
      uploadStatus.textContent = "";
      fetchItems();
    } catch (err) {
      alert("Submit failed: " + err.message);
    }

    submitBtn.disabled = false;
  });

  /* INIT */
  fetchItems();
});
