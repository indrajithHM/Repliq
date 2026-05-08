export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getToken, getRules, alreadyDmed, logDm,
  savePending, getPendingByCommenter, deletePending,
  findUidByIgUserId, Rule, IgToken,
} from "@/lib/firebase";
import { sendDm, checkFollower, matchComment } from "@/lib/instagram";

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

  // Verify HMAC signature
  const sig      = req.headers.get("x-hub-signature-256") ?? "";
  const expected = "sha256=" +
    crypto.createHmac("sha256", process.env.META_APP_SECRET!)
      .update(rawBody).digest("hex");

  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return new Response("Invalid signature", { status: 401 });
    }
  } catch {
    return new Response("Signature error", { status: 401 });
  }

  const body = JSON.parse(rawBody);

  for (const entry of (body.entry ?? []) as Record<string,unknown>[]) {
    const igPageId = entry.id as string;

    // Comment events
    for (const change of (entry.changes ?? []) as { field:string; value:unknown }[]) {
      if (change.field === "comments") {
        await handleComment(change.value as CommentPayload, igPageId).catch(console.error);
      }
      if (change.field === "follow") {
        const v = change.value as { new_follower?: string; follower_id?: string };
        const followerId = v.new_follower ?? v.follower_id ?? "";
        if (followerId) await handleFollow(followerId, igPageId).catch(console.error);
      }
    }

    // Messaging-based follow notifications
    for (const msg of (entry.messaging ?? []) as { follow?: boolean; sender: { id:string } }[]) {
      if (msg.follow) {
        await handleFollow(msg.sender.id, igPageId).catch(console.error);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

/* ── Comment handler ────────────────────────────────────────────── */
interface CommentPayload {
  text?: string;
  from?: { id:string; username?:string };
  media?: { id:string };
}

async function handleComment(value: CommentPayload, igPageId: string) {
  const commentText       = value.text ?? "";
  const commenterId       = value.from?.id ?? "";
  const commenterUsername = value.from?.username ?? "unknown";
  const postId            = value.media?.id ?? "";
  if (!commenterId || !postId) return;

  const uid = await findUidByIgUserId(igPageId);
  if (!uid) return;
  const token = await getToken(uid);
  if (!token) return;

  const rules  = await getRules(uid);
  const matched = rules.find(
    r => r.active && r.postId === postId &&
         matchComment(commentText, r.matchMode, r.keywords)
  );
  if (!matched) return;

  if (await alreadyDmed(uid, commenterId, postId)) return;

  const isFollower = await checkFollower(token.access_token, token.ig_user_id, commenterId);

  if (!isFollower) {
    const followMsg =
      "Hey! 👋 Thanks for your comment. " +
      "Please follow our account first and we'll send you the message right away! 🙌";
    await safeSendDm(token, commenterId, followMsg);
    await logDm(uid, {
      commenterId, commenterUsername, postId,
      ruleId: matched.id!, sentAt: Date.now(),
      status: "sent", type: "follow_prompt",
    });
    await savePending(uid, {
      commenterId, postId, uid,
      ruleId: matched.id!,
      expiresAt: Date.now() + matched.pendingExpiry * 3_600_000,
    });
    return;
  }

  await deliverActualDm(uid, token, commenterId, commenterUsername, postId, matched);
}

/* ── Follow handler ─────────────────────────────────────────────── */
async function handleFollow(followerId: string, igPageId: string) {
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
  postId: string, rule: Rule
) {
  try {
    await safeSendDm(token, commenterId, rule.dmTemplate);
    await logDm(uid, {
      commenterId, commenterUsername, postId,
      ruleId: rule.id!, sentAt: Date.now(),
      status: "sent", type: "actual",
    });
    if (rule.nudgeEnabled && rule.nudgeMessage) {
      await delay((rule.nudgeDelay ?? 3) * 1000);
      await safeSendDm(token, commenterId, rule.nudgeMessage);
    }
  } catch {
    await logDm(uid, {
      commenterId, commenterUsername, postId,
      ruleId: rule.id!, sentAt: Date.now(),
      status: "failed", type: "actual",
    });
  }
}

/* ── Helpers ─────────────────────────────────────────────────────── */
async function safeSendDm(token: IgToken, recipientId: string, message: string) {
  await sendDm(token.access_token, token.ig_user_id, recipientId, message);
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
