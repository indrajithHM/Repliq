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
    <div style={{ textAlign:"center",padding:"64px 16px" }}>
      <div style={{ fontSize:40,marginBottom:14 }}>📸</div>
      <h2 style={{ fontWeight:800,marginBottom:8,fontSize:20 }}>Instagram not connected</h2>
      <p style={{ color:"var(--text2)",marginBottom:20,fontSize:13 }}>Connect your account first to view posts.</p>
      <Link href="/dashboard/connect"><button className="btn-primary">Connect Instagram</button></Link>
    </div>
  );

  if (err) return (
    <div style={{ textAlign:"center",padding:"64px 16px",color:"var(--text3)" }}>
      <div style={{ fontSize:34,marginBottom:12 }}>⚠️</div>
      <p style={{ fontSize:14 }}>{err}</p>
    </div>
  );

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22,fontWeight:800,letterSpacing:"-0.03em",marginBottom:4 }}>Your Posts</h1>
        <p style={{ color:"var(--text2)",fontSize:13 }}>Select a post or reel to create an AutoDM rule.</p>
      </div>

      {loading ? (
        <div className="posts-grid">
          {Array.from({length:9}).map((_,i) => (
            <div key={i} className="skeleton" style={{ aspectRatio:"1",borderRadius:12 }}/>
          ))}
        </div>
      ) : media.length === 0 ? (
        <div style={{ textAlign:"center",padding:"64px 0",color:"var(--text3)" }}>
          <div style={{ fontSize:36,marginBottom:12 }}>🖼️</div>
          <p style={{ fontSize:14 }}>No posts found. Make sure your account has posts.</p>
        </div>
      ) : (
        <div className="posts-grid">
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
                      <ImageIcon size={28} color="var(--text3)"/>
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
                  <button className="btn-primary" style={{ fontSize:11,padding:"7px 14px",opacity:0,transition:"opacity 0.2s",pointerEvents:"none" }}>
                    ⚡ Set up AutoDM
                  </button>
                </div>
                {/* media type badge */}
                <div style={{ position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.55)",
                  borderRadius:6,padding:"3px 6px",display:"flex",alignItems:"center",gap:3 }}>
                  {isVid ? <Film size={10} color="white"/> : <ImageIcon size={10} color="white"/>}
                </div>
                {/* caption */}
                {post.caption && (
                  <div style={{ position:"absolute",bottom:0,left:0,right:0,
                    padding:"18px 8px 8px",
                    background:"linear-gradient(transparent,rgba(0,0,0,0.8))",
                    fontSize:10,color:"white",
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
        .posts-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        @media (max-width: 480px) {
          .posts-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }
        }

        div:hover .post-overlay button { opacity: 1 !important; }
        div:hover .post-overlay { background: rgba(0,0,0,0.55) !important; }
      `}</style>
    </div>
  );
}