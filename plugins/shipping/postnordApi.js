const { AppError } = require('../../server/core/errors/AppError');

const AUTH_SCHEMES = {
  BASIC_INTEGRATIONID_APIKEY: 'BASIC_INTEGRATIONID_APIKEY',
  BASIC_APIKEY_APISECRET: 'BASIC_APIKEY_APISECRET',
  HEADER_APIKEY: 'HEADER_APIKEY',
};

function getAuthHeaders(settings) {
  const scheme = String(settings?.authScheme || '').trim().toUpperCase();
  const headers = {};

  if (scheme === AUTH_SCHEMES.BASIC_INTEGRATIONID_APIKEY) {
    const integrationId = String(settings?.integrationId || '').trim();
    const apiKey = String(settings?.apiKey || '').trim();
    if (!integrationId || !apiKey) {
      throw new AppError(
        'Missing integrationId/apiKey for BASIC_INTEGRATIONID_APIKEY',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    headers.Authorization = `Basic ${Buffer.from(`${integrationId}:${apiKey}`, 'utf8').toString('base64')}`;
    return headers;
  }

  if (scheme === AUTH_SCHEMES.BASIC_APIKEY_APISECRET) {
    const apiKey = String(settings?.apiKey || '').trim();
    const apiSecret = String(settings?.apiSecret || '').trim();
    if (!apiKey || !apiSecret) {
      throw new AppError(
        'Missing apiKey/apiSecret for BASIC_APIKEY_APISECRET',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    headers.Authorization = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`, 'utf8').toString('base64')}`;
    return headers;
  }

  if (scheme === AUTH_SCHEMES.HEADER_APIKEY) {
    const headerName = String(settings?.apiKeyHeaderName || '').trim();
    const apiKey = String(settings?.apiKey || '').trim();
    if (!headerName || !apiKey) {
      throw new AppError(
        'Missing apiKeyHeaderName/apiKey for HEADER_APIKEY',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    headers[headerName] = apiKey;
    return headers;
  }

  throw new AppError(
    `Unsupported auth scheme: ${scheme || 'none'}`,
    400,
    AppError.CODES.VALIDATION_ERROR,
  );
}

async function createShipment(settings, payload) {
  const bookingUrl = String(settings?.bookingUrl || '').trim();
  if (!bookingUrl) {
    throw new AppError('Missing PostNord booking URL in settings', 400, AppError.CODES.VALIDATION_ERROR);
  }

  const authHeaders = getAuthHeaders(settings);
  const response = await fetch(bookingUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text().catch(() => '');
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    const msg =
      (json && (json.message || json.error)) ||
      (text ? text.slice(0, 400) : '') ||
      response.statusText ||
      'PostNord booking failed';
    throw new AppError(msg, 502, AppError.CODES.EXTERNAL_SERVICE_ERROR);
  }

  return { json, text };
}

module.exports = { AUTH_SCHEMES, createShipment };
