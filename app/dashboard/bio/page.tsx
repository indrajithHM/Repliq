"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getGroupsWithLinks, saveGroup, updateGroup, deleteGroup,
  saveGroupLink, updateGroupLink, deleteGroupLink,
  getToken, BioGroup, BioLink, BioGroupWithLinks,
} from "@/lib/firebase";
import {
  Plus, Trash2, Edit2, X,
  Copy, Check, GripVertical, ExternalLink,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { useToast } from "@/components/Toast";

const ICONS = ["🔗","🎨","📱","🎓","📬","🎯","🚀","💼","🎥","📸","🛍️","🎵","📝","💡","⭐","🔥"];

type LinkForm = Omit<BioLink, "id" | "clicks">;
const EMPTY_LINK: LinkForm = { title:"", description:"", url:"", icon:"🔗", order:0, active:true };

export default function BioPage() {
  const { user } = useAuth();
  const { show, ToastEl } = useToast();

  const [groups,   setGroups]   = useState<BioGroupWithLinks[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [handle,   setHandle]   = useState("");
  const [copied,   setCopied]   = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Group form state
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editGroupId,   setEditGroupId]   = useState<string | null>(null);
  const [groupTitle,    setGroupTitle]    = useState("");
  const [savingGroup,   setSavingGroup]   = useState(false);

  // Link form state
  const [showLinkForm,      setShowLinkForm]      = useState(false);
  const [editLinkId,        setEditLinkId]        = useState<string | null>(null);
  const [activeLinkGroupId, setActiveLinkGroupId] = useState<string | null>(null);
  const [linkForm,          setLinkForm]          = useState<LinkForm>({ ...EMPTY_LINK });
  const [savingLink,        setSavingLink]        = useState(false);

  // Drag state
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  /* ── Load ── */
  const load = async () => {
    if (!user) return;
    const [g, t] = await Promise.all([getGroupsWithLinks(user.uid), getToken(user.uid)]);
    setGroups(g);
    if (t?.ig_username) setHandle(t.ig_username);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]); // eslint-disable-line

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bioUrl = `${origin}/u/${handle}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(bioUrl);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    show("Bio link copied!", "success");
  };

  const toggleCollapse = (id: string) =>
    setCollapsed(c => ({ ...c, [id]: !c[id] }));

  /* ══ Group actions ══ */
  const openNewGroup = () => {
    setGroupTitle(""); setEditGroupId(null); setShowGroupForm(true);
  };
  const openEditGroup = (g: BioGroup) => {
    setGroupTitle(g.title); setEditGroupId(g.id!); setShowGroupForm(true);
  };
  const closeGroupForm = () => {
    setShowGroupForm(false); setGroupTitle(""); setEditGroupId(null);
  };

  const handleSaveGroup = async () => {
    if (!user || !groupTitle.trim()) { show("Enter a group name", "error"); return; }
    setSavingGroup(true);
    try {
      if (editGroupId) {
        await updateGroup(user.uid, editGroupId, { title: groupTitle });
        show("Group renamed!", "success");
      } else {
        await saveGroup(user.uid, { title: groupTitle, order: groups.length, active: true });
        show("Group created!", "success");
      }
      closeGroupForm(); load();
    } catch (e: unknown) { show(e instanceof Error ? e.message : "Error saving group", "error"); }
    setSavingGroup(false);
  };

  const handleDeleteGroup = async (id: string) => {
    if (!user) return;
    if (!confirm("Delete this group and all its links?")) return;
    await deleteGroup(user.uid, id);
    load(); show("Group deleted", "info");
  };

  const handleToggleGroup = async (g: BioGroupWithLinks) => {
    if (!user) return;
    await updateGroup(user.uid, g.id!, { active: !g.active });
    load();
  };

  /* ══ Link actions ══ */
  const openNewLink = (groupId: string) => {
    const grp = groups.find(g => g.id === groupId);
    setLinkForm({ ...EMPTY_LINK, order: grp?.links.length ?? 0 });
    setEditLinkId(null);
    setActiveLinkGroupId(groupId);
    setShowLinkForm(true);
  };

  const openEditLink = (groupId: string, link: BioLink) => {
    setLinkForm({
      title: link.title, description: link.description,
      url: link.url, icon: link.icon,
      order: link.order, active: link.active,
    });
    setEditLinkId(link.id!);
    setActiveLinkGroupId(groupId);
    setShowLinkForm(true);
  };

  const closeLinkForm = () => {
    setShowLinkForm(false); setEditLinkId(null); setActiveLinkGroupId(null);
    setLinkForm({ ...EMPTY_LINK });
  };

  const handleSaveLink = async () => {
    if (!user || !activeLinkGroupId) return;
    if (!linkForm.title.trim())           { show("Enter a title", "error"); return; }
    if (!linkForm.url.trim())             { show("Enter a URL", "error"); return; }
    if (!linkForm.url.startsWith("http")) { show("URL must start with https://", "error"); return; }
    setSavingLink(true);
    try {
      if (editLinkId) {
        await updateGroupLink(user.uid, activeLinkGroupId, editLinkId, linkForm);
        show("Link updated!", "success");
      } else {
        await saveGroupLink(user.uid, activeLinkGroupId, linkForm);
        show("Link added!", "success");
      }
      closeLinkForm(); load();
    } catch (e: unknown) { show(e instanceof Error ? e.message : "Error saving link", "error"); }
    setSavingLink(false);
  };

  const handleDeleteLink = async (groupId: string, linkId: string) => {
    if (!user || !confirm("Delete this link?")) return;
    await deleteGroupLink(user.uid, groupId, linkId);
    load(); show("Link removed", "info");
  };

  const handleToggleLink = async (groupId: string, link: BioLink) => {
    if (!user) return;
    await updateGroupLink(user.uid, groupId, link.id!, { active: !link.active });
    load();
  };

  /* ══ Drag reorder links within a group ══ */
  const handleLinkDrop = async (groupId: string, targetLinkId: string) => {
    if (!user || !dragging || dragging === targetLinkId) return;
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const from = group.links.findIndex(l => l.id === dragging);
    const to   = group.links.findIndex(l => l.id === targetLinkId);
    if (from === -1 || to === -1) return;
    const reordered = [...group.links];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const updated = reordered.map((l, i) => ({ ...l, order: i }));
    // Optimistic update
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, links: updated } : g));
    await Promise.all(updated.map(l =>
      updateGroupLink(user.uid, groupId, l.id!, { order: l.order })
    ));
    setDragging(null); setDragOver(null);
  };

  /* ══ Preview helpers ══ */
  const previewGroups = groups.filter(g => g.active && g.links.some(l => l.active));
  const totalLinks    = groups.reduce((s, g) => s + g.links.length, 0);
  const totalActive   = groups.reduce((s, g) => s + g.links.filter(l => l.active).length, 0);
  const totalClicks   = groups.reduce((s, g) => s + g.links.reduce((ls, l) => ls + (l.clicks || 0), 0), 0);

  /* ══ Render ══ */
  return (
    <div className="animate-fade-up" style={{ display:"grid", gridTemplateColumns:"1fr 290px", gap:28 }}>
      {ToastEl}

      {/* ── LEFT: Admin panel ── */}
      <div>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div>
            <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.03em", marginBottom:6 }}>Bio & Links</h1>
            <p style={{ color:"var(--text2)", fontSize:14 }}>Organise your links into groups. Visitors see them all on your bio page.</p>
          </div>
          <button className="btn-primary" onClick={openNewGroup}><Plus size={14}/>New group</button>
        </div>

        {/* Bio URL bar */}
        {handle && (
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 16px", marginBottom:20,
            background:"rgba(255,179,0,0.07)", border:"1px solid rgba(255,179,0,0.25)", borderRadius:12 }}>
            <span style={{ fontSize:16 }}>🔗</span>
            <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text)", flex:1,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{bioUrl}</span>
            <button className="btn-ghost" onClick={handleCopy} style={{ padding:"6px 12px", fontSize:12, flexShrink:0 }}>
              {copied ? <><Check size={12}/>Copied</> : <><Copy size={12}/>Copy</>}
            </button>
            <a href={bioUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost"
              style={{ padding:"6px 10px", textDecoration:"none" }}>
              <ExternalLink size={13}/>
            </a>
          </div>
        )}

        {/* Stats */}
        <div style={{ display:"flex", gap:12, marginBottom:20 }}>
          {[
            { label:"Groups",       value:groups.length, color:"var(--text)"  },
            { label:"Active links", value:totalActive,   color:"var(--green)" },
            { label:"Total clicks", value:totalClicks,   color:"#FF4D6A"      },
          ].map(s => (
            <div key={s.label} className="card-sm" style={{ flex:1, textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:800, color:s.color, letterSpacing:"-0.02em" }}>{s.value}</div>
              <div style={{ fontSize:10, color:"var(--text3)", marginTop:2, letterSpacing:"0.06em",
                textTransform:"uppercase", fontWeight:700 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Group form */}
        {showGroupForm && (
          <div className="card" style={{ marginBottom:16, border:"1px solid rgba(255,77,106,0.3)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ fontWeight:700, fontSize:15 }}>{editGroupId ? "Rename group" : "New group"}</div>
              <button onClick={closeGroupForm}
                style={{ background:"none", border:"none", color:"var(--text3)", cursor:"pointer" }}>
                <X size={16}/>
              </button>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <input className="input" value={groupTitle}
                onChange={e => setGroupTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSaveGroup()}
                placeholder='e.g. "My Courses", "Social Media", "Free Resources"'
                style={{ flex:1 }}
                autoFocus/>
              <button className="btn-primary" onClick={handleSaveGroup} disabled={savingGroup}>
                {savingGroup ? "Saving…" : editGroupId ? "Rename" : "Create"}
              </button>
              <button className="btn-ghost" onClick={closeGroupForm}>Cancel</button>
            </div>
          </div>
        )}

        {/* Link form */}
        {showLinkForm && (
          <div className="card" style={{ marginBottom:16, border:"1px solid rgba(255,179,0,0.35)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontWeight:700, fontSize:15 }}>
                {editLinkId ? "Edit link" : "New link"}
                {activeLinkGroupId && (
                  <span style={{ fontSize:12, color:"var(--text3)", fontWeight:400, marginLeft:8 }}>
                    in &quot;{groups.find(g => g.id === activeLinkGroupId)?.title}&quot;
                  </span>
                )}
              </div>
              <button onClick={closeLinkForm}
                style={{ background:"none", border:"none", color:"var(--text3)", cursor:"pointer" }}>
                <X size={16}/>
              </button>
            </div>

            {/* Icon picker */}
            <div style={{ marginBottom:14 }}>
              <label className="label">Icon</label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => setLinkForm(f => ({ ...f, icon:ic }))} style={{
                    width:34, height:34, borderRadius:7, fontSize:17, cursor:"pointer",
                    border:`2px solid ${linkForm.icon === ic ? "#FF4D6A" : "var(--border)"}`,
                    background:linkForm.icon === ic ? "rgba(255,77,106,0.1)" : "var(--bg3)",
                    transition:"all 0.14s",
                  }}>{ic}</button>
                ))}
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <div>
                <label className="label">Title *</label>
                <input className="input" value={linkForm.title}
                  onChange={e => setLinkForm(f => ({ ...f, title:e.target.value }))}
                  placeholder="My Portfolio"/>
              </div>
              <div>
                <label className="label">URL *</label>
                <input className="input" value={linkForm.url}
                  onChange={e => setLinkForm(f => ({ ...f, url:e.target.value }))}
                  placeholder="https://…"/>
              </div>
            </div>

            <div style={{ marginBottom:14 }}>
              <label className="label">Description</label>
              <input className="input" value={linkForm.description}
                onChange={e => setLinkForm(f => ({ ...f, description:e.target.value }))}
                placeholder="Short description shown below the title"/>
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
              <label className="toggle">
                <input type="checkbox" checked={linkForm.active}
                  onChange={e => setLinkForm(f => ({ ...f, active:e.target.checked }))}/>
                <span className="toggle-slider"/>
              </label>
              <span style={{ fontSize:13, color:"var(--text2)" }}>Visible on public page</span>
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button className="btn-primary" onClick={handleSaveLink} disabled={savingLink}>
                {savingLink ? "Saving…" : editLinkId ? "Update link" : "Add link"}
              </button>
              <button className="btn-ghost" onClick={closeLinkForm}>Cancel</button>
            </div>
          </div>
        )}

        {/* Groups list */}
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height:80, borderRadius:12, marginBottom:12 }}/>
          ))
        ) : groups.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"var(--text3)" }}>
            <div style={{ fontSize:36, marginBottom:10 }}>📂</div>
            <div style={{ fontSize:14, marginBottom:6 }}>No groups yet.</div>
            <div style={{ fontSize:13 }}>Create a group first, then add links inside it.</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {groups.map(group => (
              <div key={group.id} className="card"
                style={{ padding:"14px 16px", opacity:group.active ? 1 : 0.55 }}>

                {/* Group header row */}
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: collapsed[group.id!] ? 0 : 10 }}>
                  <button onClick={() => toggleCollapse(group.id!)}
                    style={{ background:"none", border:"none", color:"var(--text3)", cursor:"pointer", padding:2, flexShrink:0 }}>
                    {collapsed[group.id!] ? <ChevronDown size={15}/> : <ChevronUp size={15}/>}
                  </button>

                  <div style={{ flex:1, minWidth:0 }}>
                    <span style={{ fontWeight:700, fontSize:14, color:"var(--text)" }}>{group.title}</span>
                    <span style={{ fontSize:11, color:"var(--text3)", fontWeight:400, marginLeft:8 }}>
                      {group.links.length} link{group.links.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0 }}>
                    {/* Visibility toggle */}
                    <label className="toggle">
                      <input type="checkbox" checked={group.active}
                        onChange={() => handleToggleGroup(group)}/>
                      <span className="toggle-slider"/>
                    </label>
                    {/* Rename */}
                    <button className="btn-ghost" onClick={() => openEditGroup(group)}
                      style={{ padding:"5px 9px" }}>
                      <Edit2 size={12}/>
                    </button>
                    {/* Delete group */}
                    <button className="btn-ghost" onClick={() => handleDeleteGroup(group.id!)}
                      style={{ padding:"5px 9px", color:"var(--accent)", borderColor:"rgba(255,77,106,0.3)" }}>
                      <Trash2 size={12}/>
                    </button>
                    {/* Add link to this group */}
                    <button className="btn-ghost" onClick={() => openNewLink(group.id!)}
                      style={{ padding:"5px 12px", fontSize:12, color:"var(--green)", borderColor:"rgba(0,214,143,0.3)" }}>
                      <Plus size={12}/>Link
                    </button>
                  </div>
                </div>

                {/* Links inside group */}
                {!collapsed[group.id!] && (
                  <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                    {group.links.length === 0 ? (
                      <div style={{ fontSize:12, color:"var(--text3)", padding:"8px 4px" }}>
                        No links yet — click &quot;+ Link&quot; to add one.
                      </div>
                    ) : (
                      group.links.map(link => (
                        <div key={link.id}
                          draggable
                          onDragStart={() => setDragging(link.id!)}
                          onDragOver={e => { e.preventDefault(); setDragOver(link.id!); }}
                          onDragLeave={() => setDragOver(null)}
                          onDrop={() => handleLinkDrop(group.id!, link.id!)}
                          style={{
                            display:"flex", alignItems:"center", gap:10,
                            padding:"9px 12px", borderRadius:10,
                            background:"var(--bg3)", cursor:"grab",
                            border:dragOver === link.id ? "1px solid #FF4D6A" : "1px solid var(--border)",
                            opacity:link.active ? 1 : 0.5,
                            transition:"border-color 0.14s",
                          }}>
                          <GripVertical size={13} color="var(--text3)" style={{ flexShrink:0 }}/>

                          {/* Emoji icon */}
                          <div style={{ width:32, height:32, borderRadius:8, background:"var(--bg2)",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:16, flexShrink:0 }}>
                            {link.icon}
                          </div>

                          {/* Text */}
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", marginBottom:1 }}>
                              {link.title}
                            </div>
                            {link.description && (
                              <div style={{ fontSize:11, color:"var(--text3)", overflow:"hidden",
                                textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                {link.description}
                              </div>
                            )}
                          </div>

                          {/* Clicks */}
                          <div style={{ textAlign:"center", flexShrink:0 }}>
                            <div style={{ fontSize:14, fontWeight:800, color:"#FF4D6A" }}>{link.clicks || 0}</div>
                            <div style={{ fontSize:9, color:"var(--text3)", letterSpacing:"0.05em", textTransform:"uppercase" }}>clicks</div>
                          </div>

                          {/* Actions */}
                          <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                            <label className="toggle">
                              <input type="checkbox" checked={link.active}
                                onChange={() => handleToggleLink(group.id!, link)}/>
                              <span className="toggle-slider"/>
                            </label>
                            <button className="btn-ghost" onClick={() => openEditLink(group.id!, link)}
                              style={{ padding:"5px 8px" }}>
                              <Edit2 size={12}/>
                            </button>
                            <button className="btn-ghost"
                              onClick={() => handleDeleteLink(group.id!, link.id!)}
                              style={{ padding:"5px 8px", color:"var(--accent)", borderColor:"rgba(255,77,106,0.3)" }}>
                              <Trash2 size={12}/>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── RIGHT: Live preview ── */}
      <div style={{ position:"sticky", top:32 }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
          color:"var(--text3)", marginBottom:14 }}>Live preview</div>

        {/* Phone frame */}
        <div style={{ background:"var(--bg3)", border:"6px solid var(--border2)",
          borderRadius:38, overflow:"hidden", boxShadow:"0 24px 60px rgba(0,0,0,0.5)",
          maxWidth:260, margin:"0 auto" }}>
          {/* Notch */}
          <div style={{ background:"var(--bg3)", padding:"10px 0 0", display:"flex", justifyContent:"center" }}>
            <div style={{ width:70, height:14, background:"var(--bg2)", borderRadius:7 }}/>
          </div>
          {/* Screen */}
          <div style={{ background:"#f5f5fb", minHeight:480, padding:"20px 14px 28px", overflowY:"auto", maxHeight:560 }}>
            {/* Profile */}
            <div style={{ textAlign:"center", marginBottom:18 }}>
              <div style={{ width:48, height:48, borderRadius:"50%", margin:"0 auto 10px",
                background:"linear-gradient(135deg,#FF4D6A,#FF7A3D)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:18, fontWeight:800, color:"white" }}>
                {handle?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div style={{ fontFamily:"sans-serif", fontWeight:700, fontSize:12, color:"#1a1a2e" }}>
                @{handle || "your_handle"}
              </div>
            </div>

            {/* Groups preview */}
            {previewGroups.length === 0 ? (
              <div style={{ textAlign:"center", padding:"16px 0", fontSize:11, color:"#bbb", fontFamily:"sans-serif" }}>
                Your links will appear here
              </div>
            ) : (
              previewGroups.map(group => (
                <div key={group.id} style={{ marginBottom:14 }}>
                  {/* Group title */}
                  <div style={{ fontFamily:"sans-serif", fontSize:9, fontWeight:700, color:"#aaa",
                    letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6, paddingLeft:2 }}>
                    {group.title}
                  </div>
                  {/* Links */}
                  <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                    {group.links.filter(l => l.active).map(link => (
                      <div key={link.id} style={{ background:"white", borderRadius:10,
                        padding:"9px 11px", boxShadow:"0 1px 5px rgba(0,0,0,0.07)",
                        display:"flex", alignItems:"center", gap:9 }}>
                        <div style={{ width:30, height:30, borderRadius:7, background:"#f0f0f8",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:14, flexShrink:0 }}>
                          {link.icon}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:"sans-serif", fontWeight:700, fontSize:11,
                            color:"#1a1a2e", marginBottom:1 }}>{link.title}</div>
                          {link.description && (
                            <div style={{ fontFamily:"sans-serif", fontSize:9, color:"#888",
                              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {link.description}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize:11, color:"#FF4D6A" }}>→</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}

            <div style={{ textAlign:"center", marginTop:16, fontFamily:"sans-serif", fontSize:9, color:"#ccc" }}>
              ⚡ powered by Repliq
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}