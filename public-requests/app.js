// Public Requests App
// API base resolution:
// 1) Optional runtime override from index.html: window.PUBLIC_REQUESTS_API_BASE
// 2) Local development fallback: localhost API
// 3) Production fallback: deployed API host
const API_BASE =
  window.PUBLIC_REQUESTS_API_BASE ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3002'
    : `https://${window.location.hostname}`);

const form = document.getElementById('request-form');
const errorBox = document.getElementById('error-box');
const successView = document.getElementById('success-view');
const submitBtn = document.getElementById('submit-btn');
const submitText = document.getElementById('submit-text');
const submitLoading = document.getElementById('submit-loading');
const teamGroup = document.getElementById('team-group');
const teamSelect = document.getElementById('team-id');

// Load teams for dropdown
async function loadTeams() {
  try {
    const res = await fetch(`${API_BASE}/api/requests/public/teams`);
    if (!res.ok) return;
    const teams = await res.json();
    if (teams && teams.length > 0) {
      teamGroup.style.display = 'block';
      teams.forEach((team) => {
        const opt = document.createElement('option');
        opt.value = team.id;
        opt.textContent = team.name + (team.age_group ? ` (${team.age_group})` : '');
        teamSelect.appendChild(opt);
      });
    }
  } catch {
    // Teams are optional — hide dropdown silently if unavailable
  }
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = 'block';
}

function hideError() {
  errorBox.style.display = 'none';
  errorBox.textContent = '';
}

function setSubmitting(submitting) {
  submitBtn.disabled = submitting;
  submitText.style.display = submitting ? 'none' : 'inline';
  submitLoading.style.display = submitting ? 'flex' : 'none';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const title = document.getElementById('title').value.trim();
  if (!title) {
    showError('Rubrik är obligatorisk.');
    return;
  }

  const teamIdRaw = teamSelect.value;
  const payload = {
    title,
    description: document.getElementById('description').value.trim() || undefined,
    request_type: document.getElementById('request-type').value,
    team_id: teamIdRaw ? parseInt(teamIdRaw, 10) : null,
    submitter_name: document.getElementById('submitter-name').value.trim() || undefined,
    submitter_email: document.getElementById('submitter-email').value.trim() || undefined,
  };

  setSubmitting(true);

  try {
    const res = await fetch(`${API_BASE}/api/requests/public/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Server error ${res.status}`);
    }

    form.style.display = 'none';
    successView.style.display = 'flex';
  } catch (err) {
    showError(err.message || 'Något gick fel. Försök igen.');
    setSubmitting(false);
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', loadTeams);
