/**
 * Org Swish page — QR without locked amount (amount editable in Swish app).
 */
(function () {
  const Swish = window.ClubdeskSwishPayload;
  const Qr = window.QRCode;
  const root = document.getElementById('org-swish');
  const qrEl = document.getElementById('org-swish-qr');
  const numberEl = document.getElementById('org-swish-number');
  if (!root || !qrEl || !numberEl || !Swish || !Qr || typeof Qr.toDataURL !== 'function') {
    return;
  }

  const payee = (root.getAttribute('data-swish-payee') || '').trim();
  const message = (root.getAttribute('data-swish-message') || '').trim();
  if (!payee) return;

  function formatSwishDisplayNumber(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (/^07\d{8}$/.test(digits)) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
    }
    if (/^123\d{7}$/.test(digits)) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    return String(value || '').trim();
  }

  const payload = Swish.buildSwishTypeCPayload({
    payee,
    message,
    amount: null,
    lockMask: Swish.SWISH_LOCK.AMOUNT,
  });
  if (!payload.ok) {
    numberEl.textContent = formatSwishDisplayNumber(payee);
    return;
  }

  numberEl.textContent = formatSwishDisplayNumber(payee);

  Qr.toDataURL(payload.value, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
  })
    .then((dataUrl) => {
      qrEl.src = dataUrl;
      qrEl.hidden = false;
    })
    .catch(() => {
      /* number still shown */
    });
})();
