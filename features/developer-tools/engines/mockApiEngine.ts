/**
 * API Response Mock Generator — static, realistic mock JSON produced locally.
 * No network requests are ever made; payloads are generated fixtures.
 */

export type MockScenario = "success" | "paginated" | "unauthorized" | "not-found" | "validation" | "server-error";

export interface MockOptions {
  scenario: MockScenario;
  resource: string;
  count: number;
  includeTimestamps: boolean;
}

const ID_POOL = ["usr", "ord", "prj", "msg", "inv"];

function id(prefix: string, n: number): string {
  return `${prefix}_${String(n).padStart(6, "0")}`;
}

const FIRST_NAMES = ["Ada", "Grace", "Alan", "Linus", "Margaret", "Barbara", "Dennis", "Katherine"];
const LAST_NAMES = ["Lovelace", "Hopper", "Turing", "Torvalds", "Hamilton", "Liskov", "Ritchie", "Johnson"];

function person(n: number) {
  const first = FIRST_NAMES[n % FIRST_NAMES.length];
  const last = LAST_NAMES[(n * 3) % LAST_NAMES.length];
  return {
    id: id(ID_POOL[n % ID_POOL.length], n + 1),
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    role: n % 3 === 0 ? "engineer" : n % 3 === 1 ? "designer" : "manager",
    active: n % 4 !== 0,
  };
}

export function generateMock(options: MockOptions): Record<string, unknown> {
  const { scenario, resource, count, includeTimestamps } = options;
  const countClamped = Math.max(1, Math.min(count, 20));
  const collection = resource.trim().length > 0 ? resource.trim().toLowerCase().replace(/\s+/g, "_") : "items";
  const ts = includeTimestamps ? new Date().toISOString() : undefined;

  switch (scenario) {
    case "success": {
      const item = person(0);
      return ts
        ? { code: 200, message: "OK", result: { ...item }, generated_at: ts }
        : { code: 200, message: "OK", result: { ...item } };
    }
    case "paginated": {
      const items = Array.from({ length: countClamped }, (_, i) => person(i + 1));
      const body: Record<string, unknown> = {
        code: 200,
        message: "OK",
        page: 1,
        per_page: countClamped,
        total: countClamped * 7,
        total_pages: 7,
        results: items,
      };
      if (ts) body.generated_at = ts;
      return body;
    }
    case "unauthorized":
      return {
        code: 401,
        message: "Unauthorized",
        errors: [{ field: "Authorization", issue: "Missing or invalid bearer token." }],
      };
    case "not-found":
      return {
        code: 404,
        message: "Not Found",
        errors: [{ field: "resource", issue: `Requested ${collection} resource does not exist.` }],
      };
    case "validation":
      return {
        code: 422,
        message: "Validation Failed",
        errors: [
          { field: "email", issue: "must be a valid email address" },
          { field: collection === "users" ? "name" : "title", issue: "is required and cannot be blank" },
        ],
      };
    case "server-error":
      return {
        code: 500,
        message: "Internal Server Error",
        error_id: `srv_${Math.floor(Date.now() / 1000) % 1000000}`,
        errors: [{ field: null, issue: "An unexpected condition prevented the request from completing." }],
      };
  }
}

export const MOCK_SCENARIOS: { value: MockScenario; label: string; status: number }[] = [
  { value: "success", label: "Success (200)", status: 200 },
  { value: "paginated", label: "Paginated List (200)", status: 200 },
  { value: "unauthorized", label: "Unauthorized (401)", status: 401 },
  { value: "not-found", label: "Not Found (404)", status: 404 },
  { value: "validation", label: "Validation Error (422)", status: 422 },
  { value: "server-error", label: "Server Error (500)", status: 500 },
];
