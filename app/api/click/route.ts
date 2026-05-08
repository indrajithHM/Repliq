export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { incrementLinkClick,incrementGroupLinkClick } from "@/lib/firebase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
 const uid      = searchParams.get("uid");
const linkId   = searchParams.get("linkId");
const groupId  = searchParams.get("groupId");
const redirect = searchParams.get("redirect");

  if (!uid || !linkId || !redirect) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // Fire-and-forget — don't block the redirect on a DB write
  if (groupId) {
  incrementGroupLinkClick(uid, groupId, linkId).catch(console.error);
} else {
  incrementLinkClick(uid, linkId).catch(console.error);
}

  return NextResponse.redirect(redirect);
}

export async function POST(req: NextRequest) {
  const { uid, linkId } = await req.json() as { uid: string; linkId: string };
  if (!uid || !linkId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }
  await incrementLinkClick(uid, linkId);
  return NextResponse.json({ ok: true });
}
