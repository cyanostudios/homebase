/**
 * Price list detail — mini calculator / cart UI.
 * Requires ClubdeskPriceListCart (lib/priceListCart.js).
 */
(function () {
  const Cart = window.ClubdeskPriceListCart;
  const Swish = window.ClubdeskSwishPayload;
  const Qr = window.QRCode;
  if (!Cart) {
    console.error('ClubdeskPriceListCart saknas');
    return;
  }

  const root = document.getElementById('price-list-app');
  if (!root) return;

  const slug = root.getAttribute('data-slug') || '';
  const currency = root.getAttribute('data-currency') || 'SEK';
  const swishPayee = (root.getAttribute('data-swish-payee') || '').trim();
  const swishMessage = (root.getAttribute('data-swish-message') || '').trim();

  const listView = document.getElementById('price-list-view');
  const cartView = document.getElementById('cart-view');
  const cartBody = document.getElementById('cart-body');
  const cartTotalEl = document.getElementById('cart-total');
  const cartSwishEl = document.getElementById('cart-swish');
  const cartSwishQrEl = document.getElementById('cart-swish-qr');
  const cartSwishNumberEl = document.getElementById('cart-swish-number');
  const subTotalEl = document.getElementById('price-list-subheader-info');
  const toggleBtn = document.getElementById('cart-toggle-btn');

  let swishQrSeq = 0;

  function formatSwishDisplayNumber(payee) {
    const digits = String(payee || '').replace(/\D/g, '');
    if (/^07\d{8}$/.test(digits)) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
    }
    if (/^123\d{7}$/.test(digits)) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    return String(payee || '').trim();
  }

  const ICON_CART =
    '<svg class="cart-toggle-btn__icon" data-icon="cart" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M6 6h15l-1.5 9H7.5L6 6z" />' +
    '<path d="M6 6 5 3H2" />' +
    '<circle cx="9" cy="20" r="1.25" fill="currentColor" stroke="none" />' +
    '<circle cx="18" cy="20" r="1.25" fill="currentColor" stroke="none" />' +
    '</svg>';

  const ICON_LIST =
    '<svg class="cart-toggle-btn__icon" data-icon="list" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M8 6h13M8 12h13M8 18h13" />' +
    '<path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke-width="3" />' +
    '</svg>';

  let view = 'list'; // 'list' | 'cart'

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function money(amount) {
    return Cart.formatMoney(amount, currency, 'sv-SE');
  }

  function syncToggle(cart) {
    if (!toggleBtn) return;
    const empty = Cart.uniqueCount(cart) === 0;
    const showingCart = view === 'cart';
    const disabled = empty && !showingCart;

    toggleBtn.disabled = disabled;
    toggleBtn.classList.toggle('is-disabled', disabled);
    toggleBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', showingCart ? 'Visa lista' : 'Visa varukorg');
    toggleBtn.classList.toggle('step-nav__btn--next', !showingCart);
    toggleBtn.classList.toggle('step-nav__btn--prev', showingCart);
    toggleBtn.innerHTML = showingCart ? ICON_LIST : ICON_CART;
  }

  function hideCartSwish() {
    if (cartSwishEl) cartSwishEl.hidden = true;
    if (cartSwishQrEl) {
      cartSwishQrEl.removeAttribute('src');
    }
    if (cartSwishNumberEl) {
      cartSwishNumberEl.textContent = '';
    }
  }

  async function syncCartSwishQr(amount) {
    if (!cartSwishEl || !cartSwishQrEl || !Swish || !Qr || typeof Qr.toDataURL !== 'function') {
      hideCartSwish();
      return;
    }
    if (!swishPayee || !(amount > 0) || view !== 'cart') {
      hideCartSwish();
      return;
    }

    const payload = Swish.buildSwishTypeCPayload({
      payee: swishPayee,
      message: swishMessage,
      amount,
      lockMask: Swish.SWISH_LOCK.AMOUNT,
    });
    if (!payload.ok) {
      hideCartSwish();
      return;
    }

    const seq = ++swishQrSeq;
    try {
      const dataUrl = await Qr.toDataURL(payload.value, {
        width: 256,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      if (seq !== swishQrSeq) return;
      cartSwishQrEl.src = dataUrl;
      if (cartSwishNumberEl) {
        cartSwishNumberEl.textContent = formatSwishDisplayNumber(swishPayee);
      }
      cartSwishEl.hidden = false;
    } catch (err) {
      console.error(err);
      if (seq === swishQrSeq) hideCartSwish();
    }
  }

  function syncHeader(cart) {
    const sum = Cart.total(cart);
    if (subTotalEl) {
      subTotalEl.textContent = money(sum);
      subTotalEl.classList.add('step-subheader__total');
    }
    syncToggle(cart);
  }

  function readListCategoryOrder() {
    return Array.from(document.querySelectorAll('#price-list-view .price-list-section__title')).map(
      (el) => el.textContent.trim(),
    );
  }

  function readListLineOrder() {
    return Array.from(document.querySelectorAll('#price-list-view [data-line-id]')).map((el) =>
      el.getAttribute('data-line-id'),
    );
  }

  function renderCart(cart) {
    if (!cartBody || !cartTotalEl) return;
    const sum = Cart.total(cart);
    cartTotalEl.textContent = money(sum);
    void syncCartSwishQr(sum);

    if (cart.length === 0) {
      cartBody.innerHTML = `<p class="empty-state">Varukorgen är tom</p>`;
      return;
    }

    const sections = [];
    Cart.groupCartByCategoryOrder(cart, readListCategoryOrder(), readListLineOrder()).forEach(
      ([cat, items]) => {
        const rows = items
          .map((item) => {
            const lineTotal = item.price * item.qty;
            const meta =
              item.qty > 1
                ? `<p class="price-list-row__desc">${escapeHtml(String(item.qty))} × ${escapeHtml(money(item.price))}</p>`
                : '';
            return `<li class="price-list-row">
            <div class="price-list-row__main">
              <div class="price-list-row__text">
                <p class="price-list-row__title">${escapeHtml(item.title)}</p>
              </div>
              <div class="price-list-row__actions">
                <p class="price-list-row__price">${escapeHtml(money(lineTotal))}</p>
                <button type="button" class="price-list-qty-btn price-list-qty-btn--minus" data-cart-minus="${escapeHtml(item.id)}" aria-label="Minska antal">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
                </button>
              </div>
            </div>
            ${meta}
          </li>`;
          })
          .join('');
        sections.push(`<section class="price-list-section">
        <h2 class="price-list-section__title">${escapeHtml(cat)}</h2>
        <ul class="price-list-rows">${rows}</ul>
      </section>`);
      },
    );
    cartBody.innerHTML = sections.join('');
  }

  function setView(next) {
    view = next;
    if (listView) listView.hidden = view !== 'list';
    if (cartView) cartView.hidden = view !== 'cart';
    const cart = Cart.getCart(slug);
    syncHeader(cart);
    if (view === 'cart') {
      renderCart(cart);
    } else {
      hideCartSwish();
    }
  }

  function refresh() {
    const cart = Cart.getCart(slug);
    syncHeader(cart);
    if (view === 'cart') renderCart(cart);
  }

  root.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-cart-add]');
    if (addBtn) {
      e.preventDefault();
      const row = addBtn.closest('[data-line-id]');
      if (!row) return;
      Cart.addItem(slug, {
        id: row.getAttribute('data-line-id'),
        title: row.getAttribute('data-title') || '',
        price: row.getAttribute('data-price') || 0,
        category: row.getAttribute('data-category') || '',
      });
      refresh();
      return;
    }

    const minusBtn = e.target.closest('[data-cart-minus]');
    if (minusBtn) {
      e.preventDefault();
      const id = minusBtn.getAttribute('data-cart-minus');
      Cart.decrementItem(slug, id);
      refresh();
      return;
    }
  });

  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const cart = Cart.getCart(slug);
      if (view === 'list') {
        if (Cart.uniqueCount(cart) === 0) return;
        setView('cart');
      } else {
        setView('list');
      }
    });
  }

  refresh();
})();
