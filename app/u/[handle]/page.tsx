"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getHandleData, BioLink, BioGroupWithLinks } from "@/lib/firebase";

export default function PublicBioPage() {
  const params = useParams();
  const handle = params.handle as string;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const [data, setData]       = useState<{ uid: string; groups: BioGroupWithLinks[]; profilePictureUrl?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeGroup, setActiveGroup] = useState<BioGroupWithLinks | null>(null);

  useEffect(() => {
    if (!handle) return;
    getHandleData(handle).then(d => {
      if (!d) setNotFound(true);
      else setData(d);
      setLoading(false);
    });
  }, [handle]);

  if (loading) return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"linear-gradient(135deg,#0f0f1a 0%,#1a1020 100%)",
    }}>
      <div style={{ fontSize:28 }}>⚡</div>
    </div>
  );

  if (notFound || !data) return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"linear-gradient(135deg,#0f0f1a 0%,#1a1020 100%)",
      color:"rgba(255,255,255,0.4)", fontFamily:"sans-serif", fontSize:14,
    }}>
      Page not found
    </div>
  );

  const { uid, groups, profilePictureUrl } = data;
  const username = handle;

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{
          min-height:100vh;
          background:linear-gradient(135deg,#0f0f1a 0%,#1a1020 100%);
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
          -webkit-font-smoothing:antialiased;
        }
        .page{
          display:flex; justify-content:center;
          padding:48px 16px 96px; min-height:100vh;
        }
        .container{ width:100%; max-width:480px; }

        /* Profile */
        .profile{ text-align:center; margin-bottom:32px; }
        .avatar{
          width:80px; height:80px; border-radius:50%;
          background:linear-gradient(135deg,#FF4D6A,#FF7A3D);
          display:flex; align-items:center; justify-content:center;
          font-size:32px; font-weight:800; color:white;
          margin:0 auto 14px;
          box-shadow:0 8px 32px rgba(255,77,106,0.35);
        }
        .username{ font-size:20px; font-weight:800; color:white; letter-spacing:-0.02em; }

        /* Group cards (index view) */
        .group-card{
          display:flex; align-items:center; justify-content:space-between;
          padding:18px 20px;
          background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.08);
          border-radius:16px;
          cursor:pointer;
          transition:all 0.2s;
          margin-bottom:10px;
          text-decoration:none;
          color:white;
          -webkit-tap-highlight-color:transparent;
        }
        .group-card:hover{
          background:rgba(255,255,255,0.10);
          border-color:rgba(255,77,106,0.4);
          transform:translateY(-1px);
          box-shadow:0 8px 24px rgba(0,0,0,0.25);
        }
        .group-card-left{ display:flex; align-items:center; gap:14px; }
        .group-icon{
          width:44px; height:44px; border-radius:12px;
          background:rgba(255,77,106,0.12);
          border:1px solid rgba(255,77,106,0.2);
          display:flex; align-items:center; justify-content:center;
          font-size:20px; flex-shrink:0;
        }
        .group-name{ font-weight:700; font-size:15px; margin-bottom:3px; }
        .group-sub{ font-size:12px; color:rgba(255,255,255,0.35); }
        .group-arrow{ font-size:18px; color:rgba(255,255,255,0.25); flex-shrink:0; }

        /* Detail view */
        .back-btn{
          display:inline-flex; align-items:center; gap:8px;
          padding:9px 16px;
          background:rgba(255,255,255,0.06);
          border:1px solid rgba(255,255,255,0.1);
          border-radius:10px;
          color:rgba(255,255,255,0.7);
          font-size:13px; font-weight:600;
          cursor:pointer;
          margin-bottom:28px;
          transition:all 0.18s;
          -webkit-tap-highlight-color:transparent;
        }
        .back-btn:hover{
          background:rgba(255,255,255,0.10);
          color:white;
        }
        .detail-heading{
          font-size:22px; font-weight:800; color:white;
          letter-spacing:-0.02em; margin-bottom:6px;
        }
        .detail-sub{
          font-size:13px; color:rgba(255,255,255,0.35);
          margin-bottom:24px;
        }

        /* Link cards */
        .link-card{
          background:rgba(255,255,255,0.06);
          border:1px solid rgba(255,255,255,0.09);
          border-radius:14px; padding:14px 16px;
          display:flex; align-items:center; gap:13px;
          text-decoration:none; color:white;
          transition:all 0.2s;
          margin-bottom:10px;
        }
        .link-card:hover{
          background:rgba(255,255,255,0.11);
          border-color:rgba(255,77,106,0.4);
          transform:translateY(-1px);
          box-shadow:0 8px 24px rgba(0,0,0,0.2);
        }
        .link-icon{
          width:44px; height:44px; border-radius:12px;
          background:rgba(255,255,255,0.08);
          display:flex; align-items:center; justify-content:center;
          font-size:20px; flex-shrink:0;
        }
        .link-text{ flex:1; min-width:0; }
        .link-title{ font-weight:700; font-size:15px; margin-bottom:3px; }
        .link-desc{
          font-size:12px; color:rgba(255,255,255,0.45);
          line-height:1.4; white-space:nowrap;
          overflow:hidden; text-overflow:ellipsis;
        }
        .link-arrow{ font-size:17px; color:rgba(255,255,255,0.25); flex-shrink:0; }

        .empty{
          text-align:center; padding:60px 0;
          color:rgba(255,255,255,0.3); font-size:14px;
        }
        .footer{
          text-align:center; margin-top:48px;
          font-size:12px; color:rgba(255,255,255,0.18);
        }
        .footer a{ color:rgba(255,77,106,0.6); text-decoration:none; }

        /* Slide animation */
        .slide-in{
          animation: slideIn 0.22s ease forwards;
        }
        @keyframes slideIn{
          from{ opacity:0; transform:translateX(18px); }
          to{ opacity:1; transform:translateX(0); }
        }
        .fade-in{
          animation: fadeIn 0.2s ease forwards;
        }
        @keyframes fadeIn{
          from{ opacity:0; transform:translateY(10px); }
          to{ opacity:1; transform:translateY(0); }
        }
      `}</style>

      <div className="page">
        <div className="container">

          {/* Profile — always visible */}
          <div className="profile">
            {profilePictureUrl ? (
              <img
                src={profilePictureUrl}
                alt={username}
                style={{
                  width:80, height:80, borderRadius:"50%",
                  objectFit:"cover", margin:"0 auto 14px", display:"block",
                  boxShadow:"0 8px 32px rgba(255,77,106,0.35)",
                }}
              />
            ) : (
              <div className="avatar">{username?.[0]?.toUpperCase() ?? "?"}</div>
            )}
            <div className="username">@{username}</div>
          </div>

          {/* ── INDEX VIEW: group list ── */}
          {!activeGroup && (
            <div className="fade-in">
              {groups.length === 0 ? (
                <div className="empty">No links added yet</div>
              ) : (
                groups.map((group: BioGroupWithLinks) => {
                  const activeLinks = group.links.filter((l: BioLink) => l.active);
                  // Pick first icon from the group's links as a visual hint
                  const previewIcon = activeLinks[0]?.icon ?? "🔗";
                  return (
                    <div
                      key={group.id}
                      className="group-card"
                      onClick={() => setActiveGroup(group)}
                    >
                      <div className="group-card-left">
                        <div className="group-icon">{previewIcon}</div>
                        <div>
                          <div className="group-name">{group.title}</div>
                          <div className="group-sub">
                            {activeLinks.length} link{activeLinks.length !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                      <div className="group-arrow">→</div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── DETAIL VIEW: links inside a group ── */}
          {activeGroup && (
            <div className="slide-in">
              <button className="back-btn" onClick={() => setActiveGroup(null)}>
                ← Back
              </button>

              <div className="detail-heading">{activeGroup.title}</div>
              <div className="detail-sub">
                {activeGroup.links.filter((l: BioLink) => l.active).length} link
                {activeGroup.links.filter((l: BioLink) => l.active).length !== 1 ? "s" : ""}
              </div>

              {activeGroup.links.filter((l: BioLink) => l.active).length === 0 ? (
                <div className="empty">No links in this group</div>
              ) : (
                activeGroup.links
                  .filter((l: BioLink) => l.active)
                  .map((link: BioLink) => (
                    <a
                      key={link.id}
                      href={`${appUrl}/api/click?uid=${uid}&groupId=${activeGroup.id}&linkId=${link.id}&redirect=${encodeURIComponent(link.url)}`}
                      className="link-card"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <div className="link-icon">{link.icon}</div>
                      <div className="link-text">
                        <div className="link-title">{link.title}</div>
                        {link.description && (
                          <div className="link-desc">{link.description}</div>
                        )}
                      </div>
                      <div className="link-arrow">→</div>
                    </a>
                  ))
              )}
            </div>
          )}

          <div className="footer">
            ⚡ powered by <a href="/">Repliq</a>
          </div>
        </div>
      </div>
    </>
  );
}