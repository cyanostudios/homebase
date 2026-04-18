export function getUserInitials(name: string | undefined, email: string | undefined): string {
  if (name && name.trim().length > 0) {
    const nameParts = name.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
    }
    if (nameParts[0].length >= 2) {
      return nameParts[0].substring(0, 2).toUpperCase();
    }
    return nameParts[0][0].toUpperCase();
  }

  if (!email) {
    return 'U';
  }
  const localPart = email.split('@')[0];
  const parts = localPart.split(/[._-]/);

  if (parts.length >= 2 && parts[0].length > 0 && parts[1].length > 0) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  if (localPart.length >= 2) {
    return localPart.substring(0, 2).toUpperCase();
  }

  return localPart[0].toUpperCase();
}

export function getUserColor(email: string | undefined): string {
  if (!email) {
    return 'bg-gray-500';
  }

  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500',
  ];

  return colors[Math.abs(hash) % colors.length];
}
