// ===== Robust submit handler — paste in place of your current submit listener =====
(function attachRobustSubmit() {
  try {
    if (!window.formEl) {
      // Try to find the form if variable not available
      window.formEl = document.getElementById('itemForm');
    }
    if (!window.formEl) {
      console.error('Submit handler: form element #itemForm not found.');
      return;
    }

    // remove existing listeners to avoid duplicates (safe)
    try {
      var clone = window.formEl.cloneNode(true);
      window.formEl.parentNode.replaceChild(clone, window.formEl);
      window.formEl = clone;
    } catch (e) { /* ignore clone error */ }

    window.formEl.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      ev.stopPropagation();

      console.log('Submit clicked — starting submit flow');

      // Basic UI refs (fetch again in case globals missing)
      var submitBtnLocal = document.getElementById('submitBtn');
      var submitMsgLocal = document.getElementById('submitMsg');
      var uploadStatusLocal = document.getElementById('uploadStatus');

      // Minimal validation
      var titleEl = document.getElementById('title');
      if (!titleEl || !titleEl.value.trim()) {
        alert('Please enter the item name.');
        if (titleEl) titleEl.focus();
        return;
      }
      if (window.uploadInProgress) {
        alert('Please wait while the image upload finishes.');
        return;
      }

      // Build payload — gracefully handle missing elements
      var reportedDateEl = document.getElementById('reportedDate');
      var payload = {
        action: 'appendItem',
        timestamp: new Date().toISOString(),
reportedDate: new Date().toISOString(),
        type: (document.getElementById('type') && document.getElementById('type').value) || '',
        title: (document.getElementById('title') && document.getElementById('title').value.trim()) || '',
        description: (document.getElementById('desc') && document.getElementById('desc').value.trim()) || '',
        place: (document.getElementById('place') && document.getElementById('place').value.trim()) || '',
        date: (document.getElementById('date') && document.getElementById('date').value) || '',
        imageUrl: (document.getElementById('imageUrl') && document.getElementById('imageUrl').value.trim()) || '',
        contact: (document.getElementById('contact') && document.getElementById('contact').value.trim()) || ''
      };

      // UI feedback
      if (submitBtnLocal) submitBtnLocal.disabled = true;
      if (submitMsgLocal) submitMsgLocal.textContent = 'Submitting...';
      console.log('Payload:', payload);

      try {
        // Build form-encoded body
        var params = new URLSearchParams();
        Object.keys(payload).forEach(function(k){
          params.append(k, payload[k] || '');
        });

        // Ensure SHEET_API_URL is defined
        if (typeof SHEET_API_URL === 'undefined' || !SHEET_API_URL) {
          throw new Error('SHEET_API_URL not defined. Check script.js top config.');
        }

        var res = await fetch(SHEET_API_URL, {
          method: 'POST',
          body: params,
          mode: 'cors'
        });

        console.log('Network status:', res.status);

        var text = await res.text();
        console.log('Raw server response:', text);

        var json;
        try {
          json = JSON.parse(text);
        } catch (parseErr) {
          throw new Error('Server returned non-JSON response: ' + text.slice(0,300));
        }

        if (json && (json.success === true || json.success === 'true')) {
          if (submitMsgLocal) submitMsgLocal.textContent = 'Added ✓';
          // add to UI immediately
          try {
            if (!window.cachedItems) window.cachedItems = [];
            window.cachedItems.unshift({
              title: payload.title,
              description: payload.description,
              place: payload.place,
              date: payload.date,
              imageUrl: payload.imageUrl,
              contact: payload.contact,
              type: payload.type,
              reportedDate: payload.reportedDate,
              timestamp: payload.timestamp
            });
            if (typeof renderItems === 'function') renderItems();
          } catch (uiErr) {
            console.warn('Could not update UI locally:', uiErr);
          }
          // reset form
          window.formEl.reset();
          if (uploadStatusLocal) uploadStatusLocal.textContent = '';
          setTimeout(function(){ if (submitMsgLocal) submitMsgLocal.textContent = ''; }, 1200);
        } else {
          throw new Error('Server returned success:false — ' + (json && json.message ? json.message : JSON.stringify(json)));
        }

      } catch (err) {
        console.error('Submit failed:', err);
        alert('Submit failed: ' + (err.message || err));
        if (submitMsgLocal) submitMsgLocal.textContent = 'Submit failed';
      } finally {
        if (submitBtnLocal) submitBtnLocal.disabled = false;
      }
    }, false);

    console.log('Robust submit handler attached to #itemForm');

  } catch (attachErr) {
    console.error('Error attaching submit handler:', attachErr);
  }
})();
