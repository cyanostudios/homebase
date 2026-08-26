/** Derive display name from email local-part (users have no name column). */
export function displayNameFromEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') {
    return '';
  }
  const trimmed = email.trim();
  if (!trimmed) {
    return '';
  }
  const local = trimmed.split('@')[0] || '';
  const name = local
    .replace(/[._+-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return name || trimmed;
}

/** Embed image URL as data URI so iframe srcDoc can render logos. */
export async function fetchLogoAsDataUrl(logoUrl: string): Promise<string> {
  const url = typeof logoUrl === 'string' ? logoUrl.trim() : '';
  if (!url) {
    return '';
  }
  if (url.startsWith('data:')) {
    return url;
  }
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      return url;
    }
    const blob = await res.blob();
    if (!blob.type.startsWith('image/') && !url.match(/\.(png|jpe?g|gif|webp|svg)(\?|$)/i)) {
      return url;
    }
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : url);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}
