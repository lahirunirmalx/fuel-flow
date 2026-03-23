/**
 * GET /.netlify/functions/status — work-day status (legacy should-I-work-today API).
 * Query: sector (required), isEssential (optional, required for government), dayIndex (optional, 0–6).
 */
import { calculateWorkStatus } from "./lib/workStatus.mjs";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const sector = url.searchParams.get("sector");

  if (!sector || (sector !== "government" && sector !== "private")) {
    return jsonResponse(
      { error: "Invalid sector. Must be 'government' or 'private'." },
      400
    );
  }

  let dayIdx = url.searchParams.has("dayIndex")
    ? parseInt(url.searchParams.get("dayIndex"), 10)
    : new Date().getDay();

  if (Number.isNaN(dayIdx) || dayIdx < 0 || dayIdx > 6) {
    return jsonResponse(
      { error: "Invalid dayIndex. Must be between 0 and 6 (Sun–Sat)." },
      400
    );
  }

  const ie = url.searchParams.get("isEssential");
  const essential = ie === "true" ? true : ie === "false" ? false : null;

  const result = calculateWorkStatus(sector, essential, dayIdx);
  if (!result) {
    return jsonResponse(
      {
        error:
          "Could not calculate status. For sector=government, pass isEssential=true or isEssential=false.",
      },
      400
    );
  }

  return jsonResponse(result);
};
