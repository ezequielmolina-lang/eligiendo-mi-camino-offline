// Tutor panel — a LOCAL, per-device read-out of this student's signals for a teacher/orientador.
// Progress, learning delta (pre/post), wellbeing alerts (crisis/distress), and sync status.
// The full multi-student view lives at HQ — these same signals sync there in the RCT schema.
import React from 'react';
import * as telemetry from './telemetry.js';
import { getCheckin } from './checkin.jsx';
const { useState, useEffect } = React;

const fmt = (ts) => { try { return new Date(ts).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return ts || ''; } };

function Card({ title, children, tone }) {
  const ring = tone === 'alert' ? 'border-red-300 bg-red-50' : tone === 'warn' ? 'border-amber-300 bg-amber-50' : 'border-cream-200 bg-white';
  return (
    <div className={`rounded-2xl border ${ring} p-4`}>
      <p className="text-xs font-black uppercase tracking-wide text-navy-400">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function TutorPanel({ onClose }) {
  const [status, setStatus] = useState(null);
  const steps = telemetry.getStepsSnapshot();
  const flags = telemetry.getFlags();
  const pre = getCheckin('pre'), post = getCheckin('post');
  useEffect(() => { telemetry.getStatus().then(setStatus); }, []);

  const crisis = flags.filter((f) => f.kind === 'crisis');
  const distress = flags.filter((f) => f.kind === 'distress');
  const other = flags.filter((f) => !['crisis', 'distress'].includes(f.kind));
  const completed = steps?.completed_steps_count || 0;
  const total = steps?.total_steps || 8;
  const pct = Math.round((completed / total) * 100);

  const delta = (k) => (pre && post ? Number(post[k] || 0) - Number(pre[k] || 0) : null);

  return (
    <div className="h-full overflow-y-auto bg-cream-50">
      <div className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-navy-700">Panel del tutor</h1>
          {onClose && <button onClick={onClose} className="text-sm font-bold text-navy-400 hover:text-brand-500">← Volver</button>}
        </div>
        <p className="text-navy-500/70 text-xs mt-1">Datos de <strong>este dispositivo</strong>. El tablero de todos los estudiantes está en la sede (los datos se sincronizan).</p>

        <div className="mt-4 grid gap-3">
          {/* Wellbeing first — most important for follow-up */}
          {(crisis.length > 0 || distress.length > 0) && (
            <Card title="Bienestar — requiere atención" tone={crisis.length ? 'alert' : 'warn'}>
              {crisis.length > 0 && (
                <p className="text-sm text-red-700 font-bold">🚨 {crisis.length} señal(es) de crisis. Conversa con el estudiante y un adulto de confianza (Línea 113, opción 5). Última: {fmt(crisis[crisis.length - 1].ts)}.</p>
              )}
              {distress.length > 0 && (
                <p className="text-sm text-amber-700 font-bold mt-1">💛 {distress.length} señal(es) de tristeza/soledad. Vale la pena un seguimiento cálido. Última: {fmt(distress[distress.length - 1].ts)}.</p>
              )}
            </Card>
          )}

          <Card title="Progreso">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-navy-700">{completed} de {total} pasos</span>
              <span className="text-navy-400">{steps?.journey_status === 'completed' ? '✅ Completado' : 'En curso'}</span>
            </div>
            <div className="mt-2 h-2.5 bg-cream-200 rounded-full overflow-hidden"><div className="h-full bg-brand-400" style={{ width: pct + '%' }} /></div>
            {steps?.current_step && <p className="text-xs text-navy-400 mt-1.5">Último paso abierto: {steps.current_step}</p>}
          </Card>

          <Card title="Aprendizaje (autoevaluación 1–5)">
            {pre ? (
              <div className="space-y-1.5 text-sm">
                <Row label="Claridad del próximo paso" a={pre.clarity} b={post?.clarity} d={delta('clarity')} />
                <Row label="Seguridad en sus fortalezas" a={pre.confidence} b={post?.confidence} d={delta('confidence')} />
                {!post && <p className="text-xs text-navy-400">Medición final pendiente (se toma al terminar el recorrido).</p>}
              </div>
            ) : <p className="text-sm text-navy-400">Aún sin medición inicial.</p>}
          </Card>

          {other.length > 0 && (
            <Card title="Otras señales del filtro de seguridad">
              <p className="text-sm text-navy-600">{other.map((f) => f.kind).join(', ')}</p>
            </Card>
          )}

          <Card title="Sincronización con la sede">
            {status ? (
              <div className="text-sm text-navy-600 space-y-0.5">
                <p>Estado: {status.online ? '🟢 en línea' : '⚪ sin conexión'} · pendientes: <strong>{status.pending}</strong></p>
                <p className="text-xs text-navy-400">Endpoint: {status.endpoint || 'no configurado'} · última sync: {status.lastSync ? fmt(status.lastSync) : '—'}</p>
                <p className="text-xs text-navy-400">ID estudiante: {status.identity?.user_id} · sede: {status.identity?.campus_id || '—'}</p>
              </div>
            ) : <p className="text-sm text-navy-400">Cargando…</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, a, b, d }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-navy-600">{label}</span>
      <span className="font-black text-navy-700">
        {a ?? '—'}{b != null ? <> <span className="text-navy-300">→</span> {b}</> : ''}
        {d != null && <span className={`ml-2 text-xs ${d > 0 ? 'text-emerald-600' : d < 0 ? 'text-amber-600' : 'text-navy-400'}`}>{d > 0 ? `+${d} 📈` : d < 0 ? d : '='}</span>}
      </span>
    </div>
  );
}
