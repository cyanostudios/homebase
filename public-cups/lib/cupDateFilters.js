/**
 * Cupappen date parse + upcoming/past filter helpers.
 * UMD: Jest (CommonJS) + browser global `CupappenDateFilters`.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === 'object') {
    root.CupappenDateFilters = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /**
   * Parse cup start/end into a local calendar Date (midnight).
   * Prefers YYYY-MM-DD (and leading date of timestamps) so UTC midnight
   * does not shift the calendar day in EU timezones.
   * @param {unknown} value
   * @returns {Date|null}
   */
  function parseCupDate(value) {
    if (value == null || value === '') return null;
    const s = String(value).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const y = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10);
      const d = parseInt(m[3], 10);
      const date = new Date(y, mo - 1, d);
      if (date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d) {
        return date;
      }
      return null;
    }
    const date = new Date(s);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function startOfLocalDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function endOfLocalDay(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }

  /**
   * Upcoming = still on or after today (uses end_date when present, else start_date).
   * Cups without a parseable date are not upcoming.
   * @param {{ start_date?: unknown, end_date?: unknown }} cup
   * @param {Date} [now]
   */
  function isUpcoming(cup, now = new Date()) {
    const end = parseCupDate(cup?.end_date);
    const start = parseCupDate(cup?.start_date);
    const compare = end || start;
    if (!compare) return false;
    return endOfLocalDay(compare) >= startOfLocalDay(now);
  }

  /**
   * @param {{ start_date?: unknown, end_date?: unknown }} cup
   * @param {string} dateFilterValue upcoming | all | past | month:YYYY-MM
   * @param {Date} [now]
   */
  function cupMatchesDateFilter(cup, dateFilterValue, now = new Date()) {
    if (dateFilterValue === 'all') return true;
    if (dateFilterValue === 'upcoming') return isUpcoming(cup, now);
    if (dateFilterValue === 'past')
      return (
        !isUpcoming(cup, now) &&
        Boolean(parseCupDate(cup?.end_date) || parseCupDate(cup?.start_date))
      );
    if (!String(dateFilterValue).startsWith('month:')) return true;

    const monthKey = String(dateFilterValue).slice('month:'.length);
    const startDate = parseCupDate(cup?.start_date);
    const endDate = parseCupDate(cup?.end_date) || startDate;
    if (!startDate && !endDate) return false;

    const first = startDate || endDate;
    const last = endDate || startDate;
    if (!first || !last) return false;

    const monthStart = new Date(`${monthKey}-01T00:00:00`);
    if (Number.isNaN(monthStart.getTime())) return true;
    const monthEnd = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return first <= monthEnd && last >= monthStart;
  }

  /**
   * Home/Kommande row buckets.
   * Ongoing multi-month cups (start before this month, end later) land in "Den här månaden".
   * @param {{ start_date?: unknown, end_date?: unknown }} cup
   * @param {Date} [now]
   */
  function timeBucket(cup, now = new Date()) {
    if (!isUpcoming(cup, now)) return 'Passerade';
    const start = parseCupDate(cup?.start_date);
    const end = parseCupDate(cup?.end_date) || start;
    if (!start && !end) return 'Kommande';

    const thisMonth = now.getFullYear() * 12 + now.getMonth();
    const startMonth = start ? start.getFullYear() * 12 + start.getMonth() : null;
    const endMonth = end ? end.getFullYear() * 12 + end.getMonth() : startMonth;
    if (
      startMonth != null &&
      endMonth != null &&
      startMonth <= thisMonth &&
      endMonth >= thisMonth
    ) {
      return 'Den här månaden';
    }

    const d = start || end;
    const cupMonth = d.getFullYear() * 12 + d.getMonth();
    if (cupMonth === thisMonth) return 'Den här månaden';
    return 'Kommande';
  }

  function monthKeyFromCup(cup) {
    const d = parseCupDate(cup?.start_date) || parseCupDate(cup?.end_date);
    if (!d) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  /**
   * @param {Date} [now]
   * @returns {string} YYYY-MM for the local calendar month of `now`
   */
  function currentMonthKey(now = new Date()) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  /**
   * Month keys a cup spans that belong in the date-filter dropdown:
   * current calendar month and later only (no past months).
   * @param {{ start_date?: unknown, end_date?: unknown }} cup
   * @param {Date} [now]
   * @returns {string[]}
   */
  function selectableMonthKeysFromCup(cup, now = new Date()) {
    const start = parseCupDate(cup?.start_date);
    const end = parseCupDate(cup?.end_date) || start;
    if (!start && !end) return [];
    const first = start || end;
    const last = end || start;
    if (!first || !last) return [];

    const minKey = currentMonthKey(now);
    const keys = [];
    let y = first.getFullYear();
    let m = first.getMonth();
    const endY = last.getFullYear();
    const endM = last.getMonth();
    let guard = 0;
    while (y < endY || (y === endY && m <= endM)) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      if (key >= minKey) keys.push(key);
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
      guard += 1;
      if (guard > 48) break;
    }
    return keys;
  }

  return {
    parseCupDate,
    isUpcoming,
    cupMatchesDateFilter,
    timeBucket,
    monthKeyFromCup,
    currentMonthKey,
    selectableMonthKeysFromCup,
    startOfLocalDay,
    endOfLocalDay,
  };
});
