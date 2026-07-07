// Pre/post self-rating — a lightweight in-tool learning measure for the RCT.
// Two 1–5 questions shown BEFORE the journey (pre) and AFTER it (post); the delta is the
// within-student outcome. Stored locally + logged to telemetry (syncs to HQ in the RCT schema).
import React from 'react';
import * as telemetry from './telemetry.js';
const { useState } = React;

const LS = 'emc_checkin';
export function getCheckin(phase) {
  try { const o = JSON.parse(localStorage.getItem(LS) || '{}'); return phase ? (o[phase] || null) : o; }
  catch (e) { return phase ? null : {}; }
}
export function setCheckin(phase, scores) {
  try {
    const o = JSON.parse(localStorage.getItem(LS) || '{}');
    o[phase] = { ...scores, ts: new Date().toISOString() };
    localStorage.setItem(LS, JSON.stringify(o));
  } catch (e) {}
}

const LS_PACE = 'emc_pace';
export function getPace() { try { return localStorage.getItem(LS_PACE) || 'full'; } catch (e) { return 'full'; } }
export function setPace(p) { try { localStorage.setItem(LS_PACE, p); } catch (e) {} }

const QS = [
  { key: 'clarity', q: '¿Qué tan claro tienes tu próximo paso después del colegio?', lo: 'Nada claro', hi: 'Muy claro' },
  { key: 'confidence', q: '¿Qué tan seguro/a te sientes de tus fortalezas?', lo: 'Nada seguro/a', hi: 'Muy seguro/a' },
];

function Scale({ value, onChange }) {
  return (
    <div className="flex gap-2 justify-between mt-3">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onChange(n)}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl font-black text-lg transition-all ${value === n ? 'bg-navy-700 text-white scale-110 shadow-lg' : 'bg-white/70 text-navy-500 hover:bg-brand-100'}`}>
          {n}
        </button>
      ))}
    </div>
  );
}

// Shown right after Step 1's "Tu descripción": turns the one-way summary into a confirmation
// (metacognition + a resonance signal for the RCT), then links forward to the interest test.
export function ReflectionCheck({ description, onDone }) {
  const [res, setRes] = useState(null);
  const [note, setNote] = useState('');
  const opts = [['si', '😀 Sí, bastante'], ['masomenos', '😐 Más o menos'], ['poco', '🤔 No tanto']];
  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-cream-100 via-brand-50 to-cream-100 flex items-center justify-center py-8">
      <div className="max-w-md px-6 animate-fade-in w-full">
        <div className="text-center"><div className="text-4xl mb-2">🐓</div>
          <h2 className="text-2xl font-black text-navy-700">¿Te sentiste identificado/a?</h2>
          <p className="text-navy-500/70 text-sm mt-2">Cuando Gallito resumió quién eres hoy, ¿qué tanto te viste reflejado/a?</p>
        </div>
        {description && <div className="mt-4 bg-white/70 rounded-2xl p-4 max-h-40 overflow-y-auto text-sm text-navy-600 whitespace-pre-line">{description.replace(/[#*]/g, '').slice(0, 600)}</div>}
        <div className="mt-5 flex gap-2">
          {opts.map(([v, l]) => (
            <button key={v} onClick={() => setRes(v)}
              className={`flex-1 px-2 py-3 rounded-xl text-xs font-bold transition ${res === v ? 'bg-navy-700 text-white scale-105' : 'bg-white/70 text-navy-500 hover:bg-brand-100'}`}>{l}</button>
          ))}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="¿Qué agregarías o cambiarías? (opcional)"
          className="mt-3 w-full bg-white/70 rounded-xl px-3 py-2 text-sm text-navy-700 placeholder-navy-300 border-2 border-cream-200 focus:border-brand-300 transition" rows={2} />
        <button onClick={() => onDone({ resonance: res, note })} disabled={!res}
          className={`mt-4 w-full py-3 rounded-2xl font-bold transition-all shadow-lg ${res ? 'bg-navy-700 text-white hover:bg-navy-800' : 'bg-navy-200 text-white/70 cursor-not-allowed'}`}>
          Seguir al Test de Intereses →
        </button>
        <p className="text-center text-navy-400 text-[11px] mt-2">Ahí verás carreras que encajan con cómo eres.</p>
      </div>
    </div>
  );
}

export function ConfidenceCheck({ phase, onDone }) {
  const [scores, setScores] = useState({});
  const [pace, setPaceState] = useState(getPace());
  const [showDelta, setShowDelta] = useState(false);
  const prev = phase === 'post' ? getCheckin('pre') : null;
  const allAnswered = QS.every((x) => scores[x.key]);

  function finish() {
    if (phase === 'post' && prev && !showDelta) { setShowDelta(true); return; }
    onDone(scores);
  }

  if (showDelta && prev) {
    return (
      <div className="h-full overflow-y-auto bg-gradient-to-br from-cream-100 via-brand-50 to-cream-100 flex items-center justify-center py-8">
        <div className="text-center max-w-md px-6 animate-fade-in">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-2xl font-black text-navy-700">¡Mira cuánto avanzaste{prev.name ? ', ' + prev.name : ''}!</h2>
          <div className="mt-6 space-y-4">
            {QS.map((x) => {
              const a = Number(prev[x.key] || 0), b = Number(scores[x.key] || 0), up = b - a;
              return (
                <div key={x.key} className="bg-white/70 rounded-2xl p-4 text-left">
                  <p className="text-sm font-bold text-navy-600">{x.q}</p>
                  <p className="mt-1 text-navy-500 font-black text-lg">
                    {a} <span className="text-navy-300">→</span> {b}
                    <span className={`ml-2 text-sm font-bold ${up > 0 ? 'text-emerald-600' : up < 0 ? 'text-amber-600' : 'text-navy-400'}`}>
                      {up > 0 ? `+${up} 📈` : up < 0 ? `${up}` : 'igual'}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-navy-500/70 text-sm mt-5">Lo importante es que diste el paso de conocerte y planear. ¡Sigue así! 🐓</p>
          <button onClick={() => onDone(scores)} className="mt-6 px-8 py-3 bg-navy-700 text-white rounded-2xl font-bold hover:bg-navy-800 transition-all shadow-xl">
            Terminar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-cream-100 via-brand-50 to-cream-100 flex items-center justify-center py-8">
      <div className="text-center max-w-md px-6 animate-fade-in">
        <div className="text-4xl mb-2">🐓</div>
        <h2 className="text-2xl font-black text-navy-700">
          {phase === 'pre' ? 'Antes de empezar…' : '¡Lo lograste! Una última pregunta'}
        </h2>
        <p className="text-navy-500/70 text-sm mt-2">
          No hay respuestas correctas. Solo marca cómo te sientes hoy {phase === 'pre' ? '(lo veremos de nuevo al final)' : ''}.
        </p>
        <div className="mt-6 space-y-6 text-left">
          {QS.map((x) => (
            <div key={x.key} className="bg-white/50 rounded-2xl p-4">
              <p className="text-sm font-bold text-navy-700">{x.q}</p>
              <Scale value={scores[x.key]} onChange={(n) => setScores((s) => ({ ...s, [x.key]: n }))} />
              <div className="flex justify-between mt-1.5 text-[11px] text-navy-400 font-medium"><span>{x.lo}</span><span>{x.hi}</span></div>
            </div>
          ))}
        </div>
        {phase === 'pre' && (
          <div className="bg-white/50 rounded-2xl p-4 mt-4 text-left">
            <p className="text-sm font-bold text-navy-700">¿Cómo prefieres la entrevista con Gallito?</p>
            <div className="flex gap-2 mt-2">
              {[['full', 'Completa · 10 preguntas'], ['short', 'Rápida · 5 preguntas']].map(([v, l]) => (
                <button key={v} onClick={() => { setPace(v); setPaceState(v); }}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold transition ${pace === v ? 'bg-navy-700 text-white' : 'bg-white/70 text-navy-500 hover:bg-brand-100'}`}>{l}</button>
              ))}
            </div>
          </div>
        )}
        <button onClick={finish} disabled={!allAnswered}
          className={`mt-7 px-10 py-3 rounded-2xl font-bold text-lg transition-all shadow-xl ${allAnswered ? 'bg-navy-700 text-white hover:bg-navy-800' : 'bg-navy-200 text-white/70 cursor-not-allowed'}`}>
          {phase === 'pre' ? 'Empezar' : 'Ver mi avance'}
        </button>
      </div>
    </div>
  );
}
