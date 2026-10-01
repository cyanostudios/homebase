(function () {
  const form = document.getElementById('kiosk-unlock-form');
  if (!form) return;

  const input = document.getElementById('kiosk-unlock-secret');
  const errorEl = document.getElementById('kiosk-unlock-error');
  const button = form.querySelector('button[type="submit"]');

  function setError(visible) {
    if (!errorEl) return;
    errorEl.hidden = !visible;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const secret = String(input && input.value ? input.value : '').trim();
    if (!secret) {
      setError(true);
      return;
    }
    if (button) button.disabled = true;
    setError(false);
    try {
      const response = await fetch('/api/kiosk_session.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ secret }),
      });
      if (!response.ok) throw new Error('unlock');
      window.location.reload();
    } catch {
      setError(true);
      if (button) button.disabled = false;
    }
  });
})();
