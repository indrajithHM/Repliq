import { getHandleData, BioLink, BioGroupWithLinks } from "@/lib/firebase";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Links" };

export default async function PublicBioPage({
  params,
}: {
  params: { handle: string };
}) {
  const data = await getHandleData(params.handle);
  if (!data) notFound();

 const { uid, groups, profilePictureUrl } = data;
const username = params.handle;
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "";
  // app/u/[handle]/page.tsx


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
          display:flex;justify-content:center;
          padding:48px 16px 96px;min-height:100vh;
        }
        .container{width:100%;max-width:480px;}

        /* Profile */
        .profile{text-align:center;margin-bottom:36px;}
        .avatar{
          width:80px;height:80px;border-radius:50%;
          background:linear-gradient(135deg,#FF4D6A,#FF7A3D);
          display:flex;align-items:center;justify-content:center;
          font-size:32px;font-weight:800;color:white;
          margin:0 auto 14px;
          box-shadow:0 8px 32px rgba(255,77,106,0.35);
        }
        .username{font-size:20px;font-weight:800;color:white;letter-spacing:-0.02em;}

        /* Groups */
        .group{margin-bottom:28px;}
        .group-label{
          font-size:11px;font-weight:700;letter-spacing:0.1em;
          text-transform:uppercase;color:rgba(255,255,255,0.3);
          margin-bottom:10px;padding-left:4px;
        }
        .links{display:flex;flex-direction:column;gap:10px;}

        /* Link cards */
        .link-card{
          background:rgba(255,255,255,0.07);
          border:1px solid rgba(255,255,255,0.1);
          border-radius:16px;padding:15px 18px;
          display:flex;align-items:center;gap:14px;
          text-decoration:none;color:white;
          transition:all 0.2s;
        }
        .link-card:hover{
          background:rgba(255,255,255,0.12);
          border-color:rgba(255,77,106,0.4);
          transform:translateY(-1px);
          box-shadow:0 8px 24px rgba(0,0,0,0.25);
        }
        .link-icon{
          width:44px;height:44px;border-radius:12px;
          background:rgba(255,255,255,0.1);
          display:flex;align-items:center;justify-content:center;
          font-size:20px;flex-shrink:0;
        }
        .link-text{flex:1;min-width:0;}
        .link-title{font-weight:700;font-size:15px;margin-bottom:3px;}
        .link-desc{
          font-size:12px;color:rgba(255,255,255,0.5);line-height:1.4;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        }
        .link-arrow{font-size:17px;color:rgba(255,255,255,0.3);flex-shrink:0;}

        .empty{text-align:center;padding:60px 0;color:rgba(255,255,255,0.3);font-size:14px;}
        .footer{text-align:center;margin-top:48px;font-size:12px;color:rgba(255,255,255,0.18);}
        .footer a{color:rgba(255,77,106,0.6);text-decoration:none;}
      `}</style>

      <div className="page">
        <div className="container">

          {/* Profile */}
          <div className="profile">
            // Before
<div className="avatar">{username?.[0]?.toUpperCase() ?? "?"}</div>


{profilePictureUrl ? (
  <img
    src={profilePictureUrl}
    alt={username}
    style={{
      width: 80, height: 80, borderRadius: "50%",
      objectFit: "cover", margin: "0 auto 14px", display: "block",
      boxShadow: "0 8px 32px rgba(255,77,106,0.35)"
    }}
  />
) : (
  <div className="avatar">{username?.[0]?.toUpperCase() ?? "?"}</div>
)}
            <div className="username">@{username}</div>
          </div>

          {/* Groups with links */}
          {groups.length === 0 ? (
            <div className="empty">No links added yet</div>
          ) : (
            groups.map((group: BioGroupWithLinks) => (
              <div key={group.id} className="group">
                <div className="group-label">{group.title}</div>
                <div className="links">
                  {group.links.map((link: BioLink) => (
                    <a
                      key={link.id}
                      href={`${appUrl}/api/click?uid=${uid}&groupId=${group.id}&linkId=${link.id}&redirect=${encodeURIComponent(link.url)}`}
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
                  ))}
                </div>
              </div>
            ))
          )}

          <div className="footer">
            ⚡ powered by <a href="/">Repliq</a>
          </div>
        </div>
      </div>
    </>
  );
}