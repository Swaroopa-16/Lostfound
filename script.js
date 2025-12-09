/* ---------------------------------------
   Lost & Found - FINAL WORKING SCRIPT
   Image Upload → Cloudinary
   Data Submit → Apps Script
   reportedDate auto-generated (not asked)
------------------------------------------ */

const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbxgfPFloo-72SZ-VedN3x2G0OaSrSvRGQ7sR3a22btFNhq3-9J_-lzyuuaxFTLNzHeE0g/exec";

// Your Cloudinary details
const CLOUD_NAME = "do48yblyi";
const UPLOAD_PRESET = "lostandfound";

// compression settings
const MAX_IMAGE_WIDTH = 700;
const IMAGE_QUALITY = 0.6;

// globals
window.cachedItems = [];
window.uploadInProgress = false;

document.addEventListener("DOMContentLoaded", () => {

  const formEl = document.getElementById("itemForm");
  const imageFileInput = document.getElementById("imageFile");
  const imageUrlInput  = document.getElementById("imageUrl");
  const uploadStatus   = document.getElementById("uploadStatus");
  const submitBtn      = document.getElementById("submitBtn");
  const submitMsg      = document.getElementById("submitMsg");

  const itemsGrid = document.getElementById("itemsGrid");
  const itemsEmpty = document.getElementById("itemsEmpty");
  const searchBox = document.getElementById("searchBox");


  /* --------------------------
      IMAGE PREVIEW HANDLER
  --------------------------- */
  function showPreview(url) {
    let wrap = document.getElementById("previewWrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "previewWrap";
      wrap.style.marginTop = "8px";
      imageUrlInput.parentNode.appendChild(wrap);
    }

    wrap.innerHTML = "";
    if (!url) return;

    const img = document.createElement("img");
    img.src = url;
    img.style.width = "120px";
    img.style.height = "80px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "5px";

    wrap.appendChild(img);
  }


  /* --------------------------
     IMAGE COMPRESSION
  --------------------------- */
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const ratio = img.width / img.height;
          const w = Math.min(MAX_IMAGE_WIDTH, img.width);
          const h = Math.round(w / ratio);

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);

          canvas.toBlob(blob => {
            if (!blob) return reject("Compression failed");
            resolve(blob);
          }, "image/jpeg", IMAGE_QUALITY);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }


  /* --------------------------
      CLOUDINARY UPLOAD
  --------------------------- */
  async function uploadToCloudinary(blob, filename) {
    const form = new FormData();
    form.append("file", blob, filename);
    form.append("upload_preset", UPLOAD_PRESET);

    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

    const res = await fetch(url, { method: "POST", body: form });
    const json = await res.json();

    if (!json.secure_url) throw new Error("Cloudinary upload failed");

    return json.secure_url;
  }


  /* --------------------------
      FILE INPUT CHANGE EVENT
  --------------------------- */
  imageFileInput.addEventListener("change", async () => {
    const file = imageFileInput.files[0];
    if (!file) return;

    uploadStatus.textContent = "Uploading...";
    uploadInProgress = true;
    submitBtn.disabled = true;

    try {
      const blob = await compressImage(file);
      const imageUrl = await uploadToCloudinary(blob, file.name);

      imageUrlInput.value = imageUrl;
      showPreview(imageUrl);

      uploadStatus.textContent = "Uploaded ✓";
    } catch (err) {
      uploadStatus.textContent = "Failed";
      alert("Image upload failed: " + err.message);
    }

    uploadInProgress = false;
    submitBtn.disabled = false;
  });



  /* --------------------------
      SUBMIT HANDLER (FINAL)
  --------------------------- */
  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (uploadInProgress) {
      alert("Please wait until image upload completes");
      return;
    }

    const titleEl = document.getElementById("title");
    if (!titleEl.value.trim()) {
      alert("Enter item name");
      return;
    }

    const payload = {
      action: "appendItem",
      timestamp: new Date().toISOString(),
      reportedDate: new Date().toISOString(),    // 🔥 AUTO SET — USER NOT ASKED
      type: document.getElementById("type").value,
      title: titleEl.value.trim(),
      description: document.getElementById("desc").value.trim(),
      place: document.getElementById("place").value.trim(),
      date: document.getElementById("date").value,
      imageUrl: imageUrlInput.value.trim(),
      contact: document.getElementById("contact").value.trim()
    };

    submitBtn.disabled = true;
    submitMsg.textContent = "Submitting...";

    try {
      const params = new URLSearchParams(payload);

      const res = await fetch(SHEET_API_URL, {
        method: "POST",
        body: params
      });

      const text = await res.text();
      const json = JSON.parse(text);

      if (!json.success) throw new Error("Submit failed");

      submitMsg.textContent = "Added ✓";

      cachedItems.unshift(payload);
      renderItems();

      formEl.reset();
      uploadStatus.textContent = "";
      showPreview("");

      setTimeout(() => submitMsg.textContent = "", 1000);
    } catch (err) {
      alert("Submit failed: " + err.message);
      submitMsg.textContent = "Submit failed";
    }

    submitBtn.disabled = false;
  });



  /* --------------------------
      FETCH ITEMS
  --------------------------- */
  async function fetchItems() {
    try {
      const res = await fetch(SHEET_API_URL + "?action=getItems");
      const json = await res.json();

      cachedItems = json.items || [];
      renderItems();
    } catch (err) {
      itemsGrid.innerHTML = "<p>Error loading items</p>";
    }
  }


  /* --------------------------
      RENDER ITEMS
  --------------------------- */
  function renderItems() {
    if (!cachedItems.length) {
      itemsGrid.innerHTML = "";
      itemsEmpty.style.display = "block";
      return;
    }

    itemsEmpty.style.display = "none";

    itemsGrid.innerHTML = cachedItems
      .map(item => `
        <article class="card">
          <div class="thumb">
            ${item.imageUrl ? `<img src="${item.imageUrl}" />` : ""}
          </div>
          <div class="body">
            <span class="tag ${item.type.toLowerCase()}">${item.type}</span>
            <h3>${item.title}</h3>
            <p>${item.description}</p>
            <p><b>Place:</b> ${item.place}</p>
            <p><b>Occurred:</b> ${item.date}</p>
            <p><b>Reported:</b> ${item.reportedDate}</p>
            <p><b>Contact:</b> ${item.contact}</p>
          </div>
        </article>
      `)
      .join("");
  }


  /* --------------------------
      SEARCH
  --------------------------- */
  searchBox.addEventListener("input", renderItems);


  /* FETCH ON LOAD */
  fetchItems();

});
