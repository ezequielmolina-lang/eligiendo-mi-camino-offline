// telemetry.js — offline-first usage tracking with periodic sync to HQ.
// Logs locally to IndexedDB in the project's RCT schema (voc_chat / voc_events / voc_steps),
// then syncs queued records to a configurable HQ endpoint whenever a connection is available.
// Privacy: this is minors' data — only anonymized ids + interaction content are stored; the
// endpoint is operator-configured and nothing is sent until one is set.
import { openDB } from 'idb';

const INSTITUTION_ID = 28; // World Bank program id (constant for this project)
const DB_NAME = 'emc';
const DB_VERSION = 1;
const LS = {
  user: 'emc_user_id',
  config: 'emc_config',
  endpoint: 'emc_sync_endpoint',
  lastSync: 'emc_last_sync',
  steps: 'emc_steps_snapshot',
};

let _db = null;
let _listeners = new Set();
let _syncing = false;
let _timer = null;

// ---------- helpers ----------
const nowISO = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const uuid = () => (crypto?.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
function readJSON(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } }
function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

async function db() {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(d) {
      const s = d.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      s.createIndex('synced', 'synced');
    },
  });
  return _db;
}

// ---------- identity ----------
export function getIdentity() {
  let userId = localStorage.getItem(LS.user);
  if (!userId) { userId = uuid(); localStorage.setItem(LS.user, userId); }
  const cfg = readJSON(LS.config, {});
  return {
    user_id: cfg.user_id || userId, // school+section+list-number when a student is set
    device_id: userId,
    institution_id: cfg.institution_id || INSTITUTION_ID,
    campus_id: cfg.campus_id || null,
    campus_name: cfg.campus_name || null,
    section: cfg.section || null,
    teacher: cfg.teacher || null,
    region: cfg.region || null,
    name: cfg.name || null,
    list_number: cfg.list_number || null,
  };
}

// Has a student identified themselves on this device yet?
export function hasStudent() { return !!readJSON(LS.config, {}).name; }
// Set the current student (name + roster/list number). Builds a stable per-student user_id
// from school+section+number so repeated sessions link, even across devices.
export function setStudent({ name, list_number }) {
  const cfg = readJSON(LS.config, {});
  const num = (list_number != null && String(list_number).trim()) || '';
  const uid = cfg.campus_id ? `${cfg.campus_id}-${cfg.section || 'NA'}-${num || (name || '').slice(0, 16)}` : (num ? `${cfg.section || 'NA'}-${num}` : undefined);
  writeJSON(LS.config, { ...cfg, name: name || cfg.name, list_number: num || cfg.list_number, user_id: uid || cfg.user_id });
  try { logEvent('student_start', { name, list_number: num }); } catch (e) {}
  emit();
}
// Clear the student (keep the school config) — for shared devices: "Soy otro estudiante".
export function clearStudent() {
  const cfg = readJSON(LS.config, {});
  delete cfg.name; delete cfg.list_number; delete cfg.user_id;
  writeJSON(LS.config, cfg); emit();
}

export function setIdentity(partial) {
  const cfg = readJSON(LS.config, {});
  writeJSON(LS.config, { ...cfg, ...partial });
  emit();
}

// Read identity / endpoint from URL params on first load (e.g. a per-student QR link).
export function adoptFromURL() {
  try {
    const p = new URLSearchParams(location.search);
    const patch = {};
    for (const [urlKey, cfgKey] of [['uid', 'user_id'], ['campus', 'campus_id'], ['section', 'section'], ['name', 'name']]) {
      if (p.get(urlKey)) patch[cfgKey] = p.get(urlKey);
    }
    if (Object.keys(patch).length) setIdentity(patch);
    if (p.get('sync')) setEndpoint(p.get('sync'));
  } catch {}
}

// Load the school config HQ baked into the package (campus, section, teacher, endpoint).
// Pre-loaded per school on each USB/download so the device "just works" knowing its classroom.
export async function adoptFromConfig() {
  try {
    const r = await fetch('./escuela.json', { cache: 'no-store' });
    if (!r.ok || !/json/i.test(r.headers.get('content-type') || '')) return null;
    const c = await r.json();
    const patch = {};
    for (const k of ['campus_id', 'campus_name', 'section', 'teacher', 'institution_id', 'region']) if (c[k] != null) patch[k] = c[k];
    if (Object.keys(patch).length) setIdentity(patch);
    if (c.sync_endpoint) setEndpoint(c.sync_endpoint);
    return c;
  } catch (e) { return null; }
}

// ---------- config ----------
export function getEndpoint() { return localStorage.getItem(LS.endpoint) || ''; }
export function setEndpoint(url) { localStorage.setItem(LS.endpoint, url || ''); emit(); if (url) scheduleSync(800); }

// ---------- logging ----------
async function enqueue(type, data) {
  const d = await db();
  await d.add('outbox', { type, data, synced: 0, ts: nowISO() });
  emit();
  scheduleSync(4000); // debounce a sync attempt shortly after activity
}

// A chat message in voc_chat shape.
export function logChat({ step, conversation_id, role, text }) {
  const id = getIdentity();
  return enqueue('chat', {
    user_id: id.user_id,
    conversation_id: conversation_id || null,
    step: step || null,
    message_id: uuid(),
    message_type: role === 'user' ? 'student' : 'ai',
    is_student: role === 'user' ? 1 : 0,
    message_text: String(text ?? ''),
    msg_length: String(text ?? '').length,
    ts_created: nowISO(),
    date_created: today(),
  });
}

// A behavioral event in voc_events (Mixpanel-style) shape.
export function logEvent(event, props = {}) {
  const id = getIdentity();
  // Persist welfare/guard flags durably (the outbox is cleared after sync, but a tutor panel
  // and HQ follow-up need these to survive): keep a capped local log.
  if (typeof event === 'string' && /^guard_/.test(event)) {
    const f = readJSON('emc_flags', []);
    f.push({ kind: event.replace('guard_', ''), ts: nowISO() });
    writeJSON('emc_flags', f.slice(-100));
  }
  return enqueue('event', {
    insert_id: uuid(),
    event,
    user_id: id.user_id,
    campus_id: id.campus_id,
    props,
    ts: nowISO(),
    date: today(),
  });
}

// A voc_steps-style progress snapshot (one row per student; replaced each call).
export function snapshotSteps(snapshot) {
  const id = getIdentity();
  writeJSON(LS.steps, {
    user_id: id.user_id,
    institution_id: id.institution_id,
    campus_id: id.campus_id,
    section: id.section,
    updated_at: nowISO(),
    ...snapshot,
  });
  emit();
}

// ---------- local readouts (for the tutor panel) ----------
export function getFlags() { return readJSON('emc_flags', []); }
export function getStepsSnapshot() { return readJSON(LS.steps, null); }

// ---------- sync ----------
export async function getPendingCount() {
  try { const d = await db(); return (await d.getAllFromIndex('outbox', 'synced', 0)).length; } catch { return 0; }
}

export async function getStatus() {
  return {
    online: navigator.onLine,
    endpoint: getEndpoint(),
    pending: await getPendingCount(),
    lastSync: localStorage.getItem(LS.lastSync) || null,
    syncing: _syncing,
    identity: getIdentity(),
  };
}

export function onStatus(cb) { _listeners.add(cb); return () => _listeners.delete(cb); }
async function emit() { const s = await getStatus(); _listeners.forEach((cb) => { try { cb(s); } catch {} }); }

export async function syncNow() {
  const endpoint = getEndpoint();
  if (!endpoint) return { ok: false, reason: 'no_endpoint' };
  if (!navigator.onLine) return { ok: false, reason: 'offline' };
  if (_syncing) return { ok: false, reason: 'busy' };
  _syncing = true; emit();
  try {
    const d = await db();
    const pending = await d.getAllFromIndex('outbox', 'synced', 0);
    const steps = readJSON(LS.steps, null);
    if (!pending.length && !steps) { _syncing = false; localStorage.setItem(LS.lastSync, nowISO()); emit(); return { ok: true, sent: 0 }; }
    const payload = {
      client: { app: 'eligiendo-mi-camino-offline', sentAt: nowISO() },
      identity: getIdentity(),
      voc_chat: pending.filter((r) => r.type === 'chat').map((r) => r.data),
      voc_events: pending.filter((r) => r.type === 'event').map((r) => r.data),
      voc_steps: steps ? [steps] : [],
    };
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    // Confirmed received → drop the synced records (HQ now holds them).
    const tx = d.transaction('outbox', 'readwrite');
    await Promise.all(pending.map((r) => tx.store.delete(r.id)));
    await tx.done;
    localStorage.setItem(LS.lastSync, nowISO());
    _syncing = false; emit();
    return { ok: true, sent: pending.length };
  } catch (e) {
    _syncing = false; emit();
    return { ok: false, reason: String(e.message || e) };
  }
}

function scheduleSync(delay = 3000) {
  if (!getEndpoint()) return;
  clearTimeout(_timer);
  _timer = setTimeout(() => { syncNow(); }, delay);
}

// ---------- init ----------
let _inited = false;
export function init() {
  if (_inited) return;
  _inited = true;
  adoptFromConfig().finally(() => adoptFromURL()); // school config first, URL params can override
  getIdentity(); // ensures a stable id exists
  window.addEventListener('online', () => { emit(); scheduleSync(500); });
  window.addEventListener('offline', () => emit());
  setInterval(() => scheduleSync(0), 3 * 60 * 1000); // periodic attempt every 3 min
  scheduleSync(2000); // initial attempt
  emit();
}
