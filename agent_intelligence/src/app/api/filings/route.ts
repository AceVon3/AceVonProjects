import { NextRequest, NextResponse } from "next/server";

import { BRANDS, WindowKey } from "@/lib/constants";
import { getDataAsOf } from "@/lib/db";
import {
  CaptiveProfile,
  IndependentProfile,
  QueryOpts,
  getDefendFilings,
  getMyCarriersFilings,
  getProspectFilings,
} from "@/lib/filings";

export const dynamic = "force-dynamic";

const VALID_MODES = new Set(["prospect", "defend", "my-carriers"]);
const VALID_WINDOWS = new Set<WindowKey>(["30d", "90d", "12m"]);
const BRAND_SET = new Set<string>(BRANDS);

function bad(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = req.nextUrl.searchParams;
  const mode = q.get("mode");
  const agent_type = q.get("agent_type");
  const states = (q.get("licensed_states") ?? "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const authorized = (q.get("authorized_brands") ?? "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const captive_brand = q.get("captive_brand") ?? undefined;

  if (!mode || !VALID_MODES.has(mode)) return bad("invalid mode");
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
  // (my-carriers is available to both agent types — a captive sees filings
  // for their single authorized brand. No agent_type restriction here.)

  const windowRaw = q.get("window");
  let opts: QueryOpts | undefined;
  if (windowRaw) {
    if (!VALID_WINDOWS.has(windowRaw as WindowKey)) return bad("invalid window");
    opts = { window: windowRaw as WindowKey };
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

  let filings;
  if (mode === "prospect") filings = getProspectFilings(profile, opts);
  else if (mode === "defend") filings = getDefendFilings(profile, opts);
  else filings = getMyCarriersFilings(profile, opts);

  return NextResponse.json({ asOf: getDataAsOf(), filings });
}
