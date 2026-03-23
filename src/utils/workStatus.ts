export type Sector = "government" | "private";

export interface WorkStatusResult {
  status: string;
  detail: string;
  message: string;
  type: "active" | "standby" | "off" | "verify";
  color: string;
}

/** Logic from should-I-work-today: government vs private, weekday/weekend, essential vs normal. */
export function calculateWorkStatus(
  sector: Sector,
  isEssential: boolean | null,
  dayIndex: number
): WorkStatusResult | null {
  const isWeekend = dayIndex === 0 || dayIndex === 6;
  const isWednesday = dayIndex === 3;

  if (sector === "government") {
    if (isEssential === true) {
      if (!isWeekend) {
        return {
          status: "Go to Work",
          detail: "Must report today",
          message: "You have work today. Please go to your office.",
          type: "active",
          color: "text-blue-600 bg-blue-50 border-blue-100 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-900",
        };
      }
      return {
        status: "Holiday",
        detail: "Weekend",
        message: "It is the weekend. No need to go to work.",
        type: "standby",
        color: "text-zinc-600 bg-zinc-50 border-zinc-200 dark:text-zinc-300 dark:bg-zinc-800/50 dark:border-zinc-700",
      };
    }
    if (isEssential === false) {
      if (isWednesday || isWeekend) {
        return {
          status: "Stay Home",
          detail: "Day Off",
          message: "Today is a holiday or a day off for you.",
          type: "off",
          color: "text-zinc-600 bg-zinc-50 border-zinc-200 dark:text-zinc-300 dark:bg-zinc-800/50 dark:border-zinc-700",
        };
      }
      return {
        status: "Go to Work",
        detail: "Normal Work Day",
        message: "Today is a normal work day. Please go to work.",
        type: "active",
        color: "text-blue-600 bg-blue-50 border-blue-100 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-900",
      };
    }
  } else if (sector === "private") {
    if (!isWeekend) {
      return {
        status: "Operational",
        detail: "Standard Duty",
        message: "Standard weekday operations are active. Please report to work.",
        type: "active",
        color: "text-blue-600 bg-blue-50 border-blue-100 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-900",
      };
    }
    return {
      status: "Conditional",
      detail: "Verification Required",
      message:
        "Weekend status varies. Please verify with your supervisor or report if previously scheduled.",
      type: "verify",
      color: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/30 dark:border-amber-800",
    };
  }
  return null;
}
