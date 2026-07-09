import React from 'react';
import { DataReference } from './data-reference.jsx';
import { getProfile, updateProfile } from './profile.js';

const { useState, useMemo, useEffect } = React;

// NotebookLM del tutor (IA en la nube, con citas) — complemento OPCIONAL para estudiantes CON internet.
// El camino principal de este paso funciona sin conexión con Gallito + los datos verificados locales.
const NOTEBOOKLM_URL = 'https://notebooklm.google.com/notebook/0f5538fd-2744-49a5-b6f0-ffbac6c7e9e7';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const LEVEL_LABEL = { secundaria: 'Secundaria', tecnica: 'Técnico', universitaria: 'Universidad' };
const LEVEL_PILL = { secundaria: 'bg-green-100 text-green-700', tecnica: 'bg-blue-100 text-blue-700', universitaria: 'bg-purple-100 text-purple-700' };

// Flatten the sector catalog into one searchable list of occupations.
function flattenOccupations(sectors) {
  const out = [];
  const seen = new Set();
  (sectors || []).forEach((s) => {
    ['secundaria', 'tecnica', 'universitaria'].forEach((lvl) => {
      (s.ocupaciones?.[lvl] || []).forEach((o) => {
        const key = norm(o.name);
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ name: o.name, desc: o.desc || '', level: lvl, sector: s.name, sectorIcon: s.icon });
      });
    });
  });
  return out.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

// ── The Ikigai recap card (carried over from the original Paso 6) ──
function IkigaiRecap() {
  return (
    <div className="rounded-3xl overflow-hidden mb-6 animate-scale-in shadow-xl">
      <div className="bg-gradient-to-r from-navy-700 to-navy-600 px-5 sm:px-7 pt-5 sm:pt-6 pb-4 text-center relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/5 rounded-full" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/5 rounded-full" />
        <p className="text-brand-300 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">生き甲斐</p>
        <h3 className="font-black text-white text-lg sm:text-xl mb-1.5">¿Recuerdas tu Ikigai?</h3>
        <p className="text-white/60 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">Ya recorriste los <strong className="text-white/90">3 círculos</strong>. Ahora vas a elegir ocupaciones en tu zona ideal y profundizar en ellas.</p>
      </div>
      <div className="bg-white px-4 sm:px-7 pt-5 sm:pt-6 pb-4">
        <p className="text-center text-navy-400 text-xs mb-4">Busca ocupaciones donde se cruzan las <strong className="text-navy-600">3 áreas</strong> que exploraste:</p>
        <div className="flex justify-center mb-4">
          <svg viewBox="0 0 320 290" className="w-[240px] sm:w-[280px]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="s6iRose" cx="50%" cy="40%"><stop offset="0%" stopColor="#fecdd3" /><stop offset="100%" stopColor="#fda4af" /></radialGradient>
              <radialGradient id="s6iBlue" cx="40%" cy="50%"><stop offset="0%" stopColor="#bfdbfe" /><stop offset="100%" stopColor="#93c5fd" /></radialGradient>
              <radialGradient id="s6iGreen" cx="60%" cy="50%"><stop offset="0%" stopColor="#bbf7d0" /><stop offset="100%" stopColor="#86efac" /></radialGradient>
              <radialGradient id="s6iCenter" cx="50%" cy="50%"><stop offset="0%" stopColor="#F7A348" stopOpacity="0.45" /><stop offset="100%" stopColor="#F57B21" stopOpacity="0.2" /></radialGradient>
              <style>{`.s6i-c{mix-blend-mode:multiply}`}</style>
            </defs>
            <circle className="s6i-c" cx="160" cy="100" r="78" fill="url(#s6iRose)" opacity="0.6" stroke="#fda4af" strokeWidth="1.5" />
            <circle className="s6i-c" cx="112" cy="182" r="78" fill="url(#s6iBlue)" opacity="0.6" stroke="#93c5fd" strokeWidth="1.5" />
            <circle className="s6i-c" cx="208" cy="182" r="78" fill="url(#s6iGreen)" opacity="0.6" stroke="#86efac" strokeWidth="1.5" />
            <circle cx="160" cy="155" r="28" fill="url(#s6iCenter)" />
            <text x="160" y="62" textAnchor="middle" fill="#9f1239" fontSize="10.5" fontWeight="800" fontFamily="Poppins,sans-serif">Lo que me</text>
            <text x="160" y="76" textAnchor="middle" fill="#9f1239" fontSize="12" fontWeight="900" fontFamily="Poppins,sans-serif">GUSTA</text>
            <text x="160" y="92" textAnchor="middle" fontSize="13">❤️</text>
            <text x="78" y="192" textAnchor="middle" fill="#1e40af" fontSize="10.5" fontWeight="800" fontFamily="Poppins,sans-serif">Lo que</text>
            <text x="78" y="206" textAnchor="middle" fill="#1e40af" fontSize="12" fontWeight="900" fontFamily="Poppins,sans-serif">HAGO BIEN</text>
            <text x="78" y="222" textAnchor="middle" fontSize="13">💪</text>
            <text x="242" y="192" textAnchor="middle" fill="#166534" fontSize="10.5" fontWeight="800" fontFamily="Poppins,sans-serif">Lo que el</text>
            <text x="242" y="206" textAnchor="middle" fill="#166534" fontSize="11" fontWeight="900" fontFamily="Poppins,sans-serif">MERCADO valora</text>
            <text x="242" y="222" textAnchor="middle" fontSize="13">💰</text>
            <text x="160" y="150" textAnchor="middle" fill="#1e293b" fontSize="9.5" fontWeight="900" fontFamily="Poppins,sans-serif">TU ZONA</text>
            <text x="160" y="163" textAnchor="middle" fill="#1e293b" fontSize="9.5" fontWeight="900" fontFamily="Poppins,sans-serif">IDEAL</text>
            <text x="160" y="177" textAnchor="middle" fontSize="12">✨</text>
          </svg>
        </div>
      </div>
    </div>
  );
}

// A small progress rail across the 5 phases of the step.
const PHASES = ['Recuerda', 'Elige', 'Reduce a 3', 'Investiga', 'Prioriza'];
function PhaseRail({ phase }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 mb-5">
      {PHASES.map((label, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className={`w-full h-1.5 rounded-full transition-colors ${i <= phase ? 'bg-brand-400' : 'bg-cream-200'}`} />
          <span className={`text-[9px] sm:text-[10px] font-bold text-center leading-none ${i === phase ? 'text-brand-500' : i < phase ? 'text-navy-500' : 'text-navy-300'}`}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// Guiding questions the student should be able to answer after researching each occupation.
const RESEARCH_QUESTIONS = [
  '¿Qué hace esta persona en su día a día?',
  '¿Qué se estudia y cuánto dura?',
  '¿Dónde puedo estudiarlo (y está licenciado)?',
  '¿Cuánto se gana y hay demanda?',
  '¿Hay becas o apoyo para pagarlo?',
];

export function Step6Journey({ sectors, mascotSrc, chat, header, onComplete }) {
  const catalog = useMemo(() => flattenOccupations(sectors), [sectors]);
  const byName = useMemo(() => { const m = {}; catalog.forEach((o) => { m[norm(o.name)] = o; }); return m; }, [catalog]);

  const [phase, setPhase] = useState(0);
  // favorites: array of occupation names; shortlist: ordered array (max 3) of names.
  const [favorites, setFavorites] = useState(() => {
    const p = getProfile();
    return Array.isArray(p.favorites) ? p.favorites.filter((n) => byName[norm(n)]) : [];
  });
  const [shortlist, setShortlist] = useState([]);
  const [note, setNote] = useState('');
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('datos'); // research tabs: datos | chat

  // Persist favorites as the student edits them, so Paso 5's context stays in sync.
  useEffect(() => { try { updateProfile({ favorites }); } catch (e) {} }, [favorites]);

  const toggleFav = (name) => setFavorites((f) => f.includes(name) ? f.filter((x) => x !== name) : [...f, name]);
  const toggleShort = (name) => setShortlist((s) => s.includes(name) ? s.filter((x) => x !== name) : (s.length >= 3 ? s : [...s, name]));
  const move = (i, dir) => setShortlist((s) => {
    const j = i + dir; if (j < 0 || j >= s.length) return s;
    const c = [...s]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });

  const filtered = useMemo(() => {
    const nq = norm(q.trim());
    if (!nq) return catalog;
    return catalog.filter((o) => norm(o.name).includes(nq) || norm(o.sector).includes(nq) || norm(o.desc).includes(nq));
  }, [q, catalog]);

  const finish = () => {
    // Write the offline-only Step-6 memory that later steps (7 familia, 8 plan) read.
    const ordered = shortlist.map((n, i) => `${i + 1}) ${n}`).join(', ');
    const parts = [];
    if (shortlist.length) parts.push(`Investigó a fondo y ordenó por preferencia: ${ordered}`);
    else if (favorites.length) parts.push(`Preseleccionó ocupaciones de interés: ${favorites.slice(0, 6).join(', ')}`);
    if (note.trim()) parts.push(`Lo que más le importa / dudas: ${note.trim().slice(0, 240)}`);
    const summary = parts.join('. ');
    try { updateProfile({ favorites, step6: summary || 'Exploró ocupaciones con datos verificados en el Paso 6.' }); } catch (e) {}
    onComplete && onComplete();
  };

  const Header = (
    <header className="px-4 sm:px-8 py-3 border-b border-cream-200 bg-white flex items-center gap-3 flex-wrap">
      {mascotSrc && <img src={mascotSrc} alt="Gallito" className="h-9 w-auto" />}
      <div className="flex-1 min-w-0"><h2 className="font-black text-navy-700 text-sm sm:text-base">{header?.title || 'Paso 6: Investigación con IA'}</h2><p className="text-xs text-navy-400">{header?.subtitle}</p></div>
      {phase > 0 && (
        <button onClick={() => setPhase((p) => Math.max(0, p - 1))} className="text-xs font-bold px-3 py-1.5 rounded-lg text-navy-400 hover:text-navy-600 shrink-0">← Atrás</button>
      )}
    </header>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {Header}
      <div className="flex-1 min-h-0 overflow-y-auto bg-cream-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-5 sm:py-7">
          <PhaseRail phase={phase} />

          {/* ── PHASE 0: RECAP ── */}
          {phase === 0 && (
            <div className="animate-fade-in">
              <IkigaiRecap />
              <div className="bg-white rounded-2xl border-2 border-cream-200 p-5 mb-5">
                <h3 className="font-black text-navy-700 mb-2">De explorar a decidir</h3>
                <p className="text-sm text-navy-500 leading-relaxed">En este paso vas a: <strong>1)</strong> elegir las ocupaciones que más te interesaron, <strong>2)</strong> reducirlas a 3 para investigar a fondo, <strong>3)</strong> investigarlas con Gallito y datos verificados, y <strong>4)</strong> ordenarlas según tu preferencia.</p>
                <p className="text-xs text-navy-400 mt-2">Todo funciona sin internet. La información viene de fuentes oficiales (MTPE, INEI, SUNEDU, PRONABEC). La decisión final siempre es tuya.</p>
              </div>
              <button onClick={() => setPhase(1)} className="w-full py-3.5 bg-gradient-to-r from-brand-400 to-brand-300 text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition">Empezar →</button>
            </div>
          )}

          {/* ── PHASE 1: PICK FAVORITES ── */}
          {phase === 1 && (
            <div className="animate-fade-in">
              <h3 className="font-black text-navy-700 text-lg mb-1">1 · Elige las ocupaciones que te interesan</h3>
              <p className="text-sm text-navy-500 mb-4">De todo lo que viste en el Paso 5, marca las que más te llamaron la atención. Sin límite — luego reduces a 3.</p>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ocupación o sector…" className="w-full mb-3 bg-white rounded-xl px-4 py-2.5 text-sm border-2 border-cream-200 focus:border-brand-300" />
              {favorites.length > 0 && (
                <p className="text-xs font-bold text-brand-500 mb-2">⭐ {favorites.length} seleccionada{favorites.length !== 1 ? 's' : ''}</p>
              )}
              <div className="space-y-1.5 mb-24">
                {filtered.map((o) => {
                  const on = favorites.includes(o.name);
                  return (
                    <button key={o.name} onClick={() => toggleFav(o.name)} className={`w-full text-left rounded-xl px-3 py-2.5 border-2 flex items-center gap-3 transition ${on ? 'bg-brand-50 border-brand-300' : 'bg-white border-cream-200 hover:border-brand-200'}`}>
                      <span className={`w-6 h-6 rounded-lg shrink-0 flex items-center justify-center text-sm ${on ? 'bg-brand-400 text-white' : 'bg-cream-100 text-navy-300'}`}>{on ? '✓' : '+'}</span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2 flex-wrap"><span className="font-bold text-navy-700 text-sm">{o.name}</span><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${LEVEL_PILL[o.level]}`}>{LEVEL_LABEL[o.level]}</span></span>
                        <span className="block text-[11px] text-navy-400">{o.sectorIcon} {o.sector}</span>
                      </span>
                    </button>
                  );
                })}
                {!filtered.length && <p className="text-center text-navy-400 text-sm py-6">Sin resultados para "{q}".</p>}
              </div>
              <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white border-t border-cream-200 px-4 py-3 safe-bottom">
                <div className="max-w-3xl mx-auto">
                  <button disabled={!favorites.length} onClick={() => { setShortlist((s) => s.filter((n) => favorites.includes(n))); setPhase(2); }} className={`w-full py-3 rounded-xl font-bold shadow-lg transition ${favorites.length ? 'bg-gradient-to-r from-brand-400 to-brand-300 text-white hover:opacity-90' : 'bg-cream-200 text-navy-300 cursor-not-allowed'}`}>{favorites.length ? `Continuar con ${favorites.length} favorita${favorites.length !== 1 ? 's' : ''} →` : 'Marca al menos una'}</button>
                </div>
              </div>
            </div>
          )}

          {/* ── PHASE 2: REDUCE TO 3 ── */}
          {phase === 2 && (
            <div className="animate-fade-in">
              <h3 className="font-black text-navy-700 text-lg mb-1">2 · Reduce a 3 para investigar</h3>
              <p className="text-sm text-navy-500 mb-4">De tus favoritas, elige las <strong>3</strong> que quieres investigar a fondo y comparar.</p>
              <div className="bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 mb-4 text-sm font-bold text-brand-600">{shortlist.length}/3 elegidas</div>
              <div className="space-y-1.5 mb-6">
                {favorites.map((name) => {
                  const o = byName[norm(name)] || { name };
                  const on = shortlist.includes(name);
                  const full = shortlist.length >= 3 && !on;
                  return (
                    <button key={name} disabled={full} onClick={() => toggleShort(name)} className={`w-full text-left rounded-xl px-3 py-2.5 border-2 flex items-center gap-3 transition ${on ? 'bg-brand-50 border-brand-300' : full ? 'bg-cream-50 border-cream-200 opacity-50 cursor-not-allowed' : 'bg-white border-cream-200 hover:border-brand-200'}`}>
                      <span className={`w-6 h-6 rounded-lg shrink-0 flex items-center justify-center text-sm ${on ? 'bg-brand-400 text-white' : 'bg-cream-100 text-navy-300'}`}>{on ? shortlist.indexOf(name) + 1 : ''}</span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2 flex-wrap"><span className="font-bold text-navy-700 text-sm">{o.name}</span>{o.level && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${LEVEL_PILL[o.level]}`}>{LEVEL_LABEL[o.level]}</span>}</span>
                        {o.sector && <span className="block text-[11px] text-navy-400">{o.sectorIcon} {o.sector}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button disabled={!shortlist.length} onClick={() => setPhase(3)} className={`w-full py-3.5 rounded-xl font-bold shadow-lg transition ${shortlist.length ? 'bg-gradient-to-r from-brand-400 to-brand-300 text-white hover:opacity-90' : 'bg-cream-200 text-navy-300 cursor-not-allowed'}`}>{shortlist.length ? `Investigar ${shortlist.length === 1 ? 'esta 1' : `estas ${shortlist.length}`} →` : 'Elige al menos una'}</button>
            </div>
          )}

          {/* ── PHASE 3: RESEARCH ── */}
          {phase === 3 && (
            <div className="animate-fade-in">
              <h3 className="font-black text-navy-700 text-lg mb-1">3 · Investiga tus 3 opciones</h3>
              <p className="text-sm text-navy-500 mb-3">Usa <strong>los datos verificados</strong> y <strong>pregúntale a Gallito</strong> para responder estas preguntas sobre cada una:</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {shortlist.map((n, i) => <span key={n} className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-100 text-brand-700">{i + 1}. {n}</span>)}
              </div>
              <div className="bg-white border-2 border-cream-200 rounded-xl p-3 mb-4">
                <p className="text-xs font-bold text-navy-500 mb-1.5">Preguntas guía</p>
                <ul className="space-y-1">{RESEARCH_QUESTIONS.map((qq, i) => <li key={i} className="text-xs text-navy-600 flex gap-1.5"><span className="text-brand-400">•</span>{qq}</li>)}</ul>
              </div>
              <div className="flex gap-1 bg-cream-100 rounded-xl p-1 mb-3 w-full sm:w-auto sm:inline-flex">
                <button onClick={() => setMode('datos')} className={`flex-1 text-xs font-bold px-3 py-2 rounded-lg transition ${mode === 'datos' ? 'bg-white text-brand-500 shadow-sm' : 'text-navy-400'}`}>Datos verificados</button>
                <button onClick={() => setMode('chat')} className={`flex-1 text-xs font-bold px-3 py-2 rounded-lg transition ${mode === 'chat' ? 'bg-white text-brand-500 shadow-sm' : 'text-navy-400'}`}>Pregúntale a Gallito</button>
              </div>
              <a href={NOTEBOOKLM_URL} target="_blank" rel="noopener noreferrer" className="mb-3 rounded-lg px-3 py-2 bg-blue-50 border border-blue-100 text-[11px] sm:text-xs text-blue-700 hover:bg-blue-100 transition flex items-center gap-1.5">
                🌐 <span><strong>¿Tienes internet?</strong> Profundiza con el NotebookLM del tutor (IA de Google, con citas). Requiere conexión y cuenta Google.</span>
              </a>
              <div className="rounded-2xl border-2 border-cream-200 bg-white overflow-hidden mb-5" style={{ height: '60vh', minHeight: 380, display: 'flex', flexDirection: 'column' }}>
                <div className="flex-1 min-h-0" style={{ display: mode === 'datos' ? 'flex' : 'none' }}><DataReference /></div>
                <div className="flex-1 min-h-0" style={{ display: mode === 'chat' ? 'flex' : 'none', flexDirection: 'column' }}>{chat}</div>
              </div>
              <button onClick={() => setPhase(4)} className="w-full py-3.5 bg-gradient-to-r from-brand-400 to-brand-300 text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition">Ya investigué → priorizar →</button>
            </div>
          )}

          {/* ── PHASE 4: PRIORITIZE ── */}
          {phase === 4 && (
            <div className="animate-fade-in">
              <h3 className="font-black text-navy-700 text-lg mb-1">4 · Ordena por preferencia</h3>
              <p className="text-sm text-navy-500 mb-4">Con todo lo que investigaste, ordena tus opciones de <strong>mayor</strong> a <strong>menor</strong> interés. Esto lo usaremos en el Paso 7 con tu familia.</p>
              <div className="space-y-2 mb-5">
                {shortlist.map((name, i) => {
                  const o = byName[norm(name)] || { name };
                  return (
                    <div key={name} className="bg-white rounded-xl border-2 border-cream-200 px-3 py-2.5 flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-brand-100 text-brand-600 font-black flex items-center justify-center shrink-0">{i + 1}</span>
                      <span className="flex-1 min-w-0">
                        <span className="font-bold text-navy-700 text-sm block truncate">{o.name}</span>
                        {o.sector && <span className="text-[11px] text-navy-400">{o.sectorIcon} {o.sector}</span>}
                      </span>
                      <span className="flex flex-col gap-1 shrink-0">
                        <button onClick={() => move(i, -1)} disabled={i === 0} className={`w-7 h-6 rounded-md text-xs font-bold ${i === 0 ? 'bg-cream-100 text-navy-200' : 'bg-cream-100 text-navy-500 hover:bg-brand-100'}`}>▲</button>
                        <button onClick={() => move(i, 1)} disabled={i === shortlist.length - 1} className={`w-7 h-6 rounded-md text-xs font-bold ${i === shortlist.length - 1 ? 'bg-cream-100 text-navy-200' : 'bg-cream-100 text-navy-500 hover:bg-brand-100'}`}>▼</button>
                      </span>
                    </div>
                  );
                })}
              </div>
              <label className="block text-sm font-bold text-navy-700 mb-1.5">Antes de cerrar, ¿qué es lo que más te importa o qué dudas tienes todavía?</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Ej.: me gusta la primera pero me preocupa el costo; quiero saber si hay becas…" className="w-full bg-white rounded-xl px-4 py-3 text-sm border-2 border-cream-200 focus:border-brand-300 mb-5" />
              <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 mb-5 flex gap-3">
                <span className="text-xl shrink-0">💬</span>
                <p className="text-sm text-green-700">Si puedes, conversa con alguien que trabaje en tu primera opción. Pregúntale cómo es un día normal, qué le gusta y qué no, y qué consejo le daría a alguien que empieza.</p>
              </div>
              <button onClick={finish} className="w-full py-3.5 bg-gradient-to-r from-brand-400 to-brand-300 text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition">Completar paso ✓</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
