// Approve/discard a staged digest run (form POST from /api/digest/review).
// On approve: send exactly the stored HTML to each resolved recipient and
// persist digest_state (last_sent + the compliance snapshot captured at
// stage time). Items without an email are skipped and reported. Idempotent:
// a run that isn't in 'staged' status refuses to send again.

import { NextRequest, NextResponse } from "next/server";

import { getRun, markRun, recordSend, verifyRunToken } from "@/lib/digestDb";
import { sendEmail } from "@/lib/resendSend";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function page(title: string, body: string, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<body style="margin:0;background:#F7F8FB;font-family:'Segoe UI',system-ui,sans-serif;color:#14142B;">
<div style="max-width:520px;margin:80px auto;padding:0 18px;">
  <div style="background:#fff;border:1px solid #E5E8F0;border-radius:14px;padding:28px 30px;box-shadow:0 2px 8px rgba(20,20,43,.05);">
    <h1 style="font-size:20px;margin:0 0 10px;">${title}</h1>
    <div style="font-size:14px;color:#4A4E63;line-height:1.55;">${body}</div>
  </div>
</div>
</body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const runDate = String(form.get("run") ?? "");
  const token = String(form.get("t") ?? "");
  const action = String(form.get("action") ?? "");

  if (!verifyRunToken(runDate, token)) {
    return page("Invalid link", "This approval link is invalid.", 401);
  }
  const run = await getRun(runDate);
  if (!run) return page("Not found", `No staged run for ${runDate}.`, 404);
  if (run.status !== "staged") {
    return page("Already resolved", `This batch was already ${run.status}. Nothing was sent now.`);
  }

  if (action === "discard") {
    await markRun(runDate, "discarded");
    return page("Batch discarded", "Nothing was sent. Re-run staging to build a fresh batch.");
  }
  if (action !== "send") return page("Unknown action", "Use the buttons on the review page.", 400);

  let sent = 0, failed = 0, skipped = 0;
  const failures: string[] = [];
  for (const it of run.items) {
    if (!it.email) { skipped++; continue; }
    const err = await sendEmail(it.email, it.subject, it.html);
    if (err) { failed++; failures.push(`${it.email}: ${err}`); continue; }
    await recordSend(it.user_id, runDate, it.snapshot);
    sent++;
  }
  // 'sent' even with partial failures — recordSend ran per success, so a
  // re-stage next run rebuilds only what makes sense; never double-send by
  // re-approving the same batch.
  await markRun(runDate, "sent");
  return page(
    "Digest sent",
    `<b>${sent}</b> sent · ${skipped} skipped (no email) · ${failed} failed.` +
      (failures.length ? `<br><br><span style="font-size:12px;color:#8A1B1F;">${failures.slice(0, 5).join("<br>")}</span>` : ""),
  );
}
