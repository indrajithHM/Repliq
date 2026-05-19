"use client";
import { useEffect, useState, Suspense } from "react";
import { useAuth } from "@/lib/auth-context";
import { getRules, saveRule, updateRule, deleteRule, Rule, MatchMode } from "@/lib/firebase";
import { useSearchParams } from "next/navigation";
import { Plus, Trash2, Edit2, X } from "lucide-react";
import { useToast } from "@/components/Toast";

type FormState = Omit<Rule, "id" | "createdAt">;

const DEFAULT: FormState = {
  postId:"", postUrl:"", postThumbnail:"",
  matchMode:"word_match", keywords:[],
  dmTemplate:"", nudgeMessage:"💫 Loved this? Share the post with your friends and don't forget to hit like — it really helps! ❤️",
  nudgeEnabled:true, nudgeDelay:3, pendingExpiry:48, active:true,
  replyEnabled:false, replyTemplate:"Thanks for commenting! Check your DMs 📩",
  ctaEnabled:false, ctaLabel:"", ctaUrl:"",
};

const MODE_INFO: Record<MatchMode,{label:string;desc:string;color:string}> = {
  any_comment: { label:"Any comment", desc:"Trigger on every comment regardless of content", color:"var(--green)"  },
  word_match:  { label:"Word match",  desc:"Comment contains any keyword (case-insensitive)",  color:"var(--yellow)" },
  exact_match: { label:"Exact match", desc:"Comment equals keyword exactly (case-insensitive)", color:"#FF4D6A"      },
};

function RulesInner() {
  const { user } = useAuth();
  const params   = useSearchParams();
  const { show, ToastEl } = useToast();
  const [rules,   setRules]   = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]  = useState<string|null>(null);
  const [form,     setForm]    = useState<FormState>({ ...DEFAULT });
  const [kwInput,  setKwInput] = useState("");
  const [saving,   setSaving]  = useState(false);

  const load = async () => {
    if (!user) return;
    setRules(await getRules(user.uid));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line

  useEffect(() => {
    const postId  = params.get("postId");
    const postUrl = params.get("postUrl");
    if (!postId || !postUrl) return;
    const stored = localStorage.getItem("selectedPost");
    const post   = stored ? JSON.parse(stored) : null;
    setForm(f => ({ ...f, postId, postUrl: decodeURIComponent(postUrl),
      postThumbnail: post?.thumbnail_url ?? post?.media_url ?? "" }));
    setShowForm(true);
  }, [params]);

  const openNew = () => { setForm({ ...DEFAULT }); setEditId(null); setShowForm(true); };

  const handleSave = async () => {
    if (!user) return;
    if (!form.postId) { show("Select a post first","error"); return; }
    if (form.matchMode !== "any_comment" && !(form.keywords ?? []).length) {
      show("Add at least one keyword","error"); return;
    }
    if (!form.dmTemplate.trim()) { show("Enter the DM message","error"); return; }
    setSaving(true);
    try {
      if (editId) {
        await updateRule(user.uid, editId, { ...form, keywords: form.keywords ?? [], createdAt: Date.now() });
        show("Rule updated!","success");
      } else {
        await saveRule(user.uid, { ...form, keywords: form.keywords ?? [], createdAt: Date.now() });
        show("Rule created!","success");
      }
      setShowForm(false); setEditId(null); setForm({ ...DEFAULT }); setKwInput("");
      load();
    } catch (e:unknown) { show(e instanceof Error ? e.message : "Error","error"); }
    setSaving(false);
  };

  const handleEdit = (r:Rule) => {
    setForm({
      postId: r.postId, postUrl: r.postUrl, postThumbnail: r.postThumbnail ?? "",
      matchMode: r.matchMode, keywords: r.keywords ?? [],
      dmTemplate: r.dmTemplate, nudgeMessage: r.nudgeMessage,
      nudgeEnabled: r.nudgeEnabled, nudgeDelay: r.nudgeDelay,
      pendingExpiry: r.pendingExpiry, active: r.active,
      replyEnabled: r.replyEnabled ?? false,
      replyTemplate: r.replyTemplate ?? "Thanks for commenting! Check your DMs 📩",
      ctaEnabled: r.ctaEnabled ?? false,
      ctaLabel: r.ctaLabel ?? "",
      ctaUrl: r.ctaUrl ?? "",
    });
    setEditId(r.id!); setShowForm(true);
  };

  const handleDelete = async (id:string) => {
    if (!user || !confirm("Delete this rule?")) return;
    await deleteRule(user.uid, id); load(); show("Rule deleted","info");
  };

  const addKw = () => {
    const kw = kwInput.trim();
    if (!kw || (form.keywords ?? []).includes(kw)) return;
    setForm(f => ({ ...f, keywords: [...(f.keywords ?? []), kw] }));
    setKwInput("");
  };

  return (
    <div className="animate-fade-up" style={{ maxWidth:860 }}>
      {ToastEl}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22,fontWeight:800,letterSpacing:"-0.03em",marginBottom:4 }}>AutoDM Rules</h1>
          <p style={{ color:"var(--text2)",fontSize:13 }}>Configure what triggers a DM and what gets sent.</p>
        </div>
        <button className="btn-primary" onClick={openNew} style={{ padding:"9px 14px",fontSize:13 }}>
          <Plus size={13}/>New rule
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom:20,border:"1px solid rgba(255,77,106,0.3)" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
            <div style={{ fontWeight:700,fontSize:15 }}>{editId?"Edit rule":"New rule"}</div>
            <button onClick={()=>{setShowForm(false);setEditId(null);}}
              style={{ background:"none",border:"none",color:"var(--text3)",cursor:"pointer" }}><X size={18}/></button>
          </div>

          {/* Post selector */}
          <div style={{ marginBottom:16 }}>
            <label className="label">Post</label>
            {form.postId ? (
              <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",
                background:"var(--bg3)",borderRadius:10,border:"1px solid var(--border)",flexWrap:"wrap" }}>
                {form.postThumbnail && (
                  <img src={form.postThumbnail} alt="" style={{ width:38,height:38,borderRadius:6,objectFit:"cover",flexShrink:0 }}/>
                )}
                <div style={{ fontSize:12,color:"var(--text)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0 }}>
                  {form.postUrl}
                </div>
                <a href="/dashboard/posts">
                  <button className="btn-ghost" style={{ padding:"5px 10px",fontSize:12,flexShrink:0 }}>Change</button>
                </a>
              </div>
            ) : (
              <a href="/dashboard/posts" style={{ textDecoration:"none" }}>
                <button className="btn-ghost" style={{ width:"100%",justifyContent:"center" }}>
                  <Plus size={13}/>Select a post
                </button>
              </a>
            )}
          </div>

          {/* Match mode */}
          <div style={{ marginBottom:16 }}>
            <label className="label">Match mode</label>
            <div className="match-mode-grid">
              {(Object.keys(MODE_INFO) as MatchMode[]).map(mode => {
                const info = MODE_INFO[mode]; const sel = form.matchMode === mode;
                return (
                  <div key={mode} onClick={()=>setForm(f=>({...f,matchMode:mode}))}
                    style={{ padding:"11px 12px",borderRadius:10,cursor:"pointer",
                      border:`1px solid ${sel?info.color:"var(--border)"}`,
                      background:sel?`${info.color}10`:"var(--bg3)",transition:"all 0.15s" }}>
                    <div style={{ fontWeight:700,fontSize:12,color:sel?info.color:"var(--text)",marginBottom:2 }}>{info.label}</div>
                    <div style={{ fontSize:11,color:"var(--text3)",lineHeight:1.4 }}>{info.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Keywords */}
          {form.matchMode !== "any_comment" && (
            <div style={{ marginBottom:16 }}>
              <label className="label">Keywords</label>
              <div style={{ display:"flex",gap:8,marginBottom:8 }}>
                <input className="input" value={kwInput}
                  onChange={e=>setKwInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&addKw()}
                  placeholder='e.g. "link", "price", "how"'/>
                <button className="btn-ghost" onClick={addKw} style={{ flexShrink:0 }}>Add</button>
              </div>
              <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
                {(form.keywords ?? []).map(kw=>(
                  <span key={kw} style={{ display:"inline-flex",alignItems:"center",gap:5,
                    padding:"4px 10px",borderRadius:20,background:"var(--bg3)",
                    border:"1px solid var(--border)",fontSize:12,color:"var(--text)" }}>
                    {kw}
                    <X size={11} style={{ cursor:"pointer",color:"var(--text3)" }}
                      onClick={()=>setForm(f=>({...f,keywords:(f.keywords??[]).filter(k=>k!==kw)}))}/>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* DM message */}
          <div style={{ marginBottom:16 }}>
            <label className="label">DM message (sent to user)</label>
            <textarea className="textarea" rows={4} value={form.dmTemplate}
              onChange={e=>setForm(f=>({...f,dmTemplate:e.target.value}))}
              placeholder="Hey! Thanks for commenting. Here's what you asked for: https://…"/>
          </div>

          {/* CTA Button */}
          <div style={{ marginBottom:16 }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
              <div>
                <label className="label" style={{ margin:0 }}>CTA Button</label>
                <p style={{ fontSize:11,color:"var(--text3)",marginTop:2 }}>
                  Shows as a tappable button in the DM (e.g. &quot;Best Funds&quot;)
                </p>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={form.ctaEnabled ?? false}
                  onChange={e=>setForm(f=>({...f,ctaEnabled:e.target.checked}))}/>
                <span className="toggle-slider"/>
              </label>
            </div>
            {form.ctaEnabled && (
              <>
                <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:10 }}>
                  <input className="input" value={form.ctaLabel ?? ""}
                    onChange={e=>setForm(f=>({...f,ctaLabel:e.target.value}))}
                    placeholder="Button label e.g. Best Funds, Get the link"/>
                  <input className="input" value={form.ctaUrl ?? ""}
                    onChange={e=>setForm(f=>({...f,ctaUrl:e.target.value}))}
                    placeholder="https://…"/>
                </div>
                {/* Live preview */}
                <div style={{ padding:"12px 14px",background:"#1a1a2e",borderRadius:12,
                  border:"1px solid var(--border)" }}>
                  <div style={{ fontSize:10,color:"var(--text3)",marginBottom:8,letterSpacing:"0.06em",
                    textTransform:"uppercase",fontWeight:700 }}>Instagram DM preview</div>
                  <div style={{ background:"#2a2a3e",borderRadius:10,padding:"12px 14px",marginBottom:8 }}>
                    <p style={{ fontSize:13,color:"white",lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:0 }}>
                      {form.dmTemplate || <span style={{ color:"rgba(255,255,255,0.3)",fontStyle:"italic" }}>Your DM message will appear here…</span>}
                    </p>
                  </div>
                  {form.ctaLabel && (
                    <div style={{ background:"#3a3a4e",border:"1px solid rgba(255,255,255,0.1)",
                      borderRadius:8,padding:"11px 16px",textAlign:"center",
                      fontWeight:700,fontSize:14,color:"white",letterSpacing:"0.01em" }}>
                      {form.ctaLabel}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>



          {/* Public comment reply */}
          <div style={{ marginBottom:16 }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
              <div>
                <label className="label" style={{ margin:0 }}>Public comment reply</label>
                <p style={{ fontSize:11,color:"var(--text3)",marginTop:2 }}>
                  Visible reply posted under the comment
                </p>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={form.replyEnabled}
                  onChange={e=>setForm(f=>({...f,replyEnabled:e.target.checked}))}/>
                <span className="toggle-slider"/>
              </label>
            </div>
            {form.replyEnabled && (
              <input className="input" value={form.replyTemplate}
                onChange={e=>setForm(f=>({...f,replyTemplate:e.target.value}))}
                placeholder="e.g. Thanks for commenting! Check your DMs 📩"
                maxLength={1000}/>
            )}
          </div>

          {/* Engagement nudge */}
          <div style={{ marginBottom:16 }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
              <label className="label" style={{ margin:0 }}>Engagement nudge (2nd DM)</label>
              <label className="toggle">
                <input type="checkbox" checked={form.nudgeEnabled}
                  onChange={e=>setForm(f=>({...f,nudgeEnabled:e.target.checked}))}/>
                <span className="toggle-slider"/>
              </label>
            </div>
            {form.nudgeEnabled && (
              <>
                <textarea className="textarea" rows={2} value={form.nudgeMessage}
                  onChange={e=>setForm(f=>({...f,nudgeMessage:e.target.value}))}/>
                <div style={{ display:"flex",gap:10,alignItems:"center",marginTop:8,flexWrap:"wrap" }}>
                  <span style={{ fontSize:12,color:"var(--text3)" }}>Delay</span>
                  <input type="number" className="input" style={{ width:68 }}
                    value={form.nudgeDelay} min={1} max={60}
                    onChange={e=>setForm(f=>({...f,nudgeDelay:Number(e.target.value)}))}/>
                  <span style={{ fontSize:12,color:"var(--text3)" }}>seconds after first DM</span>
                </div>
              </>
            )}
          </div>

          {/* Follow-gate expiry */}
          <div style={{ display:"flex",gap:10,alignItems:"center",marginBottom:20,flexWrap:"wrap" }}>
            <label className="label" style={{ margin:0,whiteSpace:"nowrap" }}>Follow-gate expiry</label>
            <input type="number" className="input" style={{ width:68 }}
              value={form.pendingExpiry} min={1} max={168}
              onChange={e=>setForm(f=>({...f,pendingExpiry:Number(e.target.value)}))}/>
            <span style={{ fontSize:12,color:"var(--text3)" }}>hours (non-followers must follow within this time)</span>
          </div>

          <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving}
              style={{ flex:1,justifyContent:"center" }}>
              {saving?"Saving…":editId?"Update rule":"Create rule"}
            </button>
            <button className="btn-ghost" onClick={()=>{setShowForm(false);setEditId(null);}}>Cancel</button>
          </div>
        </div>
      )}

      {loading
        ? [1,2,3].map(i=><div key={i} className="skeleton" style={{ height:80,borderRadius:12,marginBottom:10 }}/>)
        : rules.length===0&&!showForm
        ? <div style={{ textAlign:"center",padding:"64px 0",color:"var(--text3)" }}>
            <div style={{ fontSize:36,marginBottom:12 }}>⚡</div>
            <div style={{ fontWeight:700,fontSize:15,color:"var(--text2)",marginBottom:6 }}>No rules yet</div>
            <p style={{ fontSize:13 }}>Create your first rule to start automating DMs.</p>
          </div>
        : <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {rules.map(rule=>{
              const info = MODE_INFO[rule.matchMode];
              const keywords = rule.keywords ?? [];
              return (
                <div key={rule.id} className="card" style={{ padding:"14px 16px",opacity:rule.active?1:0.55 }}>
                  <div style={{ display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap" }}>
                    {rule.postThumbnail && (
                      <img src={rule.postThumbnail} alt="" style={{ width:44,height:44,borderRadius:8,objectFit:"cover",flexShrink:0 }}/>
                    )}
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap" }}>
                        <span className="badge" style={{ background:`${info.color}18`,color:info.color,border:`1px solid ${info.color}33` }}>
                          {info.label}
                        </span>
                        {keywords.slice(0,3).map(kw=>(
                          <span key={kw} style={{ fontSize:11,padding:"2px 8px",borderRadius:20,
                            background:"var(--bg3)",color:"var(--text2)",border:"1px solid var(--border)" }}>{kw}</span>
                        ))}
                        {keywords.length>3 && (
                          <span style={{ fontSize:11,color:"var(--text3)" }}>+{keywords.length-3} more</span>
                        )}
                      </div>
                      <p style={{ fontSize:12,color:"var(--text2)",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                        ✉️ {rule.dmTemplate}
                      </p>
                      {rule.replyEnabled && rule.replyTemplate && (
                        <p style={{ fontSize:11,color:"var(--text3)",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                          💬 {rule.replyTemplate.length > 45 ? rule.replyTemplate.slice(0,45)+"…" : rule.replyTemplate}
                        </p>
                      )}
                      {rule.nudgeEnabled && (
                        <p style={{ fontSize:11,color:"var(--text3)" }}>💫 Nudge · {rule.nudgeDelay}s delay</p>
                      )}
                      {rule.ctaLabel && (
                        <div style={{ marginTop:6,display:"inline-block",background:"var(--bg3)",
                          border:"1px solid var(--border2)",borderRadius:6,
                          padding:"4px 12px",fontSize:11,fontWeight:700,color:"var(--text2)" }}>
                          🔗 {rule.ctaLabel}
                        </div>
                      )}
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:6,flexShrink:0 }}>
                      <label className="toggle">
                        <input type="checkbox" checked={rule.active}
                          onChange={()=>updateRule(user!.uid,rule.id!,{active:!rule.active}).then(load)}/>
                        <span className="toggle-slider"/>
                      </label>
                      <button className="btn-ghost" onClick={()=>handleEdit(rule)} style={{ padding:"6px 10px" }}>
                        <Edit2 size={12}/>
                      </button>
                      <button className="btn-ghost" onClick={()=>handleDelete(rule.id!)}
                        style={{ padding:"6px 10px",color:"var(--accent)",borderColor:"rgba(255,77,106,0.3)" }}>
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      }

      <style>{`
        .match-mode-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
        }

        @media (max-width: 540px) {
          .match-mode-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
}

export default function RulesPage() {
  return (
    <Suspense fallback={<div style={{ color:"var(--text2)",padding:16 }}>Loading…</div>}>
      <RulesInner/>
    </Suspense>
  );
}