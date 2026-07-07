import React from 'react';
import KB from './data/kb.json';
import { getIdentity } from './telemetry';
import { salariesForRegion, SAL_REGIONS, defaultSalRegion, saveSalRegion, fmtSoles } from './salaries.js';
const { useState, useMemo } = React;

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const PILL = { brand: 'bg-brand-100 text-brand-700', amber: 'bg-amber-100 text-amber-700', green: 'bg-green-100 text-green-700', blue: 'bg-blue-100 text-blue-700', purple: 'bg-purple-100 text-purple-700' };
const Pill = ({ children, color = 'brand' }) => (
  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PILL[color] || PILL.brand}`}>{children}</span>
);
const Link = ({ href }) => href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-600 underline break-all text-xs">{href}</a> : null;

// NotebookLM del tutor (IA en la nube, con citas) — complemento para estudiantes CON internet.
// Para cambiarlo: pega aquí el enlace de tu notebook; debe estar compartido como "cualquiera con el enlace".
const NOTEBOOKLM_URL = 'https://notebooklm.google.com/notebook/0f5538fd-2744-49a5-b6f0-ffbac6c7e9e7';

// ---- Becas ----
function Becas() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-navy-400">Fuente: PRONABEC, portal Mi Carrera (MTPE) y universidades. Las convocatorias son anuales — revisa los enlaces oficiales con tiempo.</p>
      {KB.becas.map((b, i) => (
        <div key={i} className="bg-white border-2 border-cream-200 rounded-xl p-4">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-black text-navy-700 text-sm">{b.nombre}</h4>
            {b.tipo === 'credito' ? <Pill color="amber">Crédito (se devuelve)</Pill> : <Pill color="green">Beca</Pill>}
          </div>
          {b.para_quien && <p className="text-xs text-navy-600 mt-1"><strong>Para quién:</strong> {b.para_quien}</p>}
          {b.cubre && <p className="text-xs text-navy-600 mt-1"><strong>Cubre:</strong> {b.cubre}</p>}
          {b.requisitos && <p className="text-xs text-navy-600 mt-1"><strong>Requisitos:</strong> {b.requisitos}</p>}
          {b.como_postular && <p className="text-xs text-navy-600 mt-1"><strong>Cómo postular:</strong> {b.como_postular}</p>}
          {b.enlace && <div className="mt-1.5"><Link href={b.enlace} /></div>}
        </div>
      ))}
    </div>
  );
}

// ---- Sueldos (por región, datos reales del MTPE) ----
function Sueldos() {
  const [q, setQ] = useState('');
  const [region, setRegion] = useState(() => { try { return defaultSalRegion(getIdentity().region); } catch (e) { return defaultSalRegion(null); } });
  const pick = (r) => { setRegion(r); saveSalRegion(r); };
  const rows = useMemo(() => salariesForRegion(region), [region]);
  const filtered = rows.filter((r) => norm(r.nombre).includes(norm(q)));
  return (
    <div>
      <div className="flex gap-2 mb-2 flex-wrap">
        <select value={region} onChange={(e) => pick(e.target.value)} aria-label="Filtrar sueldos por región"
          className="bg-white rounded-lg px-3 py-2 text-sm border-2 border-cream-200 focus:border-brand-300 font-bold text-navy-700">
          <option value="Nacional">📍 Perú (nacional)</option>
          {SAL_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar carrera…" className="flex-1 min-w-[140px] bg-cream-50 rounded-lg px-3 py-2 text-sm border-2 border-cream-200 focus:border-brand-300" />
      </div>
      <p className="text-xs text-navy-400 mb-2">Ingreso mensual promedio por carrera en <strong>{region === 'Nacional' ? 'todo el Perú' : region}</strong>, según la edad del trabajador (18–29 años y 30+ años). Fuente: MTPE · Mi Carrera (datos 2024–2025). Referencial. {filtered.length} carreras.</p>
      <div className="overflow-hidden rounded-xl border-2 border-cream-200">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 text-navy-500"><tr><th className="text-left px-3 py-2 font-bold">Carrera</th><th className="text-right px-2 py-2 font-bold">18-29</th><th className="text-right px-3 py-2 font-bold">30+</th></tr></thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-t border-cream-200">
                <td className="px-3 py-2 text-navy-700">{r.nombre}</td>
                <td className="px-2 py-2 text-right font-bold text-emerald-600 whitespace-nowrap">{fmtSoles(r.joven)}</td>
                <td className="px-3 py-2 text-right font-bold text-indigo-600 whitespace-nowrap">{fmtSoles(r.adulto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && <p className="text-center text-navy-400 text-sm py-4">Sin resultados{q ? ` para "${q}"` : ''} en {region === 'Nacional' ? 'todo el Perú' : region}.</p>}
      {KB.sueldos_por_region && (
        <div className="mt-3 bg-brand-50 border border-brand-200 rounded-xl p-3">
          <p className="text-xs font-black text-navy-700 mb-1">📍 Sueldos por región</p>
          <p className="text-xs text-navy-600">{KB.sueldos_por_region.nota}</p>
          <p className="text-xs text-navy-600 mt-1">{KB.sueldos_por_region.patron}</p>
          <p className="text-xs text-navy-700 mt-1"><strong>{KB.sueldos_por_region.ejemplo}</strong></p>
          <p className="text-xs text-navy-600 mt-1">{KB.sueldos_por_region.como_ver_tu_region}</p>
          <div className="mt-1.5"><Link href={KB.sueldos_por_region.enlace} /></div>
        </div>
      )}
    </div>
  );
}

// ---- Searchable institution list, filtered by region ----
// The region defaults to the student's own (from the school config) so they first see
// "what's available where I live"; they can switch to any region or see them all.
const REGION_LS = 'emc_region';
function defaultRegion(regions) {
  try {
    const saved = localStorage.getItem(REGION_LS);
    if (saved && (saved === 'all' || regions.includes(saved))) return saved;
    const r = getIdentity().region;
    if (r && regions.includes(r)) return r;
  } catch (e) {}
  return 'all';
}
function InstitutionList({ items, withType, plural = 'instituciones' }) {
  const regions = useMemo(() => Array.from(new Set(items.map((it) => (it.region || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')), [items]);
  const [q, setQ] = useState('');
  const [region, setRegion] = useState(() => defaultRegion(regions));
  const pickRegion = (r) => { setRegion(r); try { localStorage.setItem(REGION_LS, r); } catch (e) {} };
  const filtered = items.filter((it) =>
    (region === 'all' || norm(it.region) === norm(region)) &&
    (norm(it.nombre).includes(norm(q)) || norm(it.region).includes(norm(q))));
  return (
    <div>
      <div className="flex gap-2 mb-2 flex-wrap">
        <select value={region} onChange={(e) => pickRegion(e.target.value)} aria-label="Filtrar por región"
          className="bg-white rounded-lg px-3 py-2 text-sm border-2 border-cream-200 focus:border-brand-300 font-bold text-navy-700">
          <option value="all">📍 Todas las regiones</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre…" className="flex-1 min-w-[140px] bg-cream-50 rounded-lg px-3 py-2 text-sm border-2 border-cream-200 focus:border-brand-300" />
      </div>
      <p className="text-[11px] text-navy-400 mb-2">{filtered.length} de {items.length} · licenciadas oficialmente{region !== 'all' ? ` · en ${region}` : ''}</p>
      <div className="space-y-1.5">
        {filtered.slice(0, 200).map((it, i) => (
          <div key={i} className="bg-white border border-cream-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-sm text-navy-700">{it.nombre}</span>
            <span className="flex items-center gap-1.5 shrink-0">
              {withType && it.tipo && <Pill color={/pu/.test(norm(it.tipo)) ? 'blue' : 'purple'}>{it.tipo}</Pill>}
              {it.region && <span className="text-[11px] text-navy-400">{it.region}</span>}
            </span>
          </div>
        ))}
      </div>
      {region !== 'all' && !filtered.length && (
        <div className="text-center text-navy-600 text-sm py-6 px-4 bg-cream-50 rounded-xl border border-cream-200">
          <p className="mb-1">No hay {plural} licenciadas registradas en <strong>{region}</strong>{q ? ' con ese nombre' : ''}.</p>
          <p className="text-xs text-navy-400 mb-2">Muchos estudiantes estudian en una región vecina, en Lima o a distancia. Mira todas las opciones:</p>
          <button onClick={() => pickRegion('all')} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-brand-400 text-white">Ver todas las regiones →</button>
        </div>
      )}
    </div>
  );
}

// ---- Futuro ----
function Futuro() {
  return (
    <div className="space-y-2">
      <p className="text-xs text-navy-400 mb-1">Carreras de alta proyección. Fuente: MTPE (Mi Carrera).</p>
      {KB.carreras_futuro.map((c, i) => (
        <div key={i} className="bg-white border border-cream-200 rounded-lg p-3">
          <p className="font-bold text-navy-700 text-sm">{c.carrera}</p>
          {c.por_que && <p className="text-xs text-navy-500 mt-0.5">{c.por_que}</p>}
        </div>
      ))}
    </div>
  );
}

// ---- Asesoría MTPE ----
function Asesoria() {
  const a = KB.asesoria_mtpe || {};
  return (
    <div className="bg-white border-2 border-cream-200 rounded-xl p-4 space-y-2">
      <h4 className="font-black text-navy-700 text-sm">Asesoría vocacional gratuita (MTPE)</h4>
      {a.que_es && <p className="text-xs text-navy-600">{a.que_es}</p>}
      {a.como_acceder && <p className="text-xs text-navy-600"><strong>Cómo acceder:</strong> {a.como_acceder}</p>}
      {a.enlace && <Link href={a.enlace} />}
    </div>
  );
}

// ---- Buscar todo (search across ALL verified data — fast, exact, no LLM) ----
function Buscar() {
  const [q, setQ] = useState('');
  const nq = norm(q.trim());
  const has = (s) => norm(s || '').includes(nq);
  const becas = nq ? KB.becas.filter((b) => has(b.nombre) || has(b.para_quien) || has(b.cubre) || has(b.requisitos)) : [];
  const sueldos = nq ? [...KB.carreras_mejor_pagadas].filter((c) => has(c.carrera)).sort((a, b) => (b.salario_mensual_soles || 0) - (a.salario_mensual_soles || 0)) : [];
  const univ = nq ? KB.universidades_licenciadas.filter((u) => has(u.nombre) || has(u.region)) : [];
  const inst = nq ? KB.institutos_licenciados.filter((i) => has(i.nombre) || has(i.region)) : [];
  const futuro = nq ? (KB.carreras_futuro || []).filter((c) => has(c.carrera) || has(c.por_que)) : [];
  const total = becas.length + sueldos.length + univ.length + inst.length + futuro.length;
  const Sec = ({ title, n, children }) => (<div className="mb-4"><p className="text-xs font-black uppercase tracking-wide text-navy-400 mb-1.5">{title} ({n})</p>{children}</div>);
  return (
    <div>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: minería, beca técnica, Cusco, sistemas…"
        className="w-full mb-3 bg-white rounded-lg px-4 py-2.5 text-sm border-2 border-cream-200 focus:border-brand-300" />
      {!nq && (
        <div className="text-center text-navy-400 text-sm py-10">
          <p className="text-3xl mb-2">🔎</p>
          <p>Busca en <strong>becas, sueldos, universidades, institutos</strong> y carreras — todo verificado y exacto.</p>
          <p className="text-xs mt-2 text-navy-300">Ej.: "minería" · "beca para técnica" · "Cusco" · "sistemas"</p>
        </div>
      )}
      {nq && total === 0 && <p className="text-center text-navy-400 text-sm py-8">Sin resultados para "{q}". Prueba otra palabra.</p>}
      {becas.length > 0 && <Sec title="Becas" n={becas.length}>{becas.map((b, i) => (
        <div key={i} className="bg-white border border-cream-200 rounded-lg p-3 mb-1.5">
          <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-navy-700 text-sm">{b.nombre}</span>{b.tipo === 'credito' ? <Pill color="amber">Crédito</Pill> : <Pill color="green">Beca</Pill>}</div>
          {b.para_quien && <p className="text-xs text-navy-500 mt-0.5">{b.para_quien.slice(0, 170)}</p>}
          {b.enlace && <div className="mt-1"><Link href={b.enlace} /></div>}
        </div>
      ))}</Sec>}
      {sueldos.length > 0 && <Sec title="Sueldos (jóvenes, Lima)" n={sueldos.length}>{sueldos.slice(0, 20).map((c, i) => (
        <div key={i} className="flex items-center justify-between bg-white border border-cream-200 rounded-lg px-3 py-2 mb-1 text-sm gap-2">
          <span className="text-navy-700">{c.carrera} <span className="text-navy-300 text-xs">· {c.nivel === 'tecnica' ? 'Téc.' : 'Univ.'}</span></span>
          <span className="font-bold text-green-700 whitespace-nowrap">S/ {Number(c.salario_mensual_soles || 0).toLocaleString('es-PE')}</span>
        </div>
      ))}</Sec>}
      {univ.length > 0 && <Sec title="Universidades licenciadas" n={univ.length}>{univ.slice(0, 25).map((u, i) => (
        <div key={i} className="flex items-center justify-between bg-white border border-cream-200 rounded-lg px-3 py-1.5 mb-1 text-sm gap-2"><span className="text-navy-700">{u.nombre}</span>{u.region && <span className="text-[11px] text-navy-400 shrink-0">{u.region}</span>}</div>
      ))}{univ.length > 25 && <p className="text-[11px] text-navy-400">+{univ.length - 25} más…</p>}</Sec>}
      {inst.length > 0 && <Sec title="Institutos licenciados" n={inst.length}>{inst.slice(0, 25).map((it, i) => (
        <div key={i} className="flex items-center justify-between bg-white border border-cream-200 rounded-lg px-3 py-1.5 mb-1 text-sm gap-2"><span className="text-navy-700">{it.nombre}</span>{it.region && <span className="text-[11px] text-navy-400 shrink-0">{it.region}</span>}</div>
      ))}{inst.length > 25 && <p className="text-[11px] text-navy-400">+{inst.length - 25} más…</p>}</Sec>}
      {futuro.length > 0 && <Sec title="Carreras del futuro" n={futuro.length}>{futuro.map((c, i) => (
        <div key={i} className="bg-white border border-cream-200 rounded-lg p-2.5 mb-1"><p className="font-bold text-navy-700 text-sm">{c.carrera}</p>{c.por_que && <p className="text-xs text-navy-500">{c.por_que}</p>}</div>
      ))}</Sec>}
    </div>
  );
}

const TABS = [
  { id: 'buscar', label: '🔎 Buscar', el: Buscar },
  { id: 'becas', label: '💰 Becas', el: Becas },
  { id: 'sueldos', label: '📊 Sueldos', el: Sueldos },
  { id: 'univ', label: '🎓 Universidades', el: () => <InstitutionList items={KB.universidades_licenciadas} withType plural="universidades" /> },
  { id: 'inst', label: '🔧 Institutos', el: () => <InstitutionList items={KB.institutos_licenciados} plural="institutos" /> },
  { id: 'futuro', label: '🚀 Carreras del futuro', el: Futuro },
  { id: 'asesoria', label: '🤝 Asesoría', el: Asesoria },
];

export function DataReference() {
  const [tab, setTab] = useState('buscar');
  const Active = (TABS.find((t) => t.id === tab) || TABS[0]).el;
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 sm:px-6 pt-4 flex gap-2 flex-wrap border-b border-cream-200 bg-white">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`text-xs font-bold px-3 py-2 rounded-t-lg transition ${tab === t.id ? 'bg-brand-50 text-brand-500 border-b-2 border-brand-400' : 'text-navy-400 hover:text-navy-600'}`}>{t.label}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 bg-cream-50">
        <div className="max-w-2xl mx-auto"><Active /></div>
      </div>
    </div>
  );
}

// Step 6 wrapper: deterministic data reference + the (optional) LLM chat, as tabs.
export function ResearchStep({ header, mascotSrc, chat, onComplete }) {
  const [mode, setMode] = useState('datos'); // datos | chat
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="px-4 sm:px-8 py-3 border-b border-cream-200 bg-white flex items-center gap-3 flex-wrap">
        {mascotSrc && <img src={mascotSrc} alt="Gallito" className="h-9 w-auto" />}
        <div className="flex-1 min-w-0"><h2 className="font-black text-navy-700 text-sm sm:text-base">{header?.title}</h2><p className="text-xs text-navy-400">{header?.subtitle}</p></div>
        <div className="flex gap-1 bg-cream-100 rounded-xl p-1 shrink-0">
          <button onClick={() => setMode('datos')} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${mode === 'datos' ? 'bg-white text-brand-500 shadow-sm' : 'text-navy-400'}`}>Datos verificados</button>
          <button onClick={() => setMode('chat')} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${mode === 'chat' ? 'bg-white text-brand-500 shadow-sm' : 'text-navy-400'}`}>Pregúntale a Gallito</button>
        </div>
        {onComplete && <button onClick={onComplete} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand-400 to-brand-300 text-white shrink-0">Completar paso ✓</button>}
      </header>
      <a href={NOTEBOOKLM_URL} target="_blank" rel="noopener noreferrer" className="px-4 sm:px-8 py-2 bg-blue-50 border-b border-blue-100 text-[11px] sm:text-xs text-blue-700 hover:bg-blue-100 transition flex items-center gap-1.5">
        🌐 <span><strong>¿Tienes internet?</strong> Profundiza con el NotebookLM del tutor (IA de Google, con citas). Requiere conexión y cuenta Google.</span>
      </a>
      <div className="flex-1 min-h-0" style={{ display: mode === 'datos' ? 'flex' : 'none' }}><DataReference /></div>
      <div className="flex-1 min-h-0" style={{ display: mode === 'chat' ? 'flex' : 'none', flexDirection: 'column' }}>{chat}</div>
    </div>
  );
}
