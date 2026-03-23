/**
 * Parity rule used here: calendar *day-of-month* (1–31) odd/even must match the plate's
 * last digit odd/even. This matches how the UI explains the rule.
 *
 * Next matching date must advance real calendar days (handles month/year boundaries).
 * Example: Jan 31 and Feb 1 are both odd → an even-last-digit plate skips both and lands on Feb 2.
 */
export function findNextMatchingPumpDate(from: Date, lastDigit: number): Date {
  const isDigitOdd = lastDigit % 2 !== 0;
  const next = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  next.setDate(next.getDate() + 1);

  const maxSteps = 400;
  let steps = 0;
  while ((next.getDate() % 2 !== 0) !== isDigitOdd) {
    next.setDate(next.getDate() + 1);
    steps += 1;
    if (steps > maxSteps) {
      break;
    }
  }
  return next;
}
