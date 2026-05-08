"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LayoutDashboard, Wifi, ImageIcon, Zap, BookOpen, Link2, LogOut } from "lucide-react";

const NAV = [
  { href: "/dashboard",         icon: LayoutDashboard, label: "Dashboard"    },
  { href: "/dashboard/connect", icon: Wifi,            label: "Connect IG"   },
  { href: "/dashboard/posts",   icon: ImageIcon,       label: "Posts"        },
  { href: "/dashboard/rules",   icon: Zap,             label: "AutoDM Rules" },
  { href: "/dashboard/logs",    icon: BookOpen,        label: "DM Logs"      },
  { href: "/dashboard/bio",     icon: Link2,           label: "Bio & Links"  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logOut } = useAuth();
  const router = useRouter();

  return (
    <aside style={{
      width: 230, flexShrink: 0,
      background: "var(--bg2)", borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      height: "100vh", padding: "20px 12px",
      position: "sticky", top: 0, overflow: "hidden",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", marginBottom: 28 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: "linear-gradient(135deg,#FF4D6A,#FF7A3D)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, boxShadow: "0 4px 14px rgba(255,77,106,0.35)",
        }}>⚡</div>
        <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.03em" }}>
          Repl<span style={{ color: "#FF4D6A" }}>iq</span>
        </span>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active =
            href === "/dashboard"
              ? pathname === href
              : pathname.startsWith(href);
          return (
            <Link key={href} href={href} style={{ textDecoration: "none" }}
              className={`nav-item ${active ? "active" : ""}`}>
              <Icon size={15} />
              {label}
              {label === "Bio & Links" && (
                <span style={{
                  marginLeft: "auto", fontSize: 9, fontWeight: 700,
                  background: "rgba(255,179,0,0.15)", color: "#ffb300",
                  border: "1px solid rgba(255,179,0,0.3)",
                  borderRadius: 20, padding: "2px 7px",
                }}>NEW</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        {user && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", marginBottom: 6,
            background: "var(--bg3)", borderRadius: 10,
          }}>
            {user.photoURL
              ? <img src={user.photoURL} alt="" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
              : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#FF4D6A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  {user.displayName?.[0] ?? "U"}
                </div>
            }
            <div style={{ overflow: "hidden", minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.displayName?.split(" ")[0] ?? "Admin"}
              </div>
              <div style={{ fontSize: 10, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.email}
              </div>
            </div>
          </div>
        )}
        <button className="nav-item"
          onClick={async () => { await logOut(); router.push("/"); }}
          style={{ width: "100%", border: "none", background: "none", cursor: "pointer" }}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  );
}
