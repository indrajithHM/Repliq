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

export async function sendDm(
  accessToken: string, igUserId: string,
  recipientIgId: string, message: string
) {
  const res = await fetch(`${GRAPH}/${igUserId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientIgId },
      message: { text: message },
      messaging_type: "RESPONSE",
      access_token: accessToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Failed to send DM");
  return data;
}

export async function checkFollower(
  accessToken: string, igUserId: string, targetIgId: string
): Promise<boolean> {
  const res = await fetch(
    `${GRAPH}/${igUserId}/followers?fields=id&user_id=${targetIgId}&access_token=${accessToken}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Failed to check follower");
  return Array.isArray(data.data) && data.data.some((u: { id: string }) => u.id === targetIgId);
}

export async function getMedia(accessToken: string, igUserId: string): Promise<InstagramMedia[]> {
  const fields = "id,caption,media_type,thumbnail_url,media_url,permalink,timestamp";
  const res = await fetch(
    `${GRAPH}/${igUserId}/media?fields=${fields}&limit=20&access_token=${accessToken}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Failed to fetch media");
  return data.data as InstagramMedia[];
}

export async function getIgProfile(accessToken: string, igUserId: string) {
  const res = await fetch(
    `${GRAPH}/${igUserId}?fields=id,username,profile_picture_url,followers_count&access_token=${accessToken}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Failed to fetch profile");
  return data as { id: string; username: string; profile_picture_url?: string; followers_count?: number };
}

export async function exchangeCodeForToken(code: string, redirectUri: string) {
  // Step 1: short-lived token
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
  console.log("Short-lived token response:", data);
  if (!res.ok) throw new Error(data.error_message ?? "Token exchange failed");

  // Step 2: long-lived token
  const llRes = await fetch(
    `${GRAPH}/access_token?grant_type=ig_exchange_token&client_secret=${IG_APP_SECRET}&access_token=${data.access_token}`
  );
  const llData = await llRes.json();
  console.log("Long-lived token response:", llData);
  if (!llRes.ok) throw new Error(llData.error?.message ?? "Long-lived token exchange failed");

  // Step 3: fetch profile using /me
  const profileRes = await fetch(
    `${GRAPH}/me?fields=id,username&access_token=${llData.access_token}`
  );
  const profile = await profileRes.json();
  console.log("Profile response:", profile);
  if (profile.error) throw new Error(profile.error.message ?? "Failed to fetch profile");

  // Step 4: try to get the page/business account ID
  // The webhook sends entry.id which is the Instagram Business Account ID
  // For Instagram Login flow this is the same as profile.id but we log it to confirm
  const accountRes = await fetch(
    `https://graph.instagram.com/v21.0/${profile.id}?fields=id,username&access_token=${llData.access_token}`
  );
  const accountData = await accountRes.json();
  console.log("Account data:", JSON.stringify(accountData));

  // Also try the /me endpoint with more fields to find page_id
  const meRes = await fetch(
    `${GRAPH}/me?fields=id,username,user_id&access_token=${llData.access_token}`
  );
  const meData = await meRes.json();
  console.log("Me extended data:", JSON.stringify(meData));

  return {
    access_token: llData.access_token as string,
    ig_user_id:   profile.id as string,
    ig_page_id:   profile.id as string, // store same as ig_user_id for now
    ig_username:  profile.username as string,
    expires_at:   Date.now() + (llData.expires_in as number) * 1000,
  };
}

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

export function matchComment(
  commentText: string,
  matchMode: "any_comment" | "word_match" | "exact_match",
  keywords: string[]
): boolean {
  if (matchMode === "any_comment") return true;
  const lower = commentText.trim().toLowerCase();
  if (matchMode === "exact_match")
    return keywords.some((kw) => lower === kw.trim().toLowerCase());
  return keywords.some((kw) => lower.includes(kw.trim().toLowerCase()));
}