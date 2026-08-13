/**
 * Cup detail page interactions (ratings, share, pageview beacon).
 * Boot config: <script type="application/json" id="cup-detail-boot">{"cupId":N}</script>
 */
(function () {
  function readBoot() {
    var el = document.getElementById('cup-detail-boot');
    if (!el) return { cupId: 0 };
    try {
      return JSON.parse(el.textContent || '{}') || { cupId: 0 };
    } catch (_) {
      return { cupId: 0 };
    }
  }

  var boot = readBoot();
  var cupId = Number(boot.cupId) || 0;

  document.querySelectorAll('#detail-logo, a.logo').forEach(function (el) {
    el.addEventListener('click', function () {
      try {
        sessionStorage.setItem('cupappen_active_tab', 'home');
      } catch (err) {
        /* ignore */
      }
    });
  });

  (function trackCupPageview() {
    if (!cupId) return;
    var body = JSON.stringify({
      page_kind: 'cup',
      cup_id: cupId,
      referrer: document.referrer || '',
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/pageview.php', new Blob([body], { type: 'application/json' }));
        return;
      }
    } catch (_) {}
    fetch('/api/pageview.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      keepalive: true,
    }).catch(function () {});
  })();

  var form = document.getElementById('rating-form');
  var errorEl = document.getElementById('rating-error');
  var successEl = document.getElementById('rating-success');
  var picker = document.getElementById('star-picker');
  var ratingValue = document.getElementById('rating-value');
  var shareBtn = document.getElementById('share-btn');
  var currentRating = 0;

  function renderStars() {
    if (!picker) return;
    picker.innerHTML = '';
    for (var i = 1; i <= 5; i++) {
      (function (star) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.active = star <= currentRating ? 'true' : 'false';
        btn.innerHTML =
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="m12 17.3-6.18 3.73 1.64-7.03L2 9.27l7.19-.62L12 2l2.81 6.65 7.19.62-5.46 4.73 1.64 7.03z"/></svg>';
        btn.addEventListener('click', function () {
          currentRating = star;
          if (ratingValue) ratingValue.value = String(star);
          renderStars();
        });
        picker.appendChild(btn);
      })(i);
    }
  }
  renderStars();

  if (shareBtn) {
    shareBtn.addEventListener('click', async function () {
      try {
        if (navigator.share) {
          await navigator.share({ url: window.location.href });
        } else {
          await navigator.clipboard.writeText(window.location.href);
          shareBtn.textContent = 'Länk kopierad';
          setTimeout(function () {
            shareBtn.textContent = 'Dela';
          }, 1500);
        }
      } catch (_) {}
    });
  }

  if (!form) return;
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
    if (successEl) successEl.hidden = true;

    var body = {
      cup_id: cupId,
      reviewer_name: String((document.getElementById('reviewer_name') || {}).value || '').trim(),
      reviewer_role: String((document.getElementById('reviewer_role') || {}).value || '').trim(),
      reviewer_club: String((document.getElementById('reviewer_club') || {}).value || '').trim(),
      reviewer_class: String((document.getElementById('reviewer_class') || {}).value || '').trim(),
      comment: String((document.getElementById('comment') || {}).value || '').trim(),
      rating: Number((ratingValue && ratingValue.value) || 0),
    };

    if (!body.reviewer_name || body.rating < 1 || body.rating > 5) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = 'Namn och betyg (1-5) krävs.';
      }
      return;
    }

    try {
      var response = await fetch('/api/ratings.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      var payload = await response.json();
      if (!response.ok) {
        throw new Error((payload && payload.error) || 'Kunde inte spara omdömet.');
      }
      if (successEl) successEl.hidden = false;
      setTimeout(function () {
        window.location.reload();
      }, 500);
    } catch (err) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = (err && err.message) || 'Kunde inte spara omdömet.';
      }
    }
  });
})();
