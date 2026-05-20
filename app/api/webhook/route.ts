export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getToken, getRules, alreadyDmed, logDm,
  savePending, getPendingByCommenter, deletePending, updatePendingState,
  findUidByIgUserId, Rule, IgToken, PendingEntry,
} from "@/lib/firebase";
import { sendDm, matchComment, replyToComment, checkFollower, DMButton } from "@/lib/instagram";

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

    for (const change of (entry.changes ?? []) as { field: string; value: unknown }[]) {
      console.log("→ Change field:", change.field);
      if (change.field === "comments") {
        await handleComment(change.value as CommentPayload, igPageId).catch(e =>
          console.error("→ handleComment error:", e)
        );
      }
      if (change.field === "follow") {
        const v = change.value as { new_follower?: string; follower_id?: string };
        const followerId = v.new_follower ?? v.follower_id ?? "";
        if (followerId) await handleFollow(followerId, igPageId).catch(e =>
          console.error("→ handleFollow error:", e)
        );
      }
    }

    for (const msg of (entry.messaging ?? []) as MessagingEvent[]) {
      if (msg.message?.quick_reply?.payload) {
        await handleQuickReply(msg, igPageId).catch(console.error);
      }
      if (msg.follow) {
        await handleFollow(msg.sender.id, igPageId).catch(console.error);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

/* ── Types ───────────────────────────────────────────────────────── */
interface CommentPayload {
  id?:        string;
  text?:      string;
  from?:      { id: string; username?: string };
  media?:     { id: string };
  parent_id?: string;
}

interface MessagingEvent {
  sender:     { id: string };
  recipient?: { id: string };
  message?:   {
    text?:        string;
    quick_reply?: { payload: string };
  };
  follow?: boolean;
}

/* ── Comment handler ────────────────────────────────────────────── */
async function handleComment(value: CommentPayload, igPageId: string) {
  const commentText       = value.text ?? "";
  const commenterId       = value.from?.id ?? "";
  const commenterUsername = value.from?.username ?? "unknown";
  const postId            = value.media?.id ?? "";
  const commentId         = value.id ?? "";

  console.log("→ handleComment:", { commentText, commenterId, postId, commentId });

  if (value.parent_id) { console.log("→ Skipping reply"); return; }
  if (!commenterId || !postId) { console.log("→ Missing fields"); return; }

  const uid = await findUidByIgUserId(igPageId);
  if (!uid) return;

  const token = await getToken(uid);
  if (!token) return;

  if (commenterId === igPageId || commenterId === token.ig_user_id) {
    console.log("→ Skipping own comment");
    return;
  }

  const rules = await getRules(uid);
  const matched = rules.find(
    r => r.active && r.postId === postId &&
         matchComment(commentText, r.matchMode, r.keywords ?? [])
  );
  console.log("→ Matched rule:", matched?.id ?? "none");
  if (!matched) return;

  const alreadySent = await alreadyDmed(uid, commenterId, postId);
  if (alreadySent) { console.log("→ Already DMed, skipping"); return; }

  // Save pending with commentId stored — needed for reply if user comes back later
  await savePending(uid, {
    uid,
    commenterId,
    commenterUsername,
    postId,
    commentId,
    ruleId: matched.id!,
    state: "awaiting_link_request",
    savedAt: Date.now(),
    expiresAt: Date.now() + (matched.pendingExpiry ?? 48) * 60 * 60 * 1000,
  });

  // Reply to the comment publicly (if enabled on the rule)
  if (matched.replyEnabled && matched.replyTemplate && commentId) {
    try {
      await replyToComment(token.access_token, commentId, matched.replyTemplate);
      console.log("→ Comment reply sent");
    } catch (e) {
      console.error("→ Comment reply failed:", e);
    }
  }

  // IMPORTANT: Use { comment_id } as recipient — this is the only way to
  // initiate a DM to someone who hasn't messaged you first.
  // Using { id: commenterId } here causes "outside of allowed window" error.
  const engagementText =
    `Hey! Thanks for your interest 😊\nTap below and I'll send you the link ✨`;

  try {
    await safeSendDm(
      token,
      { comment_id: commentId },
      engagementText,
      [
        {
          type: "quick_reply" as const,
          label: "Send me the link 🔗",
          payload: `SEND_LINK:${matched.id}`,
        },
      ],
    );
    console.log("→ Engagement DM sent via comment_id");
    await logDm(uid, {
      commenterId, commenterUsername, postId,
      postUrl: matched.postUrl ?? "",
      postShortcode: shortcodeFrom(matched.postUrl),
      ruleId: matched.id!, sentAt: Date.now(),
      status: "sent", type: "engagement",
    });
  } catch (e) {
    console.error("→ Engagement DM failed:", e);
    await logDm(uid, {
      commenterId, commenterUsername, postId,
      postUrl: matched.postUrl ?? "",
      postShortcode: shortcodeFrom(matched.postUrl),
      ruleId: matched.id!, sentAt: Date.now(),
      status: "failed", type: "engagement",
    });
  }
}

/* ── Quick Reply handler ────────────────────────────────────────── */
async function handleQuickReply(msg: MessagingEvent, igPageId: string) {
  const senderId = msg.sender.id;
  const payload  = msg.message?.quick_reply?.payload ?? "";
  console.log("→ handleQuickReply:", { senderId, payload });

  const uid = await findUidByIgUserId(igPageId);
  if (!uid) return;
  const token = await getToken(uid);
  if (!token) return;

  const pending = await getPendingByCommenter(uid, senderId);
  if (!pending) { console.log("→ No pending entry for sender"); return; }
  console.log("→ Pending entry:", { ruleId: pending.ruleId, state: pending.state, postId: pending.postId });

  const rules = await getRules(uid);
  console.log("→ Available rule IDs:", rules.map(r => r.id));
  const rule  = rules.find(r => r.id === pending.ruleId);
  if (!rule) {
    console.log("→ Rule not found. Payload ruleId:", payload.split(":")[1], "Pending ruleId:", pending.ruleId);
    return;
  }

  /* ── "Send me the link" tapped ── */
  if (payload.startsWith("SEND_LINK:")) {
    // Use ruleId from payload — pending.ruleId may be stale if rule was recreated
    const ruleId = payload.slice("SEND_LINK:".length);
    console.log("→ SEND_LINK ruleId:", ruleId);

    // Find rule from payload id, fall back to pending.ruleId
    const activeRule = rules.find(r => r.id === ruleId) ?? rule;
    if (!activeRule) { console.log("→ No rule found for payload or pending"); return; }

    let isFollower = false;
    try {
      isFollower = await checkFollower(token.access_token, token.ig_user_id, senderId);
    } catch (e) {
      console.error("→ checkFollower error:", e);
    }
    console.log("→ Is follower:", isFollower);

    if (isFollower) {
      await deliverActualDm(uid, token, senderId, pending.commenterUsername, pending.postId, activeRule);
      await deletePending(uid, pending.id!);
    } else {
      await updatePendingState(uid, pending.id!, "awaiting_follow_confirm");
      await sendFollowGateDm(token, senderId, activeRule);
      await logDm(uid, {
        commenterId: senderId,
        commenterUsername: pending.commenterUsername,
        postId: pending.postId,
        postUrl: activeRule.postUrl ?? "",
        postShortcode: shortcodeFrom(activeRule.postUrl),
        ruleId: activeRule.id!, sentAt: Date.now(),
        status: "sent", type: "follow_gate",
      });
    }
  }

  /* ── "I'm following" tapped ── */
  if (payload.startsWith("FOLLOW_CONFIRM:")) {
    const ruleId = payload.slice("FOLLOW_CONFIRM:".length);
    console.log("→ FOLLOW_CONFIRM ruleId:", ruleId);
    // Use payload ruleId — more reliable than pending.ruleId

    const confirmRule = rules.find(r => r.id === ruleId) ?? rule;
    if (!confirmRule) { console.log("→ No rule found for FOLLOW_CONFIRM"); return; }

    let isFollower = false;
    try {
      isFollower = await checkFollower(token.access_token, token.ig_user_id, senderId);
    } catch (e) {
      console.error("→ checkFollower error:", e);
    }
    console.log("→ Follow confirm check:", isFollower);

    if (isFollower) {
      await deliverActualDm(uid, token, senderId, pending.commenterUsername, pending.postId, confirmRule);
      await deletePending(uid, pending.id!);
    } else {
      // Reprompt
      await safeSendDm(
        token,
        { id: senderId },
        `You're still not following @${token.ig_username} 🙏\nPlease follow and tap the button again!`,
        [
          { type: "url" as const,          label: `Follow @${token.ig_username}`, url: `https://www.instagram.com/${token.ig_username}/` },
          { type: "quick_reply" as const,   label: "I'm following ✅",             payload: `FOLLOW_CONFIRM:${confirmRule.id}` },
        ],
      );
      console.log("→ Reprompt sent");
    }
  }
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

  // Only auto-deliver if they're in follow_gate state
  // (awaiting_link_request = they haven't tapped the button yet)
  if (pending.state === "awaiting_follow_confirm") {
    const rules = await getRules(uid);
    const rule  = rules.find(r => r.id === pending.ruleId);
    if (!rule) return;
    await deliverActualDm(uid, token, followerId, pending.commenterUsername, pending.postId, rule);
    await deletePending(uid, pending.id!);
  }
}

/* ── Deliver actual DM + nudge ──────────────────────────────────── */
async function deliverActualDm(
  uid: string, token: IgToken,
  commenterId: string, commenterUsername: string,
  postId: string, rule: Rule,
  commentId?: string,
) {
  if (rule.replyEnabled && rule.replyTemplate && commentId) {
    try {
      await replyToComment(token.access_token, commentId, rule.replyTemplate);
      console.log("→ Comment reply sent");
    } catch (e) {
      console.error("→ Comment reply failed:", e);
    }
  }

  const buttons: DMButton[] = [];
  if (rule.ctaEnabled && rule.ctaLabel && rule.ctaUrl) {
    buttons.push({ type: "url", label: rule.ctaLabel, url: rule.ctaUrl });
  }

  try {
    await safeSendDm(
      token,
      { id: commenterId },
      rule.dmTemplate,
      buttons.length > 0 ? buttons : undefined,
    );
    console.log("→ DM sent");

    await logDm(uid, {
      commenterId, commenterUsername, postId,
      postUrl: rule.postUrl ?? "",
      postShortcode: shortcodeFrom(rule.postUrl),
      ruleId: rule.id!, sentAt: Date.now(),
      status: "sent", type: "actual",
    });

    if (rule.nudgeEnabled && rule.nudgeMessage) {
      await delay((rule.nudgeDelay ?? 3) * 1000);
      await safeSendDm(token, { id: commenterId }, rule.nudgeMessage);
      console.log("→ Nudge sent");
    }
  } catch (e) {
    console.error("→ DM failed:", e);
    await logDm(uid, {
      commenterId, commenterUsername, postId,
      postUrl: rule.postUrl ?? "",
      postShortcode: shortcodeFrom(rule.postUrl),
      ruleId: rule.id!, sentAt: Date.now(),
      status: "failed", type: "actual",
    });
  }
}

/* ── Follow gate DM ─────────────────────────────────────────────── */
async function sendFollowGateDm(token: IgToken, senderId: string, rule: Rule) {
  await safeSendDm(
    token,
    { id: senderId },
    `Looks like you're not following @${token.ig_username} yet 👀\nFollow us and tap the button below to get your link!`,
    [
      { type: "url" as const,          label: `Follow @${token.ig_username}`, url: `https://www.instagram.com/${token.ig_username}/` },
      { type: "quick_reply" as const,   label: "I'm following ✅",             payload: `FOLLOW_CONFIRM:${rule.id}` },
    ],
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */
async function safeSendDm(
  token:     IgToken,
  recipient: { id?: string; comment_id?: string },
  message:   string,
  buttons?:  DMButton[],
) {
  console.log("→ safeSendDm to:", recipient, "msg:", message.slice(0, 60), "buttons:", buttons?.length ?? 0);
  await sendDm(token.access_token, token.ig_user_id, recipient, message, buttons);
}

function shortcodeFrom(postUrl?: string) {
  return postUrl?.split("/p/")[1]?.replace(/\//g, "") ?? "";
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));