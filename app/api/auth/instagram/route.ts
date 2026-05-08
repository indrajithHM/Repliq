export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, getIgProfile } from "@/lib/instagram";
import { saveToken, saveHandle } from "@/lib/firebase";

export async function POST(req: NextRequest) {
  try {
    const { code, uid, redirectUri } = await req.json() as {
      code: string; uid: string; redirectUri: string;
    };

   // console.log("→ redirectUri received:", redirectUri);
    //console.log("→ code:", code?.slice(0, 20) + "...");
    //console.log("→ INSTAGRAM_APP_ID:", process.env.INSTAGRAM_APP_ID);
    //console.log("→ INSTAGRAM_APP_SECRET exists:", !!process.env.INSTAGRAM_APP_SECRET);

    if (!code || !uid || !redirectUri) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const tokenData = await exchangeCodeForToken(code, redirectUri);
    //console.log("→ tokenData:", tokenData);

    const profile = await getIgProfile(tokenData.access_token, tokenData.ig_user_id);
    //console.log("→ profile:", profile);

    const result = {
      access_token: tokenData.access_token,
      ig_user_id:   tokenData.ig_user_id,
      ig_username:  profile.username,
      expires_at:   tokenData.expires_at,
    };

    //await saveToken(uid, result);
    //await saveHandle(uid, profile.username);

    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Authentication failed";
    console.error("→ ERROR:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}