import { NextRequest, NextResponse } from "next/server";

import { BRANDS } from "@/lib/constants";
import { getDataAsOf } from "@/lib/db";
import { CaptiveProfile, IndependentProfile } from "@/lib/filings";
import { getPositioning } from "@/lib/positioning";

export const dynamic = "force-dynamic";

const BRAND_SET = new Set<string>(BRANDS);

function bad(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

// GET /api/positioning — same profile params as /api/filings. Returns the
// computed Rate Positioning result (anchored cells + comparisons + totals).
export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = req.nextUrl.searchParams;
  const agent_type = q.get("agent_type");
  const states = (q.get("licensed_states") ?? "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const authorized = (q.get("authorized_brands") ?? "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const captive_brand = q.get("captive_brand") ?? undefined;

  if (agent_type !== "captive" && agent_type !== "independent") return bad("invalid agent_type");
  if (states.length === 0) return bad("licensed_states is required");
  if (authorized.length === 0 || authorized.some(b => !BRAND_SET.has(b))) {
    return bad("authorized_brands must be a non-empty subset of BRANDS");
  }
  if (agent_type === "captive") {
    if (!captive_brand || !BRAND_SET.has(captive_brand)) {
      return bad("captive_brand is required for captive agent_type");
    }
    if (authorized.length !== 1 || authorized[0] !== captive_brand) {
      return bad("captive agents must have authorized_brands = [captive_brand]");
    }
  }

  const profile =
    agent_type === "captive"
      ? ({
          agent_type: "captive",
          captive_brand: captive_brand!,
          authorized_brands: authorized,
          licensed_states: states,
        } as CaptiveProfile)
      : ({
          agent_type: "independent",
          authorized_brands: authorized,
          licensed_states: states,
        } as IndependentProfile);

  const result = getPositioning(profile);
  return NextResponse.json({ asOf: getDataAsOf(), result });
}
