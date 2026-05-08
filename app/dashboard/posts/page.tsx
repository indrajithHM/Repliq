"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getToken } from "@/lib/firebase";
import { getMedia, InstagramMedia } from "@/lib/instagram";
import { Film, ImageIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PostsPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const [media,   setMedia]   = useState<InstagramMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [noToken, setNoToken] = useState(false);
  const [err,     setErr]     = useState("");

  useEffect(() => {
    if (!user) return;
    getToken(user.uid).then(async t => {
      if (!t) { setNoToken(true); setLoading(false); return; }
      try {
        setMedia(await getMedia(t.access_token, t.ig_user_id));
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Failed to load posts");
      }
      setLoading(false);
    });
  }, [user]);

  const handleSelect = (post: InstagramMedia) => {
    localStorage.setItem("selectedPost", JSON.stringify(post));
    router.push(`/dashboard/rules?postId=${post.id}&postUrl=${encodeURIComponent(post.permalink)}`);
  };

  if (noToken) return (
    <div style={{ textAlign:"center",padding:"80px 0" }}>
      <div style={{ fontSize:40,marginBottom:16 }}>📸</div>
      <h2 style={{ fontWeight:800,marginBottom:8 }}>Instagram not connected</h2>
      <p style={{ color:"var(--text2)",marginBottom:24,fontSize:14 }}>Connect your account first to view posts.</p>
      <Link href="/dashboard/connect"><button className="btn-primary">Connect Instagram</button></Link>
    </div>
  );

  if (err) return (
    <div style={{ textAlign:"center",padding:"80px 0",color:"var(--text3)" }}>
      <div style={{ fontSize:36,marginBottom:12 }}>⚠️</div>
      <p>{err}</p>
    </div>
  );

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:26,fontWeight:800,letterSpacing:"-0.03em",marginBottom:6 }}>Your Posts</h1>
        <p style={{ color:"var(--text2)",fontSize:14 }}>Select a post or reel to create an AutoDM rule for it.</p>
      </div>

      {loading ? (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14 }}>
          {Array.from({length:9}).map((_,i) => (
            <div key={i} className="skeleton" style={{ aspectRatio:"1",borderRadius:12 }}/>
          ))}
        </div>
      ) : media.length === 0 ? (
        <div style={{ textAlign:"center",padding:"80px 0",color:"var(--text3)" }}>
          <div style={{ fontSize:40,marginBottom:12 }}>🖼️</div>
          <p>No posts found. Make sure your account has posts.</p>
        </div>
      ) : (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14 }}>
          {media.map(post => {
            const thumb = post.thumbnail_url ?? post.media_url;
            const isVid = post.media_type === "VIDEO";
            return (
              <div key={post.id}
                onClick={() => handleSelect(post)}
                style={{
                  position:"relative",aspectRatio:"1",borderRadius:12,
                  overflow:"hidden",cursor:"pointer",background:"var(--bg3)",
                  border:"1px solid var(--border)",transition:"transform 0.2s,box-shadow 0.2s",
                }}
                onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.35)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}
              >
                {thumb
                  ? <img src={thumb} alt={post.caption?.slice(0,40) ?? "post"} style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
                  : <div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <ImageIcon size={32} color="var(--text3)"/>
                    </div>
                }
                {/* hover overlay */}
                <div className="post-overlay" style={{
                  position:"absolute",inset:0,background:"rgba(0,0,0,0)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  transition:"background 0.2s",
                }}
                  onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background="rgba(0,0,0,0.55)"; }}
                  onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background="rgba(0,0,0,0)"; }}
                >
                  <button className="btn-primary" style={{ fontSize:12,padding:"8px 16px",opacity:0,transition:"opacity 0.2s",pointerEvents:"none" }}>
                    ⚡ Set up AutoDM
                  </button>
                </div>
                {/* media type badge */}
                <div style={{ position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.55)",
                  borderRadius:6,padding:"3px 7px",display:"flex",alignItems:"center",gap:4 }}>
                  {isVid ? <Film size={11} color="white"/> : <ImageIcon size={11} color="white"/>}
                </div>
                {/* caption */}
                {post.caption && (
                  <div style={{ position:"absolute",bottom:0,left:0,right:0,
                    padding:"20px 10px 10px",
                    background:"linear-gradient(transparent,rgba(0,0,0,0.8))",
                    fontSize:11,color:"white",
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                    {post.caption}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        div:hover .post-overlay button { opacity: 1 !important; }
        div:hover .post-overlay { background: rgba(0,0,0,0.55) !important; }
      `}</style>
    </div>
  );
}
