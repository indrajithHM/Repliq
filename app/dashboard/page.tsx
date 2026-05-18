"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getToken, getRules, getLogs, IgToken, Rule, DmLog } from "@/lib/firebase";
import { ArrowRight, Zap, Link2, BookOpen } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useAuth();
  const [token, setToken]   = useState<IgToken | null>(null);
  const [rules, setRules]   = useState<Rule[]>([]);
  const [logs,  setLogs]    = useState<DmLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([getToken(user.uid), getRules(user.uid), getLogs(user.uid)])
      .then(([t, r, l]) => { setToken(t); setRules(r); setLogs(l); })
      .finally(() => setLoading(false));
  }, [user]);

  const sent    = logs.filter(l => l.status==="sent" && l.type==="actual").length;
  const pending = logs.filter(l => l.type==="follow_prompt").length;
  const failed  = logs.filter(l => l.status==="failed").length;
  const active  = rules.filter(r => r.active).length;

  const stats = [
    { label:"DMs Sent",      value:sent,    icon:"✉️",  color:"var(--green)"  },
    { label:"Pending Follow",value:pending, icon:"⏳",  color:"var(--yellow)" },
    { label:"Active Rules",  value:active,  icon:"⚡",  color:"#FF4D6A"       },
    { label:"Failed",        value:failed,  icon:"✕",   color:"var(--text3)"  },
  ];

  const hour = new Date().getHours();
  const greet = hour<12?"morning":hour<18?"afternoon":"evening";

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:24,fontWeight:800,letterSpacing:"-0.03em",marginBottom:6 }}>
          Good {greet} 👋
        </h1>
        <p style={{ color:"var(--text2)",fontSize:13 }}>
          {token ? `Connected as @${token.ig_username}` : "Connect your Instagram account to get started"}
        </p>
      </div>

      {!loading && !token && (
        <div style={{ background:"rgba(255,77,106,0.07)",border:"1px solid rgba(255,77,106,0.2)",
          borderRadius:14,padding:"16px 18px",marginBottom:20,
          display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap" }}>
          <div>
            <div style={{ fontWeight:700,marginBottom:3,fontSize:14 }}>Instagram not connected</div>
            <div style={{ color:"var(--text2)",fontSize:13 }}>Connect your account to start automating DMs</div>
          </div>
          <Link href="/dashboard/connect" style={{ textDecoration:"none" }}>
            <button className="btn-primary">Connect IG <ArrowRight size={14}/></button>
          </Link>
        </div>
      )}

      {/* Stats grid — 2×2 on mobile, 4×1 on desktop */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20 }} className="stats-grid">
        {stats.map(s => (
          <div key={s.label} className="card-sm" style={{ padding:"14px 16px" }}>
            <div style={{ fontSize:18,marginBottom:6 }}>{s.icon}</div>
            <div style={{ fontSize:26,fontWeight:800,color:s.color,letterSpacing:"-0.03em",marginBottom:2 }}>
              {loading ? <div className="skeleton" style={{ width:36,height:24,borderRadius:6 }}/> : s.value}
            </div>
            <div style={{ fontSize:10,color:"var(--text3)",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions + Recent DMs — stack on mobile */}
      <div style={{ display:"grid",gap:14 }} className="bottom-grid">
        <div className="card">
          <div style={{ fontWeight:700,fontSize:15,marginBottom:14 }}>Quick actions</div>
          {[
            { href:"/dashboard/rules", icon:<Zap size={14}/>,    label:"New AutoDM rule",   sub:"Set up keyword triggers" },
            { href:"/dashboard/bio",   icon:<Link2 size={14}/>,   label:"Manage bio links",  sub:"Add links to your page"  },
            { href:"/dashboard/logs",  icon:<BookOpen size={14}/>, label:"View DM logs",     sub:"See all sent messages"   },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{ textDecoration:"none" }}>
              <div style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 12px",
                borderRadius:10,marginBottom:6,background:"var(--bg3)",cursor:"pointer",transition:"background 0.15s" }}
                onMouseEnter={e=>(e.currentTarget.style.background="var(--border)")}
                onMouseLeave={e=>(e.currentTarget.style.background="var(--bg3)")}>
                <div style={{ color:"#FF4D6A" }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:1 }}>{item.label}</div>
                  <div style={{ fontSize:11,color:"var(--text3)" }}>{item.sub}</div>
                </div>
                <ArrowRight size={13} style={{ marginLeft:"auto",color:"var(--text3)" }}/>
              </div>
            </Link>
          ))}
        </div>

        <div className="card">
          <div style={{ fontWeight:700,fontSize:15,marginBottom:14,display:"flex",justifyContent:"space-between" }}>
            Recent DMs
            <Link href="/dashboard/logs" style={{ fontSize:12,color:"var(--text3)",textDecoration:"none" }}>View all →</Link>
          </div>
          {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{ height:46,marginBottom:8,borderRadius:8 }}/>) :
           logs.length===0 ? (
            <div style={{ textAlign:"center",padding:"32px 0",color:"var(--text3)",fontSize:13 }}>
              <div style={{ fontSize:28,marginBottom:8 }}>💬</div>
              No DMs sent yet. Create a rule to get started.
            </div>
          ) : logs.slice(0,5).map(log=>(
            <div key={log.id} style={{ display:"flex",alignItems:"center",gap:10,
              padding:"10px 0",borderBottom:"1px solid var(--border)" }}>
              <div style={{ width:32,height:32,borderRadius:"50%",background:"var(--bg3)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0 }}>
                {log.type==="actual"?"✉️":"👤"}
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:1 }}>@{log.commenterUsername}</div>
                <div style={{ fontSize:11,color:"var(--text3)" }}>{log.type==="actual"?"DM sent":"Follow prompt sent"}</div>
              </div>
              <span className={`badge ${log.status==="sent"?"badge-green":"badge-red"}`}>{log.status}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (min-width: 769px) {
          .stats-grid {
            grid-template-columns: repeat(4, 1fr) !important;
          }
          .bottom-grid {
            grid-template-columns: 1fr 1.6fr !important;
          }
        }
      `}</style>
    </div>
  );
}