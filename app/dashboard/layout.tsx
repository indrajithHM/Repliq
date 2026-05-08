"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.replace("/"); }, [user, loading, router]);
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
    <div style={{ display:"flex",minHeight:"100vh",background:"var(--bg)" }}>
      <Sidebar />
      <main style={{ flex:1,padding:"32px 36px",overflowY:"auto",maxHeight:"100vh" }}>{children}</main>
    </div>
  );
}
