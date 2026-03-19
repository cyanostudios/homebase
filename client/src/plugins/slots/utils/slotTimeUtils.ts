/** True when slot start time is strictly before now. */
export function isSlotTimePast(slotTime: string | null | undefined): boolean {
  if (!slotTime) {
    return false;
  }
  const ms = new Date(slotTime).getTime();
  return !Number.isNaN(ms) && ms < Date.now();
}
