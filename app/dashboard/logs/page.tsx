"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getLogs, DmLog } from "@/lib/firebase";
import { RefreshCw } from "lucide-react";

type Filter = "all" | "actual" | "follow_prompt" | "failed";

export default function LogsPage() {
  const { user } = useAuth();
  const [logs,    setLogs]    = useState<DmLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<Filter>("all");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setLogs(await getLogs(user.uid));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line

  const filtered = logs.filter(l => {
    if (filter === "all")          return true;
    if (filter === "failed")       return l.status === "failed";
    return l.type === filter;
  });

  const counts = {
    all:          logs.length,
    actual:       logs.filter(l => l.type === "actual").length,
    follow_prompt:logs.filter(l => l.type === "follow_prompt").length,
    failed:       logs.filter(l => l.status === "failed").length,
  };

  const fmt = (ts: number) =>
    new Date(ts).toLocaleString("en-IN", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });

  const tabs: { key: Filter; label: string }[] = [
    { key:"all",           label:"All"           },
    { key:"actual",        label:"DMs sent"      },
    { key:"follow_prompt", label:"Follow prompt" },
    { key:"failed",        label:"Failed"        },
  ];

  return (
    <div className="animate-fade-up">
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:26,fontWeight:800,letterSpacing:"-0.03em",marginBottom:6 }}>DM Logs</h1>
          <p style={{ color:"var(--text2)",fontSize:14 }}>Every DM Repliq has sent — with status and type.</p>
        </div>
        <button className="btn-ghost" onClick={load} style={{ gap:6 }}>
          <RefreshCw size={14}/>Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display:"flex",gap:8,marginBottom:20 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)} style={{
            padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",
            fontFamily:"var(--font-display)",fontWeight:600,fontSize:13,
            background:filter===t.key?"#FF4D6A":"var(--bg3)",
            color:filter===t.key?"white":"var(--text2)",
            transition:"all 0.15s",
          }}>
            {t.label}
            <span style={{
              marginLeft:6,fontSize:11,padding:"1px 7px",borderRadius:10,
              background:filter===t.key?"rgba(255,255,255,0.2)":"var(--border)",
            }}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0,overflow:"hidden" }}>
        {/* Header */}
        <div style={{
          display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1.4fr 1fr",
          padding:"11px 20px",borderBottom:"1px solid var(--border)",
          fontSize:10,fontWeight:700,color:"var(--text3)",letterSpacing:"0.09em",textTransform:"uppercase",
        }}>
          <span>User</span><span>Type</span><span>Status</span><span>Time</span><span>Post</span>
        </div>

        {loading
          ? <div style={{ padding:16 }}>
              {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height:48,marginBottom:8,borderRadius:8 }}/>)}
            </div>
          : filtered.length === 0
          ? <div style={{ textAlign:"center",padding:"56px 0",color:"var(--text3)" }}>
              <div style={{ fontSize:34,marginBottom:10 }}>📭</div>
              <div style={{ fontSize:14 }}>No {filter === "all" ? "" : filter} logs yet</div>
            </div>
          : filtered.map((log, i) => (
              <div key={log.id} style={{
                display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1.4fr 1fr",
                padding:"13px 20px",alignItems:"center",
                borderBottom:i < filtered.length-1 ? "1px solid var(--border)" : "none",
                transition:"background 0.13s",cursor:"default",
              }}
                onMouseEnter={e=>(e.currentTarget.style.background="var(--bg3)")}
                onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
              >
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <div style={{
                    width:32,height:32,borderRadius:"50%",flexShrink:0,
                    background:"linear-gradient(135deg,#FF4D6A,#FF7A3D)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:13,fontWeight:700,color:"white",
                  }}>
                    {log.commenterUsername?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <span style={{ fontSize:13,fontWeight:600 }}>@{log.commenterUsername}</span>
                </div>
                <span>
                  <span className={`badge ${log.type==="actual"?"badge-green":"badge-purple"}`}>
                    {log.type==="actual"?"DM":"Follow ask"}
                  </span>
                </span>
                <span>
                  <span className={`badge ${log.status==="sent"?"badge-green":"badge-red"}`}>
                    {log.status}
                  </span>
                </span>
                <span style={{ fontSize:12,color:"var(--text3)" }}>{fmt(log.sentAt)}</span>
                <a href={`https://instagram.com/p/${log.postId}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:12,color:"#FF4D6A",textDecoration:"none" }}>
                  View ↗
                </a>
              </div>
            ))
        }
      </div>
    </div>
  );
}
