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
  } catch {
    return NextResponse.json(
      { ok: false, reason: "llm_error" } satisfies SemanticResponsePayload,
      { status: 500 }
    );
  }
}
