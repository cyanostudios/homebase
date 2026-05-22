// server/core/utils/neonApiHealth.js
// Lightweight Neon Console API check (NEON_API_KEY validity).

const axios = require('axios');

const NEON_API_BASE = 'https://console.neon.tech/api/v2';

/**
 * @param {string|undefined} apiKey
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<{ status: string, projectCount?: number, httpStatus?: number, message?: string }>}
 */
async function checkNeonApi(apiKey, opts = {}) {
  const timeout = opts.timeoutMs ?? 10000;

  if (!apiKey || !String(apiKey).trim()) {
    return { status: 'missing_key', message: 'NEON_API_KEY is not set' };
  }

  try {
    const response = await axios.get(`${NEON_API_BASE}/projects`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout,
    });
    const projects = response.data?.projects;
    return {
      status: 'ok',
      projectCount: Array.isArray(projects) ? projects.length : 0,
    };
  } catch (error) {
    const httpStatus = error.response?.status;
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Neon API request failed';

    if (httpStatus === 401) {
      return { status: 'unauthorized', httpStatus, message };
    }
    if (httpStatus === 403) {
      return { status: 'forbidden', httpStatus, message };
    }
    return { status: 'error', httpStatus, message };
  }
}

function resolveTenantProvider() {
  return process.env.TENANT_PROVIDER || (process.env.NEON_API_KEY ? 'neon' : 'local');
}

/**
 * Health payload: skip check when provider is local and no API key.
 */
async function checkNeonApiForHealth() {
  const provider = resolveTenantProvider();
  if (provider !== 'neon') {
    return { status: 'skipped', reason: `tenant provider is ${provider}` };
  }
  return checkNeonApi(process.env.NEON_API_KEY);
}

module.exports = { checkNeonApi, checkNeonApiForHealth, resolveTenantProvider };
