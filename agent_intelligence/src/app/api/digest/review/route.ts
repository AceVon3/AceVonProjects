// Digest review page (review-before-send). Renders EVERY staged email for a
// run — each in a sandboxed iframe via srcdoc, exactly the HTML that will be
// sent — with Approve-and-send / Discard controls posting to
// /api/digest/approve. Link-token auth (HMAC over the run date), same trust
// model as the unsubscribe link: the emailed link IS the credential.

import { NextRequest, NextResponse } from "next/server";

import { getRun, verifyRunToken } from "@/lib/digestDb";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

export async function GET(req: NextRequest) {
  const runDate = req.nextUrl.searchParams.get("run") ?? "";
  const token = req.nextUrl.searchParams.get("t") ?? "";
  if (!verifyRunToken(runDate, token)) {
    return new NextResponse("Invalid or expired review link.", { status: 401 });
  }
  const run = await getRun(runDate);
  if (!run) {
    return new NextResponse(`No staged run for ${esc(runDate)}.`, { status: 404 });
  }

  const sendable = run.items.filter(i => i.email).length;
  const banner =
    run.status === "staged"
      ? `<form method="POST" action="/api/digest/approve" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
           <input type="hidden" name="run" value="${esc(runDate)}"><input type="hidden" name="t" value="${esc(token)}">
           <button name="action" value="send" style="background:#C42127;color:#fff;border:none;border-radius:10px;padding:10px 22px;font:600 14px 'Segoe UI',sans-serif;cursor:pointer;">
             Approve &amp; send ${sendable} email${sendable === 1 ? "" : "s"}
           </button>
           <button name="action" value="discard" style="background:#F1F2F7;color:#4A4E63;border:1px solid #DDE1EA;border-radius:10px;padding:10px 18px;font:600 13px 'Segoe UI',sans-serif;cursor:pointer;">
             Discard batch
           </button>
           <span style="font-size:12px;color:#6B7080;">Nothing has been sent yet.</span>
         </form>`
      : `<div style="font:600 14px 'Segoe UI',sans-serif;color:${run.status === "sent" ? "#1B7F4B" : "#8A5A10"};">
           This batch was already ${run.status === "sent" ? "approved and sent" : "discarded"}.
         </div>`;

  const cards = run.items.map((it, n) => `
    <div style="background:#fff;border:1px solid #E5E8F0;border-radius:14px;margin:18px 0;overflow:hidden;">
      <div style="padding:12px 18px;border-bottom:1px solid #EDEFF4;display:flex;gap:14px;flex-wrap:wrap;align-items:baseline;font:12.5px 'Segoe UI',sans-serif;">
        <b>${n + 1}. ${esc(it.email ?? "NO EMAIL — will be skipped")}</b>
        <span style="color:#6B7080;">${esc(it.subject)}</span>
        <span style="margin-left:auto;color:#9AA0B0;">${it.counts.mine} own · ${it.counts.competitors} comp · ${it.counts.hrStates} HR</span>
      </div>
      <iframe sandbox="" srcdoc="${esc(it.html)}" style="width:100%;height:640px;border:0;display:block;background:#fff;" loading="lazy"></iframe>
    </div>`).join("");

  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Digest review — ${esc(runDate)}</title>
<body style="margin:0;background:#F7F8FB;color:#14142B;font-family:'Segoe UI',system-ui,sans-serif;">
<div style="max-width:760px;margin:0 auto;padding:26px 16px 60px;">
  <h1 style="font-size:20px;margin:0 0 4px;">Digest review — ${esc(runDate)}</h1>
  <p style="font-size:13px;color:#6B7080;margin:0 0 16px;">
    ${run.items.length} staged · ${sendable} sendable · ${run.items.length - sendable} missing an email address.
    Each frame below is the exact email that recipient will receive.
  </p>
  <div style="position:sticky;top:0;background:#F7F8FB;padding:10px 0;border-bottom:1px solid #E5E8F0;z-index:5;">${banner}</div>
  ${cards}
</div>
</body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
