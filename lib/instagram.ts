const GRAPH = "https://graph.instagram.com/v21.0";

const IG_APP_ID     = process.env.INSTAGRAM_APP_ID!;
const IG_APP_SECRET = process.env.INSTAGRAM_APP_SECRET!;

export interface InstagramMedia {
  id:             string;
  caption?:       string;
  media_type:     "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  thumbnail_url?: string;
  media_url?:     string;
  permalink:      string;
  timestamp:      string;
}

export type DMButton =
  | {
      type: "url";
      label: string;
      url: string;
    }
  | {
      type: "quick_reply";
      label: string;
      payload: string;
    };

/* ── Send DM ────────────────────────────────────────────────────── */
export async function sendDm(
  accessToken: string,
  igUserId:    string,
  recipient:   { id?: string; comment_id?: string },
  message:     string,
  buttons?:    DMButton[],
) {
  let messagePayload: any;

  if (buttons && buttons.length > 0) {
    const urlButtons = buttons.filter(b => b.type === "url");
    const quickReplies = buttons.filter(b => b.type === "quick_reply");

    if (quickReplies.length > 0 && urlButtons.length === 0) {
      // Clean Quick Replies implementation 
      messagePayload = {
        text: message,
        quick_replies: quickReplies.map(b => ({
          content_type: "text",
          title: b.label,
          payload: b.payload,
        })),
      };
    } else if (urlButtons.length > 0) {
      // If URL buttons are present, they must be formatted inside the attachment button template
      messagePayload = {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: message,
            buttons: [
              ...urlButtons.map(b => ({
                type: "web_url",
                url: b.url,
                title: b.label,
              })),
              ...quickReplies.map(b => ({
                type: "postback",
                title: b.label,
                payload: b.payload,
              })),
            ],
          },
        },
      };
    }
  } else {
    messagePayload = { text: message };
  }

  const res = await fetch(`${GRAPH}/${igUserId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient,
      message: messagePayload,
      messaging_type: "RESPONSE",
      access_token: accessToken,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Failed to send DM");
  return data;
}

/* ── Reply To Comment ───────────────────────────────────────────── */
export async function replyToComment(
  accessToken: string,
  commentId:   string,
  message:     string,
) {
  const res = await fetch(`${GRAPH}/${commentId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      access_token: accessToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Failed to reply to comment");
  return data;
}

/* ── Check Follower Status (FIXED) ──────────────────────────────── */
export async function checkFollower(
  accessToken: string,
  igUserId: string,
  targetIgId: string
): Promise<boolean> {
  try {
    const url = new URL(`https://graph.instagram.com/v21.0/${igUserId}/conversations`);
    url.searchParams.set("platform", "instagram");
    url.searchParams.set("user_id", targetIgId);
    url.searchParams.set("fields", "is_user_follow_business");
    url.searchParams.set("access_token", accessToken);

    const res  = await fetch(url.toString());
    const data = await res.json();

    console.log("→ checkFollower raw response:", JSON.stringify(data));

    if (!res.ok || data.error) {
      console.warn("⚠️ checkFollower API error:", data.error?.message ?? "Unknown");
      return true; // fail open
    }

    // Response is { data: [{ is_user_follow_business: true/false }] }
    const conversation = data.data?.[0];
    return !!conversation?.is_user_follow_business;
  } catch (error) {
    console.error("❌ checkFollower error:", error);
    return true;
  }
}
/* ── Get Media ──────────────────────────────────────────────────── */
export async function getMedia(accessToken: string, igUserId: string): Promise<InstagramMedia[]> {
  const fields = "id,caption,media_type,thumbnail_url,media_url,permalink,timestamp";
  const res = await fetch(
    `${GRAPH}/${igUserId}/media?fields=${fields}&limit=20&access_token=${accessToken}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Failed to fetch media");
  return data.data as InstagramMedia[];
}

/* ── Get IG Profile ─────────────────────────────────────────────── */
export async function getIgProfile(accessToken: string, igUserId: string) {
  const res = await fetch(
    `${GRAPH}/${igUserId}?fields=id,username,profile_picture_url,followers_count&access_token=${accessToken}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Failed to fetch profile");
  return data as { id: string; username: string; profile_picture_url?: string; followers_count?: number };
}

/* ── Exchange Code For Token ────────────────────────────────────── */
export async function exchangeCodeForToken(code: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id:     IG_APP_ID,
    client_secret: IG_APP_SECRET,
    grant_type:    "authorization_code",
    redirect_uri:  redirectUri,
    code,
  });
  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST", body: params,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_message ?? "Token exchange failed");

  const llRes = await fetch(
    `${GRAPH}/access_token?grant_type=ig_exchange_token&client_secret=${IG_APP_SECRET}&access_token=${data.access_token}`
  );
  const llData = await llRes.json();
  if (!llRes.ok) throw new Error(llData.error?.message ?? "Long-lived token exchange failed");

  const meRes = await fetch(
    `${GRAPH}/me?fields=id,username,user_id,profile_picture_url&access_token=${llData.access_token}`
  );
  const meData = await meRes.json();
  if (meData.error) throw new Error(meData.error.message ?? "Failed to fetch profile");

  return {
    access_token:        llData.access_token as string,
    ig_user_id:          meData.id as string,
    ig_page_id:          meData.user_id as string,
    ig_username:         meData.username as string,
    expires_at:          Date.now() + (llData.expires_in as number) * 1000,
    profile_picture_url: meData.profile_picture_url as string | undefined,
  };
}

/* ── Refresh Token ──────────────────────────────────────────────── */
export async function refreshToken(accessToken: string) {
  const res = await fetch(
    `${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Token refresh failed");
  return {
    access_token: data.access_token as string,
    expires_at:   Date.now() + (data.expires_in as number) * 1000,
  };
}

/* ── Match Comment ──────────────────────────────────────────────── */
export function matchComment(
  commentText: string,
  matchMode:   "any_comment" | "word_match" | "exact_match",
  keywords:    string[],
): boolean {
  if (matchMode === "any_comment") return true;
  const lower = commentText.trim().toLowerCase();
  if (matchMode === "exact_match")
    return keywords.some((kw) => lower === kw.trim().toLowerCase());
  return keywords.some((kw) => lower.includes(kw.trim().toLowerCase()));
}