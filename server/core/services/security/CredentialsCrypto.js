const crypto = require('crypto');

const PREFIX = 'enc:v1:';

let warnedMissingKey = false;

function getConfiguredKey() {
  const raw = String(process.env.CREDENTIALS_ENCRYPTION_KEY || '').trim();
  if (raw) return raw;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY is required in production');
  }

  const fallback = String(process.env.SESSION_SECRET || '').trim();
  if (!fallback && !warnedMissingKey) {
    warnedMissingKey = true;
    console.warn('[CredentialsCrypto] Missing encryption key in development.');
  }
  return fallback || 'homebase-dev-credentials-key';
}

function deriveKey() {
  const configured = getConfiguredKey();
  if (/^[a-f0-9]{64}$/i.test(configured)) {
    return Buffer.from(configured, 'hex');
  }
  return crypto.createHash('sha256').update(configured).digest();
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

function encrypt(plainText) {
  if (plainText == null || plainText === '') return null;
  const text = String(plainText);
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decrypt(value) {
  if (value == null || value === '') return null;
  if (!isEncrypted(value)) return String(value);

  const payload = String(value).slice(PREFIX.length);
  const [ivB64, tagB64, encryptedB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !encryptedB64) {
    throw new Error('Invalid encrypted payload format');
  }

  const key = deriveKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

module.exports = {
  encrypt,
  decrypt,
  isEncrypted,
};
