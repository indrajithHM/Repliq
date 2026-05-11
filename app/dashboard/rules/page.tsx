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
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:26,fontWeight:800,letterSpacing:"-0.03em",marginBottom:6 }}>AutoDM Rules</h1>
          <p style={{ color:"var(--text2)",fontSize:14 }}>Configure what triggers a DM and what gets sent.</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={14}/>New rule</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom:24,border:"1px solid rgba(255,77,106,0.3)" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
            <div style={{ fontWeight:700,fontSize:16 }}>{editId?"Edit rule":"New rule"}</div>
            <button onClick={()=>{setShowForm(false);setEditId(null);}}
              style={{ background:"none",border:"none",color:"var(--text3)",cursor:"pointer" }}><X size={18}/></button>
          </div>

          <div style={{ marginBottom:18 }}>
            <label className="label">Post</label>
            {form.postId ? (
              <div style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",
                background:"var(--bg3)",borderRadius:10,border:"1px solid var(--border)" }}>
                {form.postThumbnail && (
                  <img src={form.postThumbnail} alt="" style={{ width:40,height:40,borderRadius:6,objectFit:"cover" }}/>
                )}
                <div style={{ fontSize:13,color:"var(--text)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                  {form.postUrl}
                </div>
                <a href="/dashboard/posts">
                  <button className="btn-ghost" style={{ padding:"6px 12px",fontSize:12 }}>Change</button>
                </a>
              </div>
            ) : (
              <a href="/dashboard/posts" style={{ textDecoration:"none" }}>
                <button className="btn-ghost" style={{ width:"100%",justifyContent:"center" }}>
                  <Plus size={14}/>Select a post
                </button>
              </a>
            )}
          </div>

          <div style={{ marginBottom:18 }}>
            <label className="label">Match mode</label>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10 }}>
              {(Object.keys(MODE_INFO) as MatchMode[]).map(mode => {
                const info = MODE_INFO[mode]; const sel = form.matchMode === mode;
                return (
                  <div key={mode} onClick={()=>setForm(f=>({...f,matchMode:mode}))}
                    style={{ padding:"12px 14px",borderRadius:10,cursor:"pointer",
                      border:`1px solid ${sel?info.color:"var(--border)"}`,
                      background:sel?`${info.color}10`:"var(--bg3)",transition:"all 0.15s" }}>
                    <div style={{ fontWeight:700,fontSize:13,color:sel?info.color:"var(--text)",marginBottom:3 }}>{info.label}</div>
                    <div style={{ fontSize:11,color:"var(--text3)",lineHeight:1.4 }}>{info.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {form.matchMode !== "any_comment" && (
            <div style={{ marginBottom:18 }}>
              <label className="label">Keywords</label>
              <div style={{ display:"flex",gap:8,marginBottom:8 }}>
                <input className="input" value={kwInput}
                  onChange={e=>setKwInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&addKw()}
                  placeholder='e.g. "link", "price", "how"'/>
                <button className="btn-ghost" onClick={addKw} style={{ flexShrink:0 }}>Add</button>
              </div>
              <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
                {(form.keywords ?? []).map(kw=>(
                  <span key={kw} style={{ display:"inline-flex",alignItems:"center",gap:6,
                    padding:"4px 12px",borderRadius:20,background:"var(--bg3)",
                    border:"1px solid var(--border)",fontSize:13,color:"var(--text)" }}>
                    {kw}
                    <X size={12} style={{ cursor:"pointer",color:"var(--text3)" }}
                      onClick={()=>setForm(f=>({...f,keywords:(f.keywords??[]).filter(k=>k!==kw)}))}/>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom:18 }}>
            <label className="label">DM message (sent to user)</label>
            <textarea className="textarea" rows={4} value={form.dmTemplate}
              onChange={e=>setForm(f=>({...f,dmTemplate:e.target.value}))}
              placeholder="Hey! Thanks for commenting. Here's what you asked for: https://…"/>
          </div>

          <div style={{ marginBottom:18 }}>
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
                <div style={{ display:"flex",gap:10,alignItems:"center",marginTop:8 }}>
                  <span style={{ fontSize:12,color:"var(--text3)" }}>Delay</span>
                  <input type="number" className="input" style={{ width:72 }}
                    value={form.nudgeDelay} min={1} max={60}
                    onChange={e=>setForm(f=>({...f,nudgeDelay:Number(e.target.value)}))}/>
                  <span style={{ fontSize:12,color:"var(--text3)" }}>seconds after first DM</span>
                </div>
              </>
            )}
          </div>

          <div style={{ display:"flex",gap:12,alignItems:"center",marginBottom:22 }}>
            <label className="label" style={{ margin:0,whiteSpace:"nowrap" }}>Follow-gate expiry</label>
            <input type="number" className="input" style={{ width:72 }}
              value={form.pendingExpiry} min={1} max={168}
              onChange={e=>setForm(f=>({...f,pendingExpiry:Number(e.target.value)}))}/>
            <span style={{ fontSize:12,color:"var(--text3)" }}>hours (non-followers must follow within this time)</span>
          </div>

          <div style={{ display:"flex",gap:10 }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving?"Saving…":editId?"Update rule":"Create rule"}
            </button>
            <button className="btn-ghost" onClick={()=>{setShowForm(false);setEditId(null);}}>Cancel</button>
          </div>
        </div>
      )}

      {loading
        ? [1,2,3].map(i=><div key={i} className="skeleton" style={{ height:88,borderRadius:12,marginBottom:10 }}/>)
        : rules.length===0&&!showForm
        ? <div style={{ textAlign:"center",padding:"80px 0",color:"var(--text3)" }}>
            <div style={{ fontSize:40,marginBottom:12 }}>⚡</div>
            <div style={{ fontWeight:700,fontSize:15,color:"var(--text2)",marginBottom:6 }}>No rules yet</div>
            <p style={{ fontSize:13 }}>Create your first rule to start automating DMs.</p>
          </div>
        : <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {rules.map(rule=>{
              const info = MODE_INFO[rule.matchMode];
              const keywords = rule.keywords ?? [];
              return (
                <div key={rule.id} className="card" style={{ padding:"16px 18px",opacity:rule.active?1:0.55 }}>
                  <div style={{ display:"flex",alignItems:"flex-start",gap:14 }}>
                    {rule.postThumbnail && (
                      <img src={rule.postThumbnail} alt="" style={{ width:48,height:48,borderRadius:8,objectFit:"cover",flexShrink:0 }}/>
                    )}
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap" }}>
                        <span className="badge" style={{ background:`${info.color}18`,color:info.color,border:`1px solid ${info.color}33` }}>
                          {info.label}
                        </span>
                        {keywords.slice(0,4).map(kw=>(
                          <span key={kw} style={{ fontSize:12,padding:"2px 10px",borderRadius:20,
                            background:"var(--bg3)",color:"var(--text2)",border:"1px solid var(--border)" }}>{kw}</span>
                        ))}
                        {keywords.length>4 && (
                          <span style={{ fontSize:12,color:"var(--text3)" }}>+{keywords.length-4} more</span>
                        )}
                      </div>
                      <p style={{ fontSize:13,color:"var(--text2)",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                        ✉️ {rule.dmTemplate}
                      </p>
                      {rule.nudgeEnabled && (
                        <p style={{ fontSize:11,color:"var(--text3)" }}>💫 Nudge · {rule.nudgeDelay}s delay</p>
                      )}
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:8,flexShrink:0 }}>
                      <label className="toggle">
                        <input type="checkbox" checked={rule.active}
                          onChange={()=>updateRule(user!.uid,rule.id!,{active:!rule.active}).then(load)}/>
                        <span className="toggle-slider"/>
                      </label>
                      <button className="btn-ghost" onClick={()=>handleEdit(rule)} style={{ padding:"7px 11px" }}>
                        <Edit2 size={13}/>
                      </button>
                      <button className="btn-ghost" onClick={()=>handleDelete(rule.id!)}
                        style={{ padding:"7px 11px",color:"var(--accent)",borderColor:"rgba(255,77,106,0.3)" }}>
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}

export default function RulesPage() {
  return (
    <Suspense fallback={<div style={{ color:"var(--text2)" }}>Loading…</div>}>
      <RulesInner/>
    </Suspense>
  );
}