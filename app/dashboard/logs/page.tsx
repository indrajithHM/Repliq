"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getLogs, DmLog } from "@/lib/firebase";
import { RefreshCw } from "lucide-react";

type Filter = "all" | "actual" | "follow_prompt" | "failed";

export default function LogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<DmLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setLogs(await getLogs(user.uid));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line

  const filtered = logs.filter((l) => {
    if (filter === "all") return true;
    if (filter === "failed") return l.status === "failed";
    return l.type === filter;
  });

  const counts = {
    all: logs.length,
    actual: logs.filter((l) => l.type === "actual").length,
    follow_prompt: logs.filter((l) => l.type === "follow_prompt").length,
    failed: logs.filter((l) => l.status === "failed").length,
  };

  const fmt = (ts: number) =>
    new Date(ts).toLocaleString("en-IN", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });

  const tabs: { key: Filter; label: string }[] = [
    { key: "all",          label: "All"          },
    { key: "actual",       label: "DMs"          },
    { key: "follow_prompt",label: "Follow"       },
    { key: "failed",       label: "Failed"       },
  ];

  return (
    <div className="animate-fade-up">
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22,fontWeight:800,letterSpacing:"-0.03em",marginBottom:4 }}>DM Logs</h1>
          <p style={{ color:"var(--text2)",fontSize:13 }}>Every DM Repliq has sent — with status and type.</p>
        </div>
        <button className="btn-ghost" onClick={load} style={{ gap:6,padding:"8px 14px",fontSize:13 }}>
          <RefreshCw size={13}/>
          Refresh
        </button>
      </div>

      {/* Filter tabs — scrollable on mobile */}
      <div style={{ display:"flex",gap:6,marginBottom:16,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            style={{
              padding:"7px 12px", borderRadius:10, border:"none",
              cursor:"pointer", fontFamily:"var(--font-display)",
              fontWeight:600, fontSize:12, flexShrink:0,
              background: filter === t.key ? "#FF4D6A" : "var(--bg3)",
              color: filter === t.key ? "white" : "var(--text2)",
              transition:"all 0.15s",
            }}
          >
            {t.label}
            <span style={{
              marginLeft:5, fontSize:11, padding:"1px 6px",
              borderRadius:10,
              background: filter === t.key ? "rgba(255,255,255,0.2)" : "var(--border)",
            }}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Table — scrollable on mobile */}
      <div className="card" style={{ padding:0, overflow:"hidden" }}>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
          {/* Header */}
          <div style={{
            display:"grid",
            gridTemplateColumns:"2fr 1fr 1fr 1.4fr 1fr",
            padding:"10px 16px",
            borderBottom:"1px solid var(--border)",
            fontSize:10, fontWeight:700, color:"var(--text3)",
            letterSpacing:"0.09em", textTransform:"uppercase",
            minWidth:480,
          }}>
            <span>User</span>
            <span>Type</span>
            <span>Status</span>
            <span>Time</span>
            <span>Post</span>
          </div>

          {loading ? (
            <div style={{ padding:12 }}>
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="skeleton" style={{ height:44,marginBottom:8,borderRadius:8 }}/>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:"center",padding:"48px 0",color:"var(--text3)" }}>
              <div style={{ fontSize:32,marginBottom:10 }}>📭</div>
              <div style={{ fontSize:14 }}>No {filter === "all" ? "" : filter} logs yet</div>
            </div>
          ) : (
            filtered.map((log, i) => (
              <div
                key={log.id}
                style={{
                  display:"grid",
                  gridTemplateColumns:"2fr 1fr 1fr 1.4fr 1fr",
                  padding:"12px 16px",
                  alignItems:"center",
                  borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                  transition:"background 0.13s",
                  minWidth:480,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg3)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{
                    width:30,height:30,borderRadius:"50%",flexShrink:0,
                    background:"linear-gradient(135deg,#FF4D6A,#FF7A3D)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:12,fontWeight:700,color:"white",
                  }}>
                    {log.commenterUsername?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <span style={{ fontSize:12,fontWeight:600 }}>@{log.commenterUsername}</span>
                </div>
                <span>
                  <span className={`badge ${log.type === "actual" ? "badge-green" : "badge-purple"}`}>
                    {log.type === "actual" ? "DM" : "Follow"}
                  </span>
                </span>
                <span>
                  <span className={`badge ${log.status === "sent" ? "badge-green" : "badge-red"}`}>
                    {log.status}
                  </span>
                </span>
                <span style={{ fontSize:11,color:"var(--text3)" }}>{fmt(log.sentAt)}</span>
                <a
                  href={log.postShortcode ? `https://instagram.com/p/${log.postShortcode}` : (log.postUrl ?? "#")}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:12,color:"#FF4D6A",textDecoration:"none" }}
                >
                  View ↗
                </a>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}