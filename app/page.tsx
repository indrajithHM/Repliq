"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Image from "next/image";

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();

 useEffect(() => {
  if (!loading && user) router.push("/dashboard");
}, [user, loading, router]);

  if (loading) return (
    <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ fontSize:32 }}>⚡</div>
    </div>
  );

  return (
    <div style={{
      minHeight:"100vh",display:"flex",alignItems:"center",
      justifyContent:"center",background:"var(--bg)",position:"relative",overflow:"hidden",
    }}>
      {/* Glow blobs */}
      <div style={{ position:"absolute",width:500,height:500,borderRadius:"50%",top:-150,right:-150,
        background:"radial-gradient(circle,rgba(255,77,106,0.07) 0%,transparent 70%)",pointerEvents:"none" }}/>
      <div style={{ position:"absolute",width:400,height:400,borderRadius:"50%",bottom:-100,left:-100,
        background:"radial-gradient(circle,rgba(124,77,255,0.05) 0%,transparent 70%)",pointerEvents:"none" }}/>

      <div className="animate-fade-up" style={{ textAlign:"center",maxWidth:420,width:"100%",padding:"0 24px" }}>
        {/* Mark */}
        <div style={{ padding: "6px 10px", marginBottom: 12,display: "flex", justifyContent: "center"  }}>
          <Image
            src="/Repliq.png"
            alt="Repliq"
            width={120}
            height={50}
            style={{ 
              width: 120, 
              height: 120, 
              objectFit: "contain",
              borderRadius: 100,
            }}
          />
        </div>
        <p style={{ color:"var(--text2)",fontSize:16,lineHeight:1.65,marginBottom:44 }}>
          Turn every comment into a conversation.<br/>Instagram automation, done right.
        </p>

        <button onClick={signIn} style={{
          width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:12,
          padding:"15px 24px",borderRadius:14,border:"1px solid #e0e0e0",
          background:"white",color:"#1a1a1a",fontFamily:"var(--font-display)",
          fontWeight:600,fontSize:15,cursor:"pointer",
          transition:"all 0.2s",boxShadow:"0 2px 16px rgba(255,255,255,0.08)",
        }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 24px rgba(255,255,255,0.15)")}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 2px 16px rgba(255,255,255,0.08)")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p style={{ marginTop:20,fontSize:12,color:"var(--text3)",lineHeight:1.6 }}>
          You&apos;ll connect your Instagram Business account after signing in.
        </p>

        <div style={{ marginTop:44,display:"flex",justifyContent:"center",gap:28 }}>
          {["Comment detected","Rule matched","DM sent"].map((s,i) => (
            <div key={s} style={{ textAlign:"center" }}>
              <div style={{ width:7,height:7,borderRadius:"50%",margin:"0 auto 6px",
                background:i===0?"#FF4D6A":i===1?"#7c4dff":"var(--green)" }}/>
              <span style={{ fontSize:10,color:"var(--text3)",letterSpacing:"0.06em" }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
