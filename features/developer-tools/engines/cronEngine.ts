/**
 * Cron expression engine on top of cron-parser v5. 5-field (classic) and
 * 6-field (with seconds) dialects are detected and kept separate — never
 * silently mixed. Explanations and "next runs" are produced for both.
 */

export type CronDialect = "classic-5" | "with-seconds-6";

export interface CronFieldExplanation {
  label: string;
  raw: string;
  description: string;
}

export interface CronParseResult {
  ok: boolean;
  dialect?: CronDialect;
  explain?: CronFieldExplanation[];
  nextRuns?: string[]; // ISO strings
  error?: string;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function describe(value: string, kind: "minute" | "hour" | "dom" | "month" | "dow" | "second"): string {
  if (value === "*") {
    if (kind === "second") return "every second";
    if (kind === "minute") return "every minute";
    if (kind === "hour") return "every hour";
    if (kind === "dom") return "every day of the month";
    if (kind === "month") return "every month";
    return "every day of the week";
  }
  const m = /^(.+)\/(.+)$/.exec(value);
  if (m) {
    const unit = { second: "seconds", minute: "minutes", hour: "hours", dom: "days of month", month: "months", dow: "days of week" }[kind];
    return `${m[1] === "*" ? "every" : `starting at ${m[1]}`} ${m[2]} ${unit}`;
  }
  switch (kind) {
    case "minute":
      return `at minute ${value}`;
    case "hour":
      return `at hour ${value} (24h)`;
    case "dom":
      return `on day ${value} of the month`;
    case "month": {
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const idx = Number(value);
      return Number.isInteger(idx) && idx >= 1 && idx <= 12 ? `in ${months[idx - 1]}` : `in month ${value}`;
    }
    case "dow": {
      const names = value.split(",").map((v) => WEEKDAY_NAMES[Number(v)] ?? v).join(", ");
      return `on ${names || value}`;
    }
    default:
      return value;
  }
}

const FIELD_KIND = ["minute", "hour", "dom", "month", "dow"] as const;

export function explainCron(expr: string): { dialect: CronDialect; fields: { label: string; raw: string; description: string }[] } {
  const raw = expr.trim().split(/\s+/);
  const six = raw.length === 6;
  const parts = six ? ["second", "minute", "hour", "dom", "month", "dow"] : ["minute", "hour", "dom", "month", "dow"];
  const labels = six ? ["Second", "Minute", "Hour", "Day of Month", "Month", "Day of Week"] : ["Minute", "Hour", "Day of Month", "Month", "Day of Week"];
  const kinds = parts as ("minute" | "hour" | "dom" | "month" | "dow" | "second")[];
  const fields = raw.map((value, i) => ({ label: labels[i], raw: value, description: describe(value, kinds[i]) }));
  return { dialect: six ? "with-seconds-6" : "classic-5", fields };
}

export async function parseCronExpression(
  expr: string,
  options: { timeZone?: string; count?: number }
): Promise<CronParseResult> {
  if (expr.trim().length === 0) return { ok: false, error: "Enter a cron expression." };
  const raw = expr.trim().split(/\s+/);
  if (raw.length !== 5 && raw.length !== 6) {
    return {
      ok: false,
      error: `Expected 5 fields (classic cron) or 6 fields (with seconds) — received ${raw.length}.`,
    };
  }
  const { fields, dialect } = explainCron(expr);
  try {
    const { CronExpressionParser } = await import("cron-parser");
    const interval = CronExpressionParser.parse(expr, { currentDate: new Date() });
    const count = Math.min(options.count ?? 10, 25);
    const nextRuns: string[] = [];
    for (let i = 0; i < count; i++) {
      // cron-parser v5 types toISOString() as string | null (invalid date);
      // the fallback recomputes from the underlying JS Date in that case.
      const next = interval.next();
      const iso = next.toISOString();
      nextRuns.push(iso ?? next.toDate().toISOString());
    }
    return { ok: true, dialect, explain: fields, nextRuns };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid cron expression." };
  }
}

/** Format an ISO timestamp for display, respecting the selected IANA timezone. */
export function formatRun(iso: string, timeZone?: string): string {
  try {
    const d = new Date(iso);
    const zone = timeZone && timeZone !== "UTC" ? timeZone : undefined;
    if (!zone) {
      return `${d.toISOString().replace("T", " ").slice(0, 19)} UTC`;
    }
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return fmt.format(d);
  } catch {
    return iso;
  }
}

/** Common IANA zones + the browser's own zone. */
export function suggestedTimeZones(browserZone?: string): string[] {
  const base = [
    "UTC",
    "America/New_York",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Berlin",
    "Asia/Kolkata",
    "Asia/Shanghai",
    "Asia/Tokyo",
    "Australia/Sydney",
  ];
  const others = base.filter((z) => z !== browserZone && z !== "UTC");
  if (!browserZone || browserZone === "UTC") return ["UTC", ...others];
  return [browserZone, "UTC", ...others];
}

