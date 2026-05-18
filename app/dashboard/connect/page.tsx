"use client";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { getToken, saveToken, saveHandle, IgToken } from "@/lib/firebase";
import { CheckCircle, Wifi, WifiOff, RefreshCw, Copy, Check } from "lucide-react";
import { useToast } from "@/components/Toast";

export default function ConnectPage() {
  const { user } = useAuth();
  const { show, ToastEl } = useToast();
  const [token, setToken]           = useState<IgToken | null>(null);
  const [loading, setLoading]       = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied]         = useState(false);
  const connectingRef               = useRef(false);

  const loadToken = async () => {
    if (!user) return;
    setToken(await getToken(user.uid));
    setLoading(false);
  };

  useEffect(() => { loadToken(); }, [user]); // eslint-disable-line

  useEffect(() => {
    if (!user) return;
    if (connectingRef.current) return;
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (!code) return;
    connectingRef.current = true;
    window.history.replaceState({}, "", "/dashboard/connect");
    setConnecting(true);
    const redirectUri = process.env.NEXT_PUBLIC_APP_URL + "/dashboard/connect";
    fetch("/api/auth/instagram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, uid: user.uid, redirectUri }),
    })
      .then(r => r.json())
      .then(async data => {
        if (data.error) throw new Error(data.error);
        await saveToken(user.uid, data);
        await saveHandle(user.uid, data.ig_username);
        show("Instagram connected!", "success");
        loadToken();
      })
      .catch(e => { console.error(e); show(e.message, "error"); })
      .finally(() => setConnecting(false));
  }, [user]); // eslint-disable-line

  const handleConnect = () => {
    const redirectUri = encodeURIComponent(process.env.NEXT_PUBLIC_APP_URL + "/dashboard/connect");
    const scope = "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights";
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    window.location.href = `https://www.instagram.com/oauth/authorize`
      + `?force_reauth=true&client_id=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  };

  const handleDisconnect = async () => {
    if (!user) return;
    const { deleteToken } = await import("@/lib/firebase");
    await deleteToken(user.uid);
    setToken(null);
    show("Disconnected", "info");
  };

  const isExpired = token && Date.now() > token.expires_at;
  const daysLeft  = token ? Math.max(0, Math.floor((token.expires_at - Date.now()) / 86400000)) : 0;
  const bioUrl    = typeof window !== "undefined" && token
    ? `${window.location.origin}/u/${token.ig_username}` : "";

  const copyBio = () => {
    navigator.clipboard.writeText(bioUrl);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const requirements = [
    "Instagram Business or Creator account",
    "Connected to a Facebook Page",
    "Meta app with instagram_business_manage_messages permission",
    "Webhook URL registered in Meta Developer Console",
  ];

  return (
    <div className="animate-fade-up" style={{ maxWidth:600 }}>
      {ToastEl}
      <h1 style={{ fontSize:22,fontWeight:800,letterSpacing:"-0.03em",marginBottom:4 }}>Connect Instagram</h1>
      <p style={{ color:"var(--text2)",fontSize:13,marginBottom:24 }}>
        Link your Instagram Business or Creator account to enable AutoDM.
      </p>

      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ display:"flex",alignItems:"center",gap:14,flexWrap:"wrap" }}>
          <div style={{ width:46,height:46,borderRadius:13,flexShrink:0,
            background:token&&!isExpired?"rgba(0,214,143,0.1)":"rgba(255,77,106,0.1)",
            display:"flex",alignItems:"center",justifyContent:"center" }}>
            {loading ? "…" : token&&!isExpired
              ? <Wifi size={20} color="var(--green)"/>
              : <WifiOff size={20} color="var(--accent)"/>}
          </div>
          <div style={{ flex:1,minWidth:160 }}>
            {loading
              ? <div className="skeleton" style={{ width:180,height:18,borderRadius:6 }}/>
              : token&&!isExpired
              ? <>
                  <div style={{ fontWeight:700,fontSize:14,marginBottom:2 }}>
                    Connected as <span style={{ color:"var(--green)" }}>@{token.ig_username}</span>
                  </div>
                  <div style={{ fontSize:12,color:"var(--text3)" }}>
                    Token expires in {daysLeft} days · ID: {token.ig_user_id}
                  </div>
                </>
              : <>
                  <div style={{ fontWeight:700,fontSize:14,marginBottom:2 }}>Not connected</div>
                  <div style={{ fontSize:12,color:"var(--text3)" }}>
                    {isExpired ? "Token expired — please reconnect" : "No Instagram account linked"}
                  </div>
                </>}
          </div>
          {token && !isExpired && (
            <button className="btn-ghost" onClick={handleDisconnect} style={{ fontSize:13,padding:"8px 14px",flexShrink:0 }}>
              Disconnect
            </button>
          )}
        </div>
      </div>

      {(!token || isExpired) && (
        <button className="btn-primary" onClick={handleConnect} disabled={connecting}
          style={{ width:"100%",justifyContent:"center",padding:"14px",fontSize:15,borderRadius:14,marginBottom:16 }}>
          {connecting
            ? <><RefreshCw size={15} className="animate-spin"/>Connecting…</>
            : <><span style={{ fontSize:18 }}>📸</span>Connect Instagram Account</>}
        </button>
      )}

      {token && !isExpired && (
        <div className="card" style={{ marginBottom:16,background:"rgba(255,179,0,0.06)",border:"1px solid rgba(255,179,0,0.2)" }}>
          <div style={{ fontWeight:700,fontSize:13,color:"var(--yellow)",marginBottom:10 }}>📎 Your public bio link</div>
          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
            <div style={{ fontFamily:"var(--font-mono)",fontSize:11,color:"var(--text)",
              flex:1,padding:"9px 12px",background:"var(--bg3)",borderRadius:8,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
              {bioUrl}
            </div>
            <button className="btn-ghost" onClick={copyBio} style={{ padding:"8px 12px",fontSize:12,flexShrink:0 }}>
              {copied ? <><Check size={13}/>Copied</> : <><Copy size={13}/>Copy</>}
            </button>
          </div>
          <div style={{ fontSize:12,color:"var(--text3)",marginTop:8 }}>
            Paste this URL in your Instagram bio. Visitors will see your links page.
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ fontWeight:700,fontSize:14,marginBottom:12 }}>Requirements</div>
        {requirements.map(r => (
          <div key={r} style={{ display:"flex",gap:10,marginBottom:10,alignItems:"flex-start" }}>
            <CheckCircle size={14} color="var(--green)" style={{ marginTop:2,flexShrink:0 }}/>
            <span style={{ fontSize:13,color:"var(--text2)",lineHeight:1.5 }}>{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}