/** Page numbers and ellipsis markers for list pagination (1-based current page). */
export function buildListPaginationItems(
  currentPage: number,
  totalPages: number,
): Array<number | 'ellipsis'> {
  if (totalPages < 1) {
    return [];
  }
  const total = totalPages;
  const cur = Math.min(Math.max(1, Math.floor(currentPage)), total);
  if (total === 1) {
    return [1];
  }
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const add = new Set<number>();
  add.add(1);
  add.add(total);

  if (cur <= 4) {
    for (let p = 1; p <= 5; p++) {
      add.add(p);
    }
  } else if (cur >= total - 3) {
    for (let p = total - 4; p <= total; p++) {
      add.add(p);
    }
  } else {
    for (let p = cur - 2; p <= cur + 2; p++) {
      add.add(p);
    }
  }

  const sorted = Array.from(add).sort((a, b) => a - b);
  const out: Array<number | 'ellipsis'> = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (i > 0 && p - sorted[i - 1] > 1) {
      out.push('ellipsis');
    }
    out.push(p);
  }
  return out;
}
