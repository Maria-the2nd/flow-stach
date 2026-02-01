import { NextResponse } from "next/server";
import { buildCodePenSourceUrl, parseCodePenUrl } from "@/lib/codepen-resolver";

const CACHE_CONTROL = "public, max-age=60, s-maxage=300";

type ErrorPayload = {
  error: {
    code: string;
    message: string;
  };
};

async function readPenUrl(request: Request): Promise<string | null> {
  const { searchParams } = new URL(request.url);
  const fromQuery = searchParams.get("penUrl") ?? searchParams.get("url");
  if (fromQuery) {
    return fromQuery;
  }

  if (request.method !== "POST") {
    return null;
  }

  try {
    const body = (await request.json()) as { penUrl?: string } | null;
    if (body?.penUrl) {
      return body.penUrl;
    }
  } catch {
    return null;
  }

  return null;
}

function jsonError(code: string, message: string, status: number): NextResponse<ErrorPayload> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status }
  );
}

async function handleRequest(request: Request): Promise<NextResponse> {
  const penUrl = await readPenUrl(request);
  if (!penUrl) {
    return jsonError("invalid_codepen_url", "Provide a valid CodePen URL.", 400);
  }

  const parsed = parseCodePenUrl(penUrl);
  if (!parsed) {
    return jsonError("invalid_codepen_url", "Provide a valid CodePen URL.", 400);
  }

  const sourceUrl = buildCodePenSourceUrl(parsed);

  let upstream: Response;
  try {
    upstream = await fetch(sourceUrl, {
      headers: {
        Accept: "text/javascript, text/plain;q=0.9",
      },
    });
  } catch {
    return jsonError("codepen_upstream_error", "Unable to reach CodePen.", 502);
  }

  if (!upstream.ok) {
    if (upstream.status === 403) {
      const cfMitigated = upstream.headers.get("cf-mitigated");
      const server = upstream.headers.get("server") ?? "";
      const isCloudflare = cfMitigated === "challenge" || server.toLowerCase().includes("cloudflare");
      if (isCloudflare) {
        return jsonError(
          "codepen_blocked",
          "CodePen blocked automated fetch. Try the browser fallback.",
          403
        );
      }
    }

    if ([401, 404].includes(upstream.status)) {
      return jsonError(
        "codepen_unavailable",
        "CodePen pen not found or not public.",
        404
      );
    }

    return jsonError(
      "codepen_upstream_error",
      `CodePen responded with status ${upstream.status}.`,
      502
    );
  }

  const text = await upstream.text();

  return new NextResponse(text, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": CACHE_CONTROL,
    },
  });
}

export async function GET(request: Request): Promise<NextResponse> {
  return handleRequest(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleRequest(request);
}
