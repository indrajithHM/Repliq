export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getToken, getRules, alreadyDmed, logDm,
  savePending, getPendingByCommenter, deletePending,
  findUidByIgUserId, Rule, IgToken,
} from "@/lib/firebase";
import { sendDm, matchComment, replyToComment } from "@/lib/instagram";

/* ── GET: webhook verification ─────────────────────────────────── */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/* ── POST: incoming events ──────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  console.log("→ Webhook received:", rawBody.slice(0, 300));

  const sig      = req.headers.get("x-hub-signature-256") ?? "";
  const expected = "sha256=" +
    crypto.createHmac("sha256", process.env.META_APP_SECRET!)
      .update(rawBody).digest("hex");

  console.log("→ Sig received:", sig.slice(0, 30));
  console.log("→ Sig expected:", expected.slice(0, 30));

  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      console.log("→ SIGNATURE MISMATCH");
      return new Response("Invalid signature", { status: 401 });
    }
  } catch (e) {
    console.log("→ Signature error:", e);
    return new Response("Signature error", { status: 401 });
  }

  const body = JSON.parse(rawBody);
  console.log("→ Parsed body:", JSON.stringify(body, null, 2));

  for (const entry of (body.entry ?? []) as Record<string, unknown>[]) {
    const igPageId = entry.id as string;
    console.log("→ Entry igPageId:", igPageId);

    for (const change of (entry.changes ?? []) as { field: string; value: unknown }[]) {
      console.log("→ Change field:", change.field, "value:", JSON.stringify(change.value));
      if (change.field === "comments") {
        await handleComment(change.value as CommentPayload, igPageId).catch(e => {
          console.error("→ handleComment error:", e);
        });
      }
      if (change.field === "follow") {
        const v = change.value as { new_follower?: string; follower_id?: string };
        const followerId = v.new_follower ?? v.follower_id ?? "";
        if (followerId) await handleFollow(followerId, igPageId).catch(e => {
          console.error("→ handleFollow error:", e);
        });
      }
    }

    for (const msg of (entry.messaging ?? []) as { follow?: boolean; sender: { id: string } }[]) {
      if (msg.follow) {
        await handleFollow(msg.sender.id, igPageId).catch(console.error);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

/* ── Comment handler ────────────────────────────────────────────── */
interface CommentPayload {
  id?:        string;
  text?:      string;
  from?:      { id: string; username?: string };
  media?:     { id: string };
  parent_id?: string;
}

async function handleComment(value: CommentPayload, igPageId: string) {
  const commentText       = value.text ?? "";
  const commenterId       = value.from?.id ?? "";
  const commenterUsername = value.from?.username ?? "unknown";
  const postId            = value.media?.id ?? "";
  const commentId         = value.id ?? "";

  console.log("→ handleComment:", { commentText, commenterId, postId, igPageId });

  if (value.parent_id) {
    console.log("→ Skipping reply comment (has parent_id)");
    return;
  }

  if (!commenterId || !postId) {
    console.log("→ Missing commenterId or postId, skipping");
    return;
  }

  const uid = await findUidByIgUserId(igPageId);
  console.log("→ Found uid:", uid);
  if (!uid) return;

  const token = await getToken(uid);
  console.log("→ Token exists:", !!token, "ig_user_id:", token?.ig_user_id);
  if (!token) return;

  if (commenterId === igPageId || commenterId === token.ig_user_id) {
    console.log("→ Skipping own comment");
    return;
  }

  const rules = await getRules(uid);
  console.log("→ Rules count:", rules.length);

  const matched = rules.find(
    r => r.active && r.postId === postId &&
         matchComment(commentText, r.matchMode, r.keywords ?? [])
  );
  console.log("→ Matched rule:", matched?.id ?? "none");
  if (!matched) return;

  const alreadySent = await alreadyDmed(uid, commenterId, postId);
  console.log("→ Already DMed:", alreadySent);
  if (alreadySent) return;

  await deliverActualDm(uid, token, commenterId, commenterUsername, postId, matched, commentId);
}

/* ── Follow handler ─────────────────────────────────────────────── */
async function handleFollow(followerId: string, igPageId: string) {
  console.log("→ handleFollow:", { followerId, igPageId });
  const uid = await findUidByIgUserId(igPageId);
  if (!uid) return;
  const token = await getToken(uid);
  if (!token) return;
  const pending = await getPendingByCommenter(uid, followerId);
  if (!pending) return;
  const rules = await getRules(uid);
  const rule  = rules.find(r => r.id === pending.ruleId);
  if (!rule) return;
  await deliverActualDm(uid, token, followerId, "user", pending.postId, rule);
  await deletePending(uid, pending.id!);
}

/* ── Deliver actual DM + nudge ──────────────────────────────────── */
async function deliverActualDm(
  uid: string, token: IgToken,
  commenterId: string, commenterUsername: string,
  postId: string, rule: Rule, commentId?: string
) {
  if (rule.replyEnabled && rule.replyTemplate && commentId) {
    try {
      await replyToComment(token.access_token, commentId, rule.replyTemplate);
      console.log("→ Comment reply sent");
    } catch (e) {
      console.error("→ Comment reply failed:", e);
    }
  }

  console.log("→ deliverActualDm to:", commenterId, "rule:", rule.id);
  try {
    // FIX: Send via comment_id if triggered by a comment to satisfy Meta's private reply rule.
    const recipient = commentId ? { comment_id: commentId } : { id: commenterId };

    await safeSendDm(token, recipient, rule.dmTemplate);
    console.log("→ DM sent successfully");
    await logDm(uid, {
      commenterId, commenterUsername, postId,
      ruleId: rule.id!, sentAt: Date.now(),
      status: "sent", type: "actual",
    });

    // NOTE: If the user hasn't explicitly responded to the DM yet, this nudge message will fail.
    // Meta allows exactly ONE message per comment tracking instance until a mutual thread opens.
    if (rule.nudgeEnabled && rule.nudgeMessage) {
      await delay((rule.nudgeDelay ?? 3) * 1000);
      await safeSendDm(token, recipient, rule.nudgeMessage);
      console.log("→ Nudge sent successfully");
    }
  } catch (e) {
    console.error("→ DM failed:", e);
    await logDm(uid, {
      commenterId, commenterUsername, postId,
      ruleId: rule.id!, sentAt: Date.now(),
      status: "failed", type: "actual",
    });
  }
}

/* ── Helpers ─────────────────────────────────────────────────────── */
// UPDATED: Signature updated to accept the unified structured object
async function safeSendDm(token: IgToken, recipient: { id?: string; comment_id?: string }, message: string) {
  console.log("→ safeSendDm to:", recipient, "message:", message.slice(0, 50));
  await sendDm(token.access_token, token.ig_user_id, recipient, message);
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));