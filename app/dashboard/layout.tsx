"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import SidebarComponent from "@/components/Sidebar";
const Sidebar = SidebarComponent as React.ComponentType<{ onClose?: () => void }>;
import { Menu, X } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { if (!loading && !user) router.replace("/"); }, [user, loading, router]);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, []);

  if (loading) return (
    <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:36,marginBottom:12 }}>⚡</div>
        <div style={{ color:"var(--text2)",fontSize:13 }}>Loading Repliq…</div>
      </div>
    </div>
  );
  if (!user) return null;

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"var(--bg)" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,0.6)",
            zIndex:40, display:"none",
          }}
          className="mobile-overlay"
        />
      )}

      {/* Sidebar — hidden on mobile unless open */}
      <div className={`sidebar-wrapper${sidebarOpen ? " sidebar-open" : ""}`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, maxHeight:"100vh", overflowY:"auto" }}>
        {/* Mobile top bar */}
        <div className="mobile-topbar">
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background:"none", border:"none", color:"var(--text)",
              cursor:"pointer", padding:8, display:"flex", alignItems:"center",
            }}
          >
            <Menu size={22} />
          </button>
          <span style={{ fontWeight:800, fontSize:18, letterSpacing:"-0.03em" }}>
            Repl<span style={{ color:"#FF4D6A" }}>iq</span>
          </span>
          <div style={{ width:38 }} /> {/* spacer */}
        </div>

        <main style={{ flex:1, padding:"24px 20px" }} className="main-content">
          {children}
        </main>
      </div>

      <style>{`
        .sidebar-wrapper {
          flex-shrink: 0;
        }

        .mobile-topbar {
          display: none;
        }

        .mobile-overlay {
          display: none !important;
        }

        @media (max-width: 768px) {
          .sidebar-wrapper {
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            z-index: 50;
            transform: translateX(-100%);
            transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
          }

          .sidebar-wrapper.sidebar-open {
            transform: translateX(0);
          }

          .mobile-topbar {
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid var(--border);
            background: var(--bg2);
            position: sticky;
            top: 0;
            z-index: 30;
          }

          .mobile-overlay {
            display: block !important;
          }

          .main-content {
            padding: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}