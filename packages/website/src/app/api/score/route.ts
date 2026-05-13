import { calculateScore, getScoreLabel, type ScoreDiagnostic } from "react-doctor-v2/score";

const MAX_REQUEST_BODY_BYTES = 1_000_000;
const MAX_DIAGNOSTICS_PER_REQUEST = 50_000;

interface DiagnosticInput extends ScoreDiagnostic {
  message: string;
  help: string;
  line: number;
  column: number;
  category: string;
}

const isValidDiagnostic = (value: unknown): value is DiagnosticInput => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.plugin === "string" &&
    typeof record.rule === "string" &&
    (record.severity === "error" || record.severity === "warning") &&
    typeof record.message === "string" &&
    typeof record.help === "string" &&
    typeof record.line === "number" &&
    typeof record.column === "number" &&
    typeof record.category === "string"
  );
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const OPTIONS = (): Response => new Response(null, { status: 204, headers: CORS_HEADERS });

const respondError = (status: number, message: string): Response =>
  Response.json({ error: message }, { status, headers: CORS_HEADERS });

export const POST = async (request: Request): Promise<Response> => {
  // used for rate limiting bad actors
  const ip = (request as any).ip || request.headers.get("x-forwarded-for") || "unknown";
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_REQUEST_BODY_BYTES) {
    return respondError(413, "Request body exceeds 1MB");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  if (
    !body ||
    typeof body !== "object" ||
    !Array.isArray((body as { diagnostics: unknown }).diagnostics)
  ) {
    return respondError(400, "Request body must contain a 'diagnostics' array");
  }

  const diagnostics = (body as { diagnostics: unknown[] }).diagnostics;
  if (diagnostics.length > MAX_DIAGNOSTICS_PER_REQUEST) {
    return respondError(413, "Too many diagnostics in a single request");
  }

  const isValidPayload = diagnostics.every((entry: unknown) => isValidDiagnostic(entry));

  if (!isValidPayload) {
    return respondError(
      400,
      "Each diagnostic must have 'plugin', 'rule', 'severity', 'message', 'help', 'line', 'column', and 'category'",
    );
  }

  const score = calculateScore(diagnostics as DiagnosticInput[]);

  console.log({ ip, score }, diagnostics);

  return Response.json({ score, label: getScoreLabel(score) }, { headers: CORS_HEADERS });
};
