import { NextResponse } from "next/server";
import {
  type FlowbridgeSemanticPatchRequest,
  type FlowbridgeSemanticPatchResponse,
  type FlowbridgeSemanticPatchMeta,
} from "@/lib/flowbridge-semantic";
import { requestFlowbridgeSemanticPatch } from "@/lib/flowbridge-llm";

type SemanticRequestPayload = {
  request: FlowbridgeSemanticPatchRequest;
  model?: string;
};

type SemanticResponsePayload =
  | {
      ok: true;
      response: FlowbridgeSemanticPatchResponse;
      meta: FlowbridgeSemanticPatchMeta;
    }
  | {
      ok: false;
      reason: string;
      meta?: FlowbridgeSemanticPatchMeta;
    };

export async function POST(request: Request) {
  let body: SemanticRequestPayload;
  try {
    body = (await request.json()) as SemanticRequestPayload;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  if (!body?.request) {
    return NextResponse.json({ ok: false, reason: "missing_request" }, { status: 400 });
  }

  const req = body.request;
  const errors: string[] = [];

  const arrayFields = ["domOutline", "components", "warnings", "componentHtml", "componentFullHtml"] as const;
  for (const field of arrayFields) {
    if (!Array.isArray(req[field])) errors.push(`${field} must be an array`);
  }
  if (typeof req.tokens !== "object" || req.tokens === null) errors.push("tokens must be an object");
  if (typeof req.fullHtml !== "string") errors.push("fullHtml must be a string");

  if (errors.length > 0) {
    return NextResponse.json(
      { ok: false, reason: "invalid_request_structure", details: errors },
      { status: 400 }
    );
  }

  try {
    const result = await requestFlowbridgeSemanticPatch(body.request, {
      model: body.model,
    });

    if (!result.patch) {
      return NextResponse.json(
        {
          ok: false,
          reason: result.meta.reason || "llm_unavailable",
          meta: result.meta,
        } satisfies SemanticResponsePayload,
        { status: 200 }
      );
    }

    return NextResponse.json(
      { ok: true, response: result.patch, meta: result.meta } satisfies SemanticResponsePayload,
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[flowbridge/semantic] LLM error:", message);
    return NextResponse.json(
      { ok: false, reason: "llm_error", details: message },
      { status: 500 }
    );
  }
}
