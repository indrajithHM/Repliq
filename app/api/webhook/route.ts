// export const dynamic = "force-dynamic";
// import { NextRequest, NextResponse } from "next/server";
// import crypto from "crypto";
// import {
//   getToken, getRules, alreadyDmed, logDm,
//   savePending, getPendingByCommenter, deletePending,
//   findUidByIgUserId, Rule, IgToken,
// } from "@/lib/firebase";
// import { sendDm, matchComment, replyToComment, checkFollower, CtaButton } from "@/lib/instagram";

// /* ── GET: webhook verification ─────────────────────────────────── */
// export async function GET(req: NextRequest) {
//   const { searchParams } = new URL(req.url);
//   const mode      = searchParams.get("hub.mode");
//   const token     = searchParams.get("hub.verify_token");
//   const challenge = searchParams.get("hub.challenge");
//   if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
//     return new Response(challenge ?? "", { status: 200 });
//   }
//   return new Response("Forbidden", { status: 403 });
// }

// /* ── POST: incoming events ──────────────────────────────────────── */
// export async function POST(req: NextRequest) {
//   const rawBody = await req.text();
//   console.log("→ Webhook received:", rawBody.slice(0, 300));

//   const sig      = req.headers.get("x-hub-signature-256") ?? "";
//   const expected = "sha256=" +
//     crypto.createHmac("sha256", process.env.META_APP_SECRET!)
//       .update(rawBody).digest("hex");

//   console.log("→ Sig received:", sig.slice(0, 30));
//   console.log("→ Sig expected:", expected.slice(0, 30));

//   try {
//     if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
//       console.log("→ SIGNATURE MISMATCH");
//       return new Response("Invalid signature", { status: 401 });
//     }
//   } catch (e) {
//     console.log("→ Signature error:", e);
//     return new Response("Signature error", { status: 401 });
//   }

//   const body = JSON.parse(rawBody);
//   console.log("→ Parsed body:", JSON.stringify(body, null, 2));

//   for (const entry of (body.entry ?? []) as Record<string, unknown>[]) {
//     const igPageId = entry.id as string;
//     console.log("→ Entry igPageId:", igPageId);

//     for (const change of (entry.changes ?? []) as { field: string; value: unknown }[]) {
//       console.log("→ Change field:", change.field, "value:", JSON.stringify(change.value));
//       if (change.field === "comments") {
//         await handleComment(change.value as CommentPayload, igPageId).catch(e => {
//           console.error("→ handleComment error:", e);
//         });
//       }
//       if (change.field === "follow") {
//         const v = change.value as { new_follower?: string; follower_id?: string };
//         const followerId = v.new_follower ?? v.follower_id ?? "";
//         if (followerId) await handleFollow(followerId, igPageId).catch(e => {
//           console.error("→ handleFollow error:", e);
//         });
//       }
//     }

//     for (const msg of (entry.messaging ?? []) as { follow?: boolean; sender: { id: string } }[]) {
//       if (msg.follow) {
//         await handleFollow(msg.sender.id, igPageId).catch(console.error);
//       }
//     }
//   }

//   return NextResponse.json({ ok: true });
// }

// /* ── Comment handler ────────────────────────────────────────────── */
// interface CommentPayload {
//   id?:        string;
//   text?:      string;
//   from?:      { id: string; username?: string };
//   media?:     { id: string };
//   parent_id?: string;
// }

// async function handleComment(value: CommentPayload, igPageId: string) {
//   const commentText       = value.text ?? "";
//   const commenterId       = value.from?.id ?? "";
//   const commenterUsername = value.from?.username ?? "unknown";
//   const postId            = value.media?.id ?? "";
//   const commentId         = value.id ?? "";

//   console.log("→ handleComment:", { commentText, commenterId, postId, igPageId });

//   if (value.parent_id) {
//     console.log("→ Skipping reply comment (has parent_id)");
//     return;
//   }

//   if (!commenterId || !postId) {
//     console.log("→ Missing commenterId or postId, skipping");
//     return;
//   }

//   const uid = await findUidByIgUserId(igPageId);
//   console.log("→ Found uid:", uid);
//   if (!uid) return;

//   const token = await getToken(uid);
//   console.log("→ Token exists:", !!token, "ig_user_id:", token?.ig_user_id);
//   if (!token) return;

//   if (commenterId === igPageId || commenterId === token.ig_user_id) {
//     console.log("→ Skipping own comment");
//     return;
//   }

//   const rules = await getRules(uid);
//   console.log("→ Rules count:", rules.length);

//   const matched = rules.find(
//     r => r.active && r.postId === postId &&
//          matchComment(commentText, r.matchMode, r.keywords ?? [])
//   );
//   console.log("→ Matched rule:", matched?.id ?? "none");
//   if (!matched) return;

//   const alreadySent = await alreadyDmed(uid, commenterId, postId);
//   console.log("→ Already DMed:", alreadySent);
//   if (alreadySent) return;

//   // Follow-gate: check if commenter follows the account
//   let isFollower = false;
//   try {
//     isFollower = await checkFollower(token.access_token, token.ig_user_id, commenterId);
//   } catch (e) {
//     console.error("→ checkFollower error (treating as non-follower):", e);
//   }
//   console.log("→ Is follower:", isFollower);

//   if (!isFollower) {
//     // Save as pending so we can deliver when they follow
//    await savePending(uid, {
//   uid,
//   commenterId,
//   commenterUsername,
//   postId,
//   ruleId: matched.id!,
//   savedAt: Date.now(),
//   expiresAt:
//     Date.now() + (matched.pendingExpiry ?? 48) * 60 * 60 * 1000,
// });

//     // Send follow-prompt DM with bio link as button
//     const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
//     const bioUrl = token.ig_username && appUrl
//       ? `${appUrl}/u/${token.ig_username}`
//       : undefined;

//     const followPromptText = matched.nudgeMessage?.trim()
//       ? matched.nudgeMessage
//       : `Hey! To receive what you asked for, please follow @${token.ig_username} first and then I'll send it right over! 🙏`;

//     const recipient = commentId ? { comment_id: commentId } : { id: commenterId };

//     try {
//       await safeSendDm(
//         token,
//         recipient,
//         followPromptText,
//         bioUrl ? { label: `Follow @${token.ig_username}`, url: `https://www.instagram.com/${token.ig_username}/` } : undefined,
//       );
//       console.log("→ Follow-prompt DM sent");
//       await logDm(uid, {
//         commenterId, commenterUsername, postId,
//         postUrl: matched.postUrl ?? "",
//         postShortcode: matched.postUrl?.split("/p/")[1]?.replace(/\//g, "") ?? "",
//         ruleId: matched.id!, sentAt: Date.now(),
//         status: "sent", type: "follow_prompt",
//       });
//     } catch (e) {
//       console.error("→ Follow-prompt DM failed:", e);
//       await logDm(uid, {
//         commenterId, commenterUsername, postId,
//         postUrl: matched.postUrl ?? "",
//         postShortcode: matched.postUrl?.split("/p/")[1]?.replace(/\//g, "") ?? "",
//         ruleId: matched.id!, sentAt: Date.now(),
//         status: "failed", type: "follow_prompt",
//       });
//     }
//     return;
//   }

//   // Follower — deliver the actual DM immediately
//   await deliverActualDm(uid, token, commenterId, commenterUsername, postId, matched, commentId);
// }

// /* ── Follow handler ─────────────────────────────────────────────── */
// async function handleFollow(followerId: string, igPageId: string) {
//   console.log("→ handleFollow:", { followerId, igPageId });
//   const uid = await findUidByIgUserId(igPageId);
//   if (!uid) return;
//   const token = await getToken(uid);
//   if (!token) return;
//   const pending = await getPendingByCommenter(uid, followerId);
//   if (!pending) return;
//   const rules = await getRules(uid);
//   const rule  = rules.find(r => r.id === pending.ruleId);
//   if (!rule) return;

//   // They followed — deliver the actual rule DM (with rule's own CTA if configured)
//   await deliverActualDm(uid, token, followerId, "user", pending.postId, rule);
//   await deletePending(uid, pending.id!);
// }

// /* ── Deliver actual DM + nudge ──────────────────────────────────── */
// async function deliverActualDm(
//   uid: string, token: IgToken,
//   commenterId: string, commenterUsername: string,
//   postId: string, rule: Rule,
//   commentId?: string,
// ) {
//   const shortcode = rule.postUrl?.split("/p/")[1]?.replace(/\//g, "") ?? "";

//   // Public comment reply
//   if (rule.replyEnabled && rule.replyTemplate && commentId) {
//     try {
//       await replyToComment(token.access_token, commentId, rule.replyTemplate);
//       console.log("→ Comment reply sent");
//     } catch (e) {
//       console.error("→ Comment reply failed:", e);
//     }
//   }

//   // Use rule's CTA button if configured
//   const cta: CtaButton | undefined =
//     rule.ctaEnabled && rule.ctaLabel && rule.ctaUrl
//       ? { label: rule.ctaLabel, url: rule.ctaUrl }
//       : undefined;

//   console.log("→ deliverActualDm to:", commenterId, "rule:", rule.id, "cta:", cta ?? "none");

//   const recipient = commentId ? { comment_id: commentId } : { id: commenterId };

//   try {
//     await safeSendDm(token, recipient, rule.dmTemplate, cta);
//     console.log("→ DM sent successfully");

//     await logDm(uid, {
//       commenterId, commenterUsername, postId,
//       postUrl: rule.postUrl ?? "",
//       postShortcode: shortcode,
//       ruleId: rule.id!, sentAt: Date.now(),
//       status: "sent", type: "actual",
//     });

//     // Nudge — sent as plain text (no CTA button on the follow-up)
//     if (rule.nudgeEnabled && rule.nudgeMessage) {
//       await delay((rule.nudgeDelay ?? 3) * 1000);
//       await safeSendDm(token, recipient, rule.nudgeMessage);
//       console.log("→ Nudge sent successfully");
//     }
//   } catch (e) {
//     console.error("→ DM failed:", e);
//     await logDm(uid, {
//       commenterId, commenterUsername, postId,
//       postUrl: rule.postUrl ?? "",
//       postShortcode: shortcode,
//       ruleId: rule.id!, sentAt: Date.now(),
//       status: "failed", type: "actual",
//     });
//   }
// }

// /* ── Helpers ─────────────────────────────────────────────────────── */
// async function safeSendDm(
//   token:     IgToken,
//   recipient: { id?: string; comment_id?: string },
//   message:   string,
//   cta?:      CtaButton,
// ) {
//   console.log("→ safeSendDm to:", recipient, "message:", message.slice(0, 50), "cta:", cta ?? "none");
//   await sendDm(token.access_token, token.ig_user_id, recipient, message, cta);
// }

// const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
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

    for (const msg of (entry.messaging ?? []) as MessagingEvent[]) {
      // Handle quick replies
      if (msg.message?.quick_reply?.payload) {
        await handleQuickReply(msg, igPageId).catch(console.error);
      }
      // Handle text messages (optional)
      if (msg.message?.text && !msg.message?.quick_reply) {
        await handleTextMessage(msg, igPageId).catch(console.error);
      }
      // Handle follows
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
  sender: { id: string };
  recipient?: { id: string };
  message?: {
    text?: string;
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

  // Save pending entry with initial state
  await savePending(uid, {
    uid,
    commenterId,
    commenterUsername,
    postId,
    ruleId: matched.id!,
    state: "awaiting_link_request",
    savedAt: Date.now(),
    expiresAt: Date.now() + (matched.pendingExpiry ?? 48) * 60 * 60 * 1000,
  });

  // Send engagement DM with "Send me the link" button
  const engagementText = `Hey @${commenterUsername}! Thanks for your interest 😊\n\nTap below and I'll send the link ✨`;

  try {
    await safeSendDm(
      token,
      { id: commenterId },
      engagementText,
      [
        {
          type: "quick_reply",
          label: "Send me the link 🔗",
          payload: `SEND_LINK:${matched.id}`,
        },
      ],
    );
    console.log("→ Engagement DM sent");

    await logDm(uid, {
      commenterId, commenterUsername, postId,
      postUrl: matched.postUrl ?? "",
      postShortcode: matched.postUrl?.split("/p/")[1]?.replace(/\//g, "") ?? "",
      ruleId: matched.id!, sentAt: Date.now(),
      status: "sent", type: "engagement",
    });
  } catch (e) {
    console.error("→ Engagement DM failed:", e);
    await logDm(uid, {
      commenterId, commenterUsername, postId,
      postUrl: matched.postUrl ?? "",
      postShortcode: matched.postUrl?.split("/p/")[1]?.replace(/\//g, "") ?? "",
      ruleId: matched.id!, sentAt: Date.now(),
      status: "failed", type: "engagement",
    });
  }
}

/* ── Quick Reply handler ────────────────────────────────────────── */
async function handleQuickReply(msg: MessagingEvent, igPageId: string) {
  const senderId = msg.sender.id;
  const payload = msg.message?.quick_reply?.payload ?? "";
  
  console.log("→ handleQuickReply:", { senderId, payload });

  const uid = await findUidByIgUserId(igPageId);
  if (!uid) return;

  const token = await getToken(uid);
  if (!token) return;

  const pending = await getPendingByCommenter(uid, senderId);
  if (!pending) {
    console.log("→ No pending entry found for sender");
    return;
  }

  const rules = await getRules(uid);
  const rule = rules.find(r => r.id === pending.ruleId);
  if (!rule) {
    console.log("→ Rule not found");
    return;
  }

  // Handle SEND_LINK payload
  if (payload.startsWith("SEND_LINK:")) {
    const ruleId = payload.split(":")[1];
    if (ruleId !== pending.ruleId) {
      console.log("→ Rule ID mismatch");
      return;
    }

    // Check if user is following
    let isFollower = false;
    try {
      isFollower = await checkFollower(token.access_token, token.ig_user_id, senderId);
    } catch (e) {
      console.error("→ checkFollower error:", e);
    }
    console.log("→ Is follower:", isFollower);

    if (isFollower) {
      // Deliver actual DM directly
      await deliverActualDm(uid, token, senderId, pending.commenterUsername, pending.postId, rule);
      await deletePending(uid, pending.id!);
    } else {
      // Send follow gate
      await updatePendingState(uid, pending.id!, "awaiting_follow_confirm");
      
      const followGateText = `Looks like you're not following @${token.ig_username} yet 👀\n\nFollow and tap the button below to get your link!`;

      try {
        await safeSendDm(
          token,
          { id: senderId },
          followGateText,
          [
            {
              type: "url",
              label: `Follow @${token.ig_username}`,
              url: `https://www.instagram.com/${token.ig_username}/`,
            },
            {
              type: "quick_reply",
              label: "I'm following ✅",
              payload: `FOLLOW_CONFIRM:${rule.id}`,
            },
          ],
        );
        console.log("→ Follow gate DM sent");

        await logDm(uid, {
          commenterId: senderId,
          commenterUsername: pending.commenterUsername,
          postId: pending.postId,
          postUrl: rule.postUrl ?? "",
          postShortcode: rule.postUrl?.split("/p/")[1]?.replace(/\//g, "") ?? "",
          ruleId: rule.id!,
          sentAt: Date.now(),
          status: "sent",
          type: "follow_gate",
        });
      } catch (e) {
        console.error("→ Follow gate DM failed:", e);
      }
    }
  }

  // Handle FOLLOW_CONFIRM payload
  if (payload.startsWith("FOLLOW_CONFIRM:")) {
    const ruleId = payload.split(":")[1];
    if (ruleId !== pending.ruleId) {
      console.log("→ Rule ID mismatch");
      return;
    }

    // Recheck follower status
    let isFollower = false;
    try {
      isFollower = await checkFollower(token.access_token, token.ig_user_id, senderId);
    } catch (e) {
      console.error("→ checkFollower error:", e);
    }

    if (isFollower) {
      // Deliver actual DM
      await deliverActualDm(uid, token, senderId, pending.commenterUsername, pending.postId, rule);
      await deletePending(uid, pending.id!);
    } else {
      // Reprompt
      const repromptText = `You're still not following @${token.ig_username} 🙏\n\nPlease follow and tap the button again!`;

      try {
        await safeSendDm(
          token,
          { id: senderId },
          repromptText,
          [
            {
              type: "url",
              label: `Follow @${token.ig_username}`,
              url: `https://www.instagram.com/${token.ig_username}/`,
            },
            {
              type: "quick_reply",
              label: "I'm following ✅",
              payload: `FOLLOW_CONFIRM:${rule.id}`,
            },
          ],
        );
        console.log("→ Reprompt DM sent");
      } catch (e) {
        console.error("→ Reprompt DM failed:", e);
      }
    }
  }
}

/* ── Text message handler (optional) ────────────────────────────── */
async function handleTextMessage(msg: MessagingEvent, igPageId: string) {
  const senderId = msg.sender.id;
  const text = msg.message?.text ?? "";
  
  console.log("→ handleTextMessage:", { senderId, text });

  // You can add custom text handling here if needed
  // For now, just log it
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

  // If they're in follow_gate state, deliver the content
  if (pending.state === "awaiting_follow_confirm") {
    const rules = await getRules(uid);
    const rule = rules.find(r => r.id === pending.ruleId);
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
  const shortcode = rule.postUrl?.split("/p/")[1]?.replace(/\//g, "") ?? "";

  // Public comment reply
  if (rule.replyEnabled && rule.replyTemplate && commentId) {
    try {
      await replyToComment(token.access_token, commentId, rule.replyTemplate);
      console.log("→ Comment reply sent");
    } catch (e) {
      console.error("→ Comment reply failed:", e);
    }
  }

  // Build buttons based on rule configuration
  const buttons: DMButton[] = [];
  if (rule.ctaEnabled && rule.ctaLabel && rule.ctaUrl) {
    buttons.push({
      type: "url",
      label: rule.ctaLabel,
      url: rule.ctaUrl,
    });
  }

  console.log("→ deliverActualDm to:", commenterId, "rule:", rule.id);

  try {
    await safeSendDm(
      token,
      { id: commenterId },
      rule.dmTemplate,
      buttons.length > 0 ? buttons : undefined,
    );
    console.log("→ DM sent successfully");

    await logDm(uid, {
      commenterId, commenterUsername, postId,
      postUrl: rule.postUrl ?? "",
      postShortcode: shortcode,
      ruleId: rule.id!, sentAt: Date.now(),
      status: "sent", type: "actual",
    });

    // Nudge — sent as plain text (no buttons)
    if (rule.nudgeEnabled && rule.nudgeMessage) {
      await delay((rule.nudgeDelay ?? 3) * 1000);
      await safeSendDm(token, { id: commenterId }, rule.nudgeMessage);
      console.log("→ Nudge sent successfully");
    }
  } catch (e) {
    console.error("→ DM failed:", e);
    await logDm(uid, {
      commenterId, commenterUsername, postId,
      postUrl: rule.postUrl ?? "",
      postShortcode: shortcode,
      ruleId: rule.id!, sentAt: Date.now(),
      status: "failed", type: "actual",
    });
  }
}

/* ── Helpers ─────────────────────────────────────────────────────── */
async function safeSendDm(
  token:     IgToken,
  recipient: { id?: string; comment_id?: string },
  message:   string,
  buttons?:  DMButton[],
) {
  console.log("→ safeSendDm to:", recipient, "message:", message.slice(0, 50), "buttons:", buttons?.length ?? 0);
  await sendDm(token.access_token, token.ig_user_id, recipient, message, buttons);
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));