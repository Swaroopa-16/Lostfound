// IMPORTANT: Replace this with your Apps Script Web App URL
const API_URL ="https://script.google.com/macros/s/AKfycbzcZZaOv5aeHTC8t7Zn8ze9CsNJ1wn3CzcJrMn_n041oFlVX9wnNSR7VWDl0_0eDJ-keA/exec";


// ----------- SUBMIT FORM -------------
document.getElementById("itemForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    const data = {
        type: document.getElementById("type").value,
        item: document.getElementById("item").value,
        description: document.getElementById("description").value,
        location: document.getElementById("location").value,
        contact: document.getElementById("contact").value,
        date_event: document.getElementById("date_event").value,
        reporter: document.getElementById("reporter").value
    };

    document.getElementById("msg").textContent = "Submitting...";

    let res = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify(data)
    });

    let result = await res.json();

    if (result.success) {
        document.getElementById("msg").textContent = "Submitted successfully!";
        loadItems();
        document.getElementById("itemForm").reset();
    } else {
        document.getElementById("msg").textContent = "Error submitting!";
    }
});

// ----------- LOAD ITEMS -------------
async function loadItems() {
    const list = document.getElementById("list");
    list.innerHTML = "Loading...";

    let res = await fetch(API_URL);
    let items = await res.json();

    list.innerHTML = "";

    items.reverse().forEach(item => {
        let li = document.createElement("li");
        li.innerHTML = `
            <strong>${item.item}</strong> (${item.type})<br>
            ${item.description}<br>
            <small>Location: ${item.location} | Contact: ${item.contact}</small>
        `;
        list.appendChild(li);
    });
}

// Load items when page opens
loadItems();

