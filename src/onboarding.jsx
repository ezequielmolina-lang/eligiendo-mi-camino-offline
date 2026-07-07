// First-run student onboarding. The school/section/teacher come pre-loaded from escuela.json
// (HQ bakes it per package); the student only types their name + list number. On shared devices,
// "Soy otro estudiante" (clearStudent) brings this back for the next student.
import React from 'react';
import * as telemetry from './telemetry.js';
const { useState } = React;

export function StudentOnboarding({ onDone }) {
  const id = telemetry.getIdentity();
  const [name, setName] = useState(id.name || '');
  const [num, setNum] = useState(id.list_number || '');
  const ok = name.trim().length >= 2;
  function start() {
    if (!ok) return;
    telemetry.setStudent({ name: name.trim(), list_number: String(num).trim() });
    onDone(name.trim());
  }
  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-cream-100 via-brand-50 to-cream-100 flex items-center justify-center py-8">
      <div className="max-w-md px-6 w-full animate-fade-in text-center">
        <div className="text-4xl mb-2">🐓</div>
        <h2 className="text-2xl font-black text-navy-700">¡Bienvenido/a!</h2>
        {id.campus_name ? (
          <p className="text-navy-600 text-sm mt-1 font-bold">{id.campus_name}{id.section ? ` · ${id.section}` : ''}{id.teacher ? ` · Prof. ${id.teacher}` : ''}</p>
        ) : (
          <p className="text-amber-600 text-xs mt-1">⚠️ Equipo sin configurar (modo de prueba).</p>
        )}
        <p className="text-navy-500/70 text-sm mt-3">Antes de empezar, cuéntanos quién eres:</p>
        <div className="mt-4 space-y-3 text-left">
          <div>
            <label className="text-xs font-bold text-navy-600">Tu nombre y apellido</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: María Quispe"
              className="mt-1 w-full bg-white rounded-xl px-4 py-3 text-base text-navy-700 placeholder-navy-300 border-2 border-cream-200 focus:border-brand-300 transition" />
          </div>
          <div>
            <label className="text-xs font-bold text-navy-600">Tu número de lista <span className="text-navy-300 font-normal">(opcional)</span></label>
            <input value={num} onChange={(e) => setNum(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="Ej.: 12"
              className="mt-1 w-full bg-white rounded-xl px-4 py-3 text-base text-navy-700 placeholder-navy-300 border-2 border-cream-200 focus:border-brand-300 transition" />
          </div>
        </div>
        <button onClick={start} disabled={!ok}
          className={`mt-5 w-full py-3 rounded-2xl font-bold text-lg shadow-xl transition-all ${ok ? 'bg-navy-700 text-white hover:bg-navy-800' : 'bg-navy-200 text-white/70 cursor-not-allowed'}`}>
          Empezar
        </button>
        <p className="text-navy-400 text-[11px] mt-2">Usamos esto solo para tu orientación y para tu colegio.</p>
      </div>
    </div>
  );
}
