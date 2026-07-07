import React from 'react';
import * as coach from './coach.js';
const { useState, useEffect } = React;

// "Prepare for offline" card (shown on Home): pre-downloads the AI model and shows whether
// the app + model are cached, so a user/teacher can confirm "ready offline" before disconnecting.
export function OfflineCard({ mascotSrc }) {
  const [model, setModel] = useState(coach.getSelectedModel());
  const [cached, setCached] = useState(null);
  const [shell, setShell] = useState(false);
  const [dl, setDl] = useState(false);
  const [prog, setProg] = useState(0);
  const [progText, setProgText] = useState('');
  const webgpu = coach.webgpuAvailable();

  async function refresh(m = model) {
    setShell(!!(navigator.serviceWorker && navigator.serviceWorker.controller));
    try { setCached(await coach.isModelCached(m)); } catch { setCached(false); }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [model]);

  async function download() {
    if (dl) return;
    coach.setSelectedModel(model); // this becomes the one model used everywhere
    setDl(true); setProg(0); setProgText('Iniciando…');
    try {
      await coach.getEngine(model, (r) => { setProg(r.progress || 0); setProgText(r.text || ''); });
      setCached(true);
    } catch (e) { setProgText('No se pudo descargar: ' + (e.message || e)); }
    setDl(false); refresh();
  }

  const models = coach.getModels();
  const others = coach.getOtherModels ? coach.getOtherModels() : [];
  const modelMeta = models.find((m) => m.id === model) || models[0];
  const ready = shell && (cached || coach.MOCK);
  const pct = Math.round(prog * 100);

  return (
    <div className={`rounded-2xl border-2 p-4 sm:p-5 mb-6 ${ready ? 'border-green-300 bg-green-50' : 'border-brand-200 bg-brand-50'}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">{ready ? '✅' : '📶'}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-navy-700 text-sm sm:text-base">{ready ? 'Listo para usar sin internet' : 'Prepara la app para usar sin internet'}</h3>
          <p className="text-xs text-navy-500 mt-0.5">
            {ready
              ? 'La app y el asistente Gallito están guardados en este equipo. Ya puedes desconectarte y seguir usándolo.'
              : 'Descarga el asistente una sola vez (con internet) y luego funcionará sin conexión.'}
          </p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px]">
            <span className={`flex items-center gap-1 ${shell ? 'text-green-700' : 'text-navy-400'}`}>{shell ? '✓' : '○'} App guardada</span>
            <span className={`flex items-center gap-1 ${cached ? 'text-green-700' : 'text-navy-400'}`}>{cached ? '✓' : '○'} Asistente Gallito {coach.MOCK ? '(modo demo)' : `(${modelMeta.label})`}</span>
          </div>

          {!webgpu && !coach.MOCK && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">Este equipo no soporta el asistente con IA (requiere WebGPU: Chrome/Edge actualizados en computadora). La app igual funciona sin la IA.</p>
          )}

          {!coach.MOCK && webgpu && (
            <div className="mt-3">
              {!dl && (
                <div className="flex flex-wrap items-center gap-2">
                  {models.length > 1 && (
                    <select value={model} onChange={(e) => { setModel(e.target.value); coach.setSelectedModel(e.target.value); refresh(e.target.value); }} className="text-xs border-2 border-cream-200 rounded-lg px-2 py-1.5 bg-white text-navy-700">
                      {models.map((m) => <option key={m.id} value={m.id}>{m.label} · ~{m.sizeGB} GB</option>)}
                    </select>
                  )}
                  {cached ? (
                    <span className="text-xs font-semibold text-green-700 flex items-center gap-1">✓ {modelMeta.label} guardado</span>
                  ) : (
                    <button onClick={download} className="px-4 py-1.5 bg-brand-400 text-white rounded-lg font-bold text-xs hover:bg-brand-500 transition">Descargar {modelMeta.label} (~{modelMeta.sizeGB} GB)</button>
                  )}
                </div>
              )}
              {dl && (
                <div className="mt-1">
                  <div className="w-full h-2.5 bg-cream-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-brand-400 to-brand-300 transition-all" style={{ width: pct + '%' }} /></div>
                  <p className="text-[11px] text-navy-500 mt-1">{pct}% · {progText}</p>
                </div>
              )}
              {others.length > 0 && (
                <div className="mt-3 pt-2 border-t border-cream-200">
                  <p className="text-[11px] font-semibold text-navy-500">Otras versiones del modelo (para comparar en PC):</p>
                  <ul className="mt-1 space-y-0.5">
                    {others.map((o) => (
                      <li key={o.hf} className="text-[11px] text-navy-500">
                        <a href={o.hf} target="_blank" rel="noreferrer" className="text-brand-500 underline">{o.label}</a> · {o.note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
