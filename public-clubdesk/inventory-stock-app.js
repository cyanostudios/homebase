(function () {
  const root = document.getElementById('inventory-app');
  if (!root) return;

  const slug = root.getAttribute('data-slug') || '';
  const totalEl = document.getElementById('inventory-stock-total');
  const errorEl = document.getElementById('inventory-stock-error');
  let saving = false;

  function setError(visible) {
    if (!errorEl) return;
    errorEl.hidden = !visible;
  }

  function paintRow(row, quantity) {
    const qtyEl = row.querySelector('[data-stock-qty]');
    const minus = row.querySelector('[data-stock-delta="-1"]');
    if (qtyEl) qtyEl.textContent = String(quantity);
    if (minus) minus.disabled = quantity <= 0;
  }

  function paintTotal() {
    if (!totalEl) return;
    let sum = 0;
    root.querySelectorAll('[data-stock-qty]').forEach((el) => {
      sum += Number(el.textContent) || 0;
    });
    totalEl.textContent = String(sum);
  }

  root.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-stock-delta]');
    if (!button || saving || !slug) return;
    const row = button.closest('[data-stock-row]');
    if (!row) return;

    const delta = Number(button.getAttribute('data-stock-delta'));
    const qtyEl = row.querySelector('[data-stock-qty]');
    const current = Number(qtyEl && qtyEl.textContent) || 0;
    const next = current + delta;
    if (!Number.isInteger(next) || next < 0 || next > 1000000) return;

    const previousVariantId = row.getAttribute('data-variant-id') || '0';
    saving = true;
    setError(false);
    paintRow(row, next);
    paintTotal();

    try {
      const response = await fetch('/api/inventory_quantity.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          slug,
          variantId: Number(previousVariantId) || 0,
          quantity: next,
        }),
      });
      if (!response.ok) throw new Error('stock');
      const payload = await response.json();
      if (payload.variantId) {
        row.setAttribute('data-variant-id', String(payload.variantId));
      }
      paintRow(row, Number(payload.quantity));
      if (totalEl && payload.totalQuantity != null) {
        totalEl.textContent = String(payload.totalQuantity);
      }
    } catch {
      paintRow(row, current);
      paintTotal();
      setError(true);
    } finally {
      saving = false;
    }
  });
})();
