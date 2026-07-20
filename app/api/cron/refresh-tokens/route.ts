export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getAllTokens, updateToken } from "@/lib/firebase";
import { refreshToken } from "@/lib/instagram";

// How long before actual expiry we proactively refresh.
// IG long-lived tokens last ~60 days; refreshing anytime after they're
// 24h old (and well before expiry) is allowed. We use a 10-day buffer
// so a daily cron has plenty of retries before a token actually dies.
const REFRESH_BUFFER_MS = 10 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  // Protect this route — only Vercel Cron (or you, manually) should hit it.
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const all = await getAllTokens();
  const now = Date.now();

  const results: { uid: string; status: string }[] = [];

  for (const { uid, token } of all) {
    const timeLeft = token.expires_at - now;

    // Already expired — refresh_access_token can't revive a dead token,
    // the user has to reconnect via OAuth. Just log and skip.
    if (timeLeft <= 0) {
      console.log(`→ Token for uid ${uid} already expired, skipping (needs reconnect)`);
      results.push({ uid, status: "expired_needs_reconnect" });
      continue;
    }

    // Not close enough to expiry yet — leave it alone.
    if (timeLeft > REFRESH_BUFFER_MS) {
      results.push({ uid, status: "not_due" });
      continue;
    }

    try {
      const refreshed = await refreshToken(token.access_token);
      await updateToken(uid, {
        access_token: refreshed.access_token,
        expires_at:   refreshed.expires_at,
      });
      console.log(`→ Refreshed token for uid ${uid}, new expiry:`, new Date(refreshed.expires_at).toISOString());
      results.push({ uid, status: "refreshed" });
    } catch (e) {
      console.error(`→ Failed to refresh token for uid ${uid}:`, e);
      results.push({ uid, status: "refresh_failed" });
    }
  }

  return NextResponse.json({ ok: true, checked: all.length, results });
}