import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, Auth } from "firebase/auth";
import { getDatabase, ref, set, get, push, remove, update, Database } from "firebase/database";

function getConfig() {
  const config = {
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (process.env.NODE_ENV === "development") {
    const missing = Object.entries(config).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0) console.error("Missing Firebase config:", missing);
  }
  return config;
}

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Database | null = null;

function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length === 0 ? initializeApp(getConfig()) : getApp();
  return _app;
}

export function getAuthInstance(): Auth {
  if (_auth) return _auth;
  _auth = getAuth(getFirebaseApp());
  return _auth;
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

function getDb(): Database {
  if (_db) return _db;
  _db = getDatabase(getFirebaseApp());
  return _db;
}

/* ── Tokens ─────────────────────────────────────────────────────── */
export interface IgToken {
  access_token: string;
  ig_user_id:   string;
  ig_page_id?:  string; // webhook entry.id — may differ from ig_user_id
  ig_username:  string;
  expires_at:   number;
}
export const saveToken = (uid: string, data: IgToken) =>
  set(ref(getDb(), `users/${uid}/tokens`), data);
export const getToken = async (uid: string): Promise<IgToken | null> => {
  const s = await get(ref(getDb(), `users/${uid}/tokens`));
  return s.exists() ? (s.val() as IgToken) : null;
};
export const deleteToken = (uid: string) =>
  remove(ref(getDb(), `users/${uid}/tokens`));

/* ── Rules ──────────────────────────────────────────────────────── */
export type MatchMode = "any_comment" | "word_match" | "exact_match";
export interface Rule {
  id?:           string;
  postId:        string;
  postUrl:       string;
  postThumbnail: string;
  matchMode:     MatchMode;
  keywords:      string[];
  dmTemplate:    string;
  nudgeMessage:  string;
  nudgeEnabled:  boolean;
  nudgeDelay:    number;
  pendingExpiry: number;
  active:        boolean;
  createdAt:     number;
}
export const saveRule = async (uid: string, rule: Omit<Rule, "id">) => {
  const r = push(ref(getDb(), `users/${uid}/rules`));
  await set(r, rule); return r.key;
};
export const updateRule = (uid: string, id: string, data: Partial<Rule>) =>
  update(ref(getDb(), `users/${uid}/rules/${id}`), data);
export const deleteRule = (uid: string, id: string) =>
  remove(ref(getDb(), `users/${uid}/rules/${id}`));
export const getRules = async (uid: string): Promise<Rule[]> => {
  const s = await get(ref(getDb(), `users/${uid}/rules`));
  if (!s.exists()) return [];
  return Object.entries(s.val() as Record<string, Rule>).map(([id, v]) => ({ ...v, id }));
};

/* ── DM Logs ─────────────────────────────────────────────────────── */
export interface DmLog {
  id?:               string;
  commenterId:       string;
  commenterUsername: string;
  postId:            string;
  ruleId:            string;
  sentAt:            number;
  status:            "sent" | "failed";
  type:              "actual" | "follow_prompt";
}
export const logDm = (uid: string, log: Omit<DmLog, "id">) =>
  push(ref(getDb(), `users/${uid}/logs`), log);
export const getLogs = async (uid: string): Promise<DmLog[]> => {
  const s = await get(ref(getDb(), `users/${uid}/logs`));
  if (!s.exists()) return [];
  return Object.entries(s.val() as Record<string, DmLog>)
    .map(([id, v]) => ({ ...v, id })).sort((a, b) => b.sentAt - a.sentAt);
};
export const alreadyDmed = async (uid: string, commenterId: string, postId: string) => {
  const s = await get(ref(getDb(), `users/${uid}/logs`));
  if (!s.exists()) return false;
  return Object.values(s.val() as Record<string, DmLog>).some(
    l => l.commenterId === commenterId && l.postId === postId && l.type === "actual"
  );
};

/* ── Pending ─────────────────────────────────────────────────────── */
export interface PendingEntry {
  id?:         string;
  commenterId: string;
  postId:      string;
  ruleId:      string;
  uid:         string;
  expiresAt:   number;
}
export const savePending = (uid: string, e: Omit<PendingEntry, "id">) =>
  push(ref(getDb(), `users/${uid}/pending`), e);
export const getPendingByCommenter = async (uid: string, commenterId: string) => {
  const s = await get(ref(getDb(), `users/${uid}/pending`));
  if (!s.exists()) return null;
  const match = Object.entries(s.val() as Record<string, PendingEntry>)
    .find(([, v]) => v.commenterId === commenterId && v.expiresAt > Date.now());
  return match ? { ...match[1], id: match[0] } : null;
};
export const deletePending = (uid: string, id: string) =>
  remove(ref(getDb(), `users/${uid}/pending/${id}`));

/* ── Bio Link ────────────────────────────────────────────────────── */
export interface BioLink {
  id?:         string;
  title:       string;
  description: string;
  url:         string;
  icon:        string;
  order:       number;
  active:      boolean;
  clicks:      number;
}

/* ── Bio Group ───────────────────────────────────────────────────── */
export interface BioGroup {
  id?:    string;
  title:  string;
  order:  number;
  active: boolean;
}

export interface BioGroupWithLinks extends BioGroup {
  links: BioLink[];
}

/* ── Group CRUD ──────────────────────────────────────────────────── */
export const saveGroup = async (uid: string, group: Omit<BioGroup, "id">) => {
  const r = push(ref(getDb(), `users/${uid}/biopage/groups`));
  await set(r, group); return r.key;
};
export const updateGroup = (uid: string, id: string, data: Partial<BioGroup>) =>
  update(ref(getDb(), `users/${uid}/biopage/groups/${id}`), data);
export const deleteGroup = async (uid: string, id: string) => {
  await Promise.all([
    remove(ref(getDb(), `users/${uid}/biopage/groups/${id}`)),
    remove(ref(getDb(), `users/${uid}/biopage/grouplinks/${id}`)),
  ]);
};
export const getGroups = async (uid: string): Promise<BioGroup[]> => {
  const s = await get(ref(getDb(), `users/${uid}/biopage/groups`));
  if (!s.exists()) return [];
  return Object.entries(s.val() as Record<string, BioGroup>)
    .map(([id, v]) => ({ ...v, id })).sort((a, b) => a.order - b.order);
};

/* ── Group Links CRUD ────────────────────────────────────────────── */
export const saveGroupLink = async (
  uid: string, groupId: string, link: Omit<BioLink, "id" | "clicks">
) => {
  const r = push(ref(getDb(), `users/${uid}/biopage/grouplinks/${groupId}`));
  await set(r, { ...link, clicks: 0 }); return r.key;
};
export const updateGroupLink = (
  uid: string, groupId: string, linkId: string, data: Partial<BioLink>
) => update(ref(getDb(), `users/${uid}/biopage/grouplinks/${groupId}/${linkId}`), data);

export const deleteGroupLink = (uid: string, groupId: string, linkId: string) =>
  remove(ref(getDb(), `users/${uid}/biopage/grouplinks/${groupId}/${linkId}`));

export const getGroupsWithLinks = async (uid: string): Promise<BioGroupWithLinks[]> => {
  const [groupsSnap, grouplinksSnap] = await Promise.all([
    get(ref(getDb(), `users/${uid}/biopage/groups`)),
    get(ref(getDb(), `users/${uid}/biopage/grouplinks`)),
  ]);
  if (!groupsSnap.exists()) return [];
  const grouplinks = grouplinksSnap.exists()
    ? (grouplinksSnap.val() as Record<string, Record<string, BioLink>>)
    : {};
  return Object.entries(groupsSnap.val() as Record<string, BioGroup>)
    .map(([id, g]) => ({
      ...g, id,
      links: grouplinks[id]
        ? Object.entries(grouplinks[id])
            .map(([lid, l]) => ({ ...l, id: lid }))
            .sort((a, b) => a.order - b.order)
        : [],
    }))
    .sort((a, b) => a.order - b.order);
};

export const incrementGroupLinkClick = async (
  uid: string, groupId: string, linkId: string
) => {
  const path = `users/${uid}/biopage/grouplinks/${groupId}/${linkId}/clicks`;
  const s    = await get(ref(getDb(), path));
  await set(ref(getDb(), path), s.exists() ? (s.val() as number) + 1 : 1);
};

/* ── Handle & Public data ────────────────────────────────────────── */
export const saveHandle = async (uid: string, handle: string) => {
  await Promise.all([
    set(ref(getDb(), `users/${uid}/biopage/handle`), handle),
    set(ref(getDb(), `handles/${handle}`), uid),
  ]);
};

export const getHandleData = async (handle: string) => {
  const s = await get(ref(getDb(), `handles/${handle}`));
  if (!s.exists()) return null;
  const uid = s.val() as string;

  const [groupsSnap, grouplinksSnap] = await Promise.all([
    get(ref(getDb(), `users/${uid}/biopage/groups`)),
    get(ref(getDb(), `users/${uid}/biopage/grouplinks`)),
  ]);

  const grouplinks = grouplinksSnap.exists()
    ? (grouplinksSnap.val() as Record<string, Record<string, BioLink>>)
    : {};

  const groups: BioGroupWithLinks[] = groupsSnap.exists()
    ? Object.entries(groupsSnap.val() as Record<string, BioGroup>)
        .map(([id, g]) => ({
          ...g, id,
          links: grouplinks[id]
            ? Object.entries(grouplinks[id])
                .map(([lid, l]) => ({ ...l, id: lid }))
                .filter(l => l.active)
                .sort((a, b) => a.order - b.order)
            : [],
        }))
        .filter(g => g.active)
        .sort((a, b) => a.order - b.order)
    : [];

  return {
    uid,
    groups,
    token: null as IgToken | null,
  };
};

/* ── Legacy flat links (backward compat) ─────────────────────────── */
export const saveBioLink = async (uid: string, link: Omit<BioLink, "id" | "clicks">) => {
  const r = push(ref(getDb(), `users/${uid}/biopage/links`));
  await set(r, { ...link, clicks: 0 }); return r.key;
};
export const updateBioLink = (uid: string, id: string, data: Partial<BioLink>) =>
  update(ref(getDb(), `users/${uid}/biopage/links/${id}`), data);
export const deleteBioLink = (uid: string, id: string) =>
  remove(ref(getDb(), `users/${uid}/biopage/links/${id}`));
export const getBioLinks = async (uid: string): Promise<BioLink[]> => {
  const s = await get(ref(getDb(), `users/${uid}/biopage/links`));
  if (!s.exists()) return [];
  return Object.entries(s.val() as Record<string, BioLink>)
    .map(([id, v]) => ({ ...v, id })).sort((a, b) => a.order - b.order);
};
export const incrementLinkClick = async (uid: string, linkId: string) => {
  const s = await get(ref(getDb(), `users/${uid}/biopage/links/${linkId}/clicks`));
  await set(
    ref(getDb(), `users/${uid}/biopage/links/${linkId}/clicks`),
    s.exists() ? (s.val() as number) + 1 : 1
  );
};

/* ── Find UID by Instagram ID ────────────────────────────────────── */
export const findUidByIgUserId = async (igUserId: string): Promise<string | null> => {
  const s = await get(ref(getDb(), "users"));
  if (!s.exists()) return null;
  for (const [uid, data] of Object.entries(
    s.val() as Record<string, { tokens?: IgToken }>
  )) {
    const token = data.tokens;
    if (!token) continue;
    // Match against ig_user_id, ig_page_id, or any stored ID
    if (
      token.ig_user_id === igUserId ||
      token.ig_page_id === igUserId
    ) return uid;
  }
  return null;
};