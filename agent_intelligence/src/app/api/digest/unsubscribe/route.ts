// One-click digest unsubscribe (the {{{unsubscribe_url}}} target). GET so it
// works from any mail client; the link carries an HMAC token so it can't be
// forged for another user. Idempotent — clicking twice is fine. Returns a
// tiny standalone HTML page (no app chrome; the visitor may not be signed in).

import { NextRequest, NextResponse } from "next/server";

import { isDigestDbConfigured, markUnsubscribed, verifyUnsubscribeToken } from "@/lib/digestDb";

export const dynamic = "force-dynamic";

function page(title: string, body: string, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<body style="margin:0;background:#F7F8FB;font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#14142B;">
<div style="max-width:460px;margin:80px auto;padding:0 18px;">
  <div style="background:#fff;border:1px solid #E5E8F0;border-radius:14px;padding:28px 30px;box-shadow:0 2px 8px rgba(20,20,43,.05);">
    <div style="font-weight:700;font-size:15px;margin-bottom:10px;">AgencyMan<span style="color:#C42127;">.ai</span></div>
    <h1 style="font-size:20px;margin:0 0 10px;">${title}</h1>
    <p style="font-size:14px;color:#4A4E63;margin:0;line-height:1.55;">${body}</p>
  </div>
</div>
</body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("u") ?? "";
  const token = req.nextUrl.searchParams.get("t") ?? "";

  if (!isDigestDbConfigured()) {
    return page("Something went wrong", "Please try again later.", 503);
  }
  if (!userId || !verifyUnsubscribeToken(userId, token)) {
    return page(
      "That link didn't work",
      "This unsubscribe link is invalid or incomplete. Try the link at the bottom of your most recent digest email.",
      400,
    );
  }
  await markUnsubscribed(userId);
  return page(
    "You're unsubscribed",
    "You won't receive the monthly digest anymore. Your account and dashboard are unaffected — you can keep using AgencyMan as usual.",
  );
}
