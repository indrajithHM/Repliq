export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getToken, saveToken, deletePending, findUidByIgUserId, IgToken } from "@/lib/firebase";
import { getDatabase, ref, get } from "firebase/database";
import { initializeApp, getApps, getApp } from "firebase/app";
import { refreshToken } from "@/lib/instagram";

function getDb() {
  const config = {
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            ?? "placeholder",
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? "placeholder",
    databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL       ?? "https://placeholder-default-rtdb.firebaseio.com",
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         ?? "placeholder",
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? "placeholder",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "placeholder",
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             ?? "placeholder",
  };
  const app = getApps().length === 0 ? initializeApp(config) : getApp();
  return getDatabase(app);
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = getDb();
  const snap = await get(ref(db, "users"));
  if (!snap.exists()) return NextResponse.json({ ok:true, refreshed:0, cleaned:0 });

  const users  = snap.val() as Record<string,{ tokens?: IgToken; pending?: Record<string,{ expiresAt:number }> }>;
  const now    = Date.now();
  let refreshed = 0, cleaned = 0;

  for (const [uid, data] of Object.entries(users)) {
    const token = data.tokens;
    if (token?.access_token && token.expires_at - now < 7 * 86_400_000) {
      try {
        const fresh = await refreshToken(token.access_token);
        await saveToken(uid, { ...token, ...fresh });
        refreshed++;
      } catch (e) { console.error(`Token refresh failed uid=${uid}:`, e); }
    }
    if (data.pending) {
      for (const [pid, entry] of Object.entries(data.pending)) {
        if (entry.expiresAt < now) {
          await deletePending(uid, pid);
          cleaned++;
        }
      }
    }
  }

  return NextResponse.json({ ok:true, refreshed, cleaned });
}
