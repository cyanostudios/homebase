// Public Booking App
// Configure API_BASE to point to your Homebase backend
const API_BASE = 'http://localhost:3002';

let selectedSlot = null;

// DOM Elements
const loadingEl = document.getElementById('loading');
const slotsGridEl = document.getElementById('slots-grid');
const emptyStateEl = document.getElementById('empty-state');
const errorStateEl = document.getElementById('error-state');
const errorMessageEl = document.getElementById('error-message');
const modalOverlayEl = document.getElementById('modal-overlay');
const bookingFormViewEl = document.getElementById('booking-form-view');
const successViewEl = document.getElementById('success-view');
const errorViewEl = document.getElementById('error-view');
const bookingFormEl = document.getElementById('booking-form');
const slotSummaryEl = document.getElementById('slot-summary');
const submitBtnEl = document.getElementById('submit-btn');
const submitTextEl = document.getElementById('submit-text');
const submitLoadingEl = document.getElementById('submit-loading');

// Initialize
document.addEventListener('DOMContentLoaded', loadSlots);

// Close modal on overlay click
modalOverlayEl.addEventListener('click', (e) => {
  if (e.target === modalOverlayEl) {
    closeModal();
  }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalOverlayEl.style.display !== 'none') {
    closeModal();
  }
});

async function loadSlots() {
  showLoading();

  try {
    const response = await fetch(`${API_BASE}/api/public/slots`);

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    const slots = data.slots || [];

    if (slots.length === 0) {
      showEmpty();
    } else {
      renderSlots(slots);
    }
  } catch (error) {
    console.error('Failed to load slots:', error);
    showError(error.message);
  }
}

function showLoading() {
  loadingEl.style.display = 'flex';
  slotsGridEl.style.display = 'none';
  emptyStateEl.style.display = 'none';
  errorStateEl.style.display = 'none';
}

function showEmpty() {
  loadingEl.style.display = 'none';
  slotsGridEl.style.display = 'none';
  emptyStateEl.style.display = 'block';
  errorStateEl.style.display = 'none';
}

function showError(message) {
  loadingEl.style.display = 'none';
  slotsGridEl.style.display = 'none';
  emptyStateEl.style.display = 'none';
  errorStateEl.style.display = 'block';
  errorMessageEl.textContent = message || 'Please try again later';
}

function renderSlots(slots) {
  loadingEl.style.display = 'none';
  slotsGridEl.style.display = 'grid';
  emptyStateEl.style.display = 'none';
  errorStateEl.style.display = 'none';

  slotsGridEl.innerHTML = slots
    .map((slot) => {
      const totalBooked = slot.booked_count + slot.mentions_count;
      const isFullyBooked = totalBooked >= slot.capacity;
      const availableSpots = Math.max(0, slot.capacity - totalBooked);

      return `
      <div class="slot-card ${isFullyBooked ? 'fully-booked' : ''}" 
           onclick="${isFullyBooked ? '' : `openBookingModal('${slot.id}')`}"
           data-slot='${JSON.stringify(slot)}'>
        <div class="slot-location">${escapeHtml(slot.location || 'Unnamed Slot')}</div>
        <div class="slot-datetime">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          ${formatDateTime(slot.slot_time)}
        </div>
        <div class="slot-capacity">
          ${
            isFullyBooked
              ? '<span class="fully-booked-badge">Fully Booked</span>'
              : `<span class="capacity-info">${availableSpots} of ${slot.capacity} available</span>`
          }
          <div class="capacity-dots">
            ${renderCapacityDots(slot.capacity, totalBooked)}
          </div>
        </div>
      </div>
    `;
    })
    .join('');
}

function renderCapacityDots(capacity, filled) {
  let dots = '';
  for (let i = 0; i < capacity; i++) {
    dots += `<span class="capacity-dot ${i < filled ? 'filled' : 'empty'}"></span>`;
  }
  return dots;
}

function formatDateTime(isoString) {
  const date = new Date(isoString);
  const options = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return date.toLocaleString('sv-SE', options);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function openBookingModal(slotId) {
  const slotCard = document.querySelector(`[data-slot*='"id":"${slotId}"']`);
  if (!slotCard) return;

  selectedSlot = JSON.parse(slotCard.dataset.slot);

  // Update summary
  slotSummaryEl.innerHTML = `
    <div class="location">${escapeHtml(selectedSlot.location || 'Unnamed Slot')}</div>
    <div class="datetime">${formatDateTime(selectedSlot.slot_time)}</div>
  `;

  // Reset form
  bookingFormEl.reset();
  showBookingForm();

  // Show modal
  modalOverlayEl.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Focus first input
  setTimeout(() => {
    document.getElementById('name').focus();
  }, 100);
}

function closeModal() {
  modalOverlayEl.style.display = 'none';
  document.body.style.overflow = '';
  selectedSlot = null;
}

function showBookingForm() {
  bookingFormViewEl.style.display = 'block';
  successViewEl.style.display = 'none';
  errorViewEl.style.display = 'none';
  setSubmitLoading(false);
}

function showSuccessView(message) {
  bookingFormViewEl.style.display = 'none';
  successViewEl.style.display = 'block';
  errorViewEl.style.display = 'none';
  document.getElementById('success-message').textContent =
    message || 'Your spot has been reserved.';
}

function showErrorView(message) {
  bookingFormViewEl.style.display = 'none';
  successViewEl.style.display = 'none';
  errorViewEl.style.display = 'block';
  document.getElementById('booking-error-message').textContent =
    message || 'Something went wrong. Please try again.';
}

function setSubmitLoading(loading) {
  submitBtnEl.disabled = loading;
  submitTextEl.style.display = loading ? 'none' : 'inline';
  submitLoadingEl.style.display = loading ? 'inline-flex' : 'none';
}

async function submitBooking(event) {
  event.preventDefault();

  if (!selectedSlot) return;

  const formData = new FormData(bookingFormEl);
  const data = {
    name: formData.get('name'),
    email: formData.get('email') || null,
    phone: formData.get('phone') || null,
    message: formData.get('message') || null,
  };

  setSubmitLoading(true);

  try {
    const response = await fetch(`${API_BASE}/api/public/slots/${selectedSlot.id}/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Booking failed');
    }

    showSuccessView(`Thank you, ${data.name}! Your booking has been confirmed.`);

    // Reload slots to update availability
    setTimeout(loadSlots, 1000);
  } catch (error) {
    console.error('Booking failed:', error);
    showErrorView(error.message);
  }
}
