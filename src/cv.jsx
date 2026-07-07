// "Tu primer CV" — deterministic, offline CV builder for a 5.º-secundaria student.
// Pre-fills name + school (from escuela.json identity) + interests (from the cross-step profile),
// guides "experience" with examples (so students see informal experience counts), and exports a
// clean printable PDF (opens a print-ready page → "Guardar como PDF"). No model / no GPU needed.
import React from 'react';
import * as telemetry from './telemetry.js';
import { getProfile } from './profile.js';
const { useState, useEffect } = React;

const LS = 'emc_cv';
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function initialData() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) {}
  const id = telemetry.getIdentity();
  const prof = getProfile() || {};
  const interes = prof.riasec ? String(prof.riasec).replace(/\([^)]*\)/g, '').replace(/;/g, ',').trim() : '';
  return {
    nombre: saved.nombre || id.name || '',
    distrito: saved.distrito || '',
    telefono: saved.telefono || '',
    correo: saved.correo || '',
    objetivo: saved.objetivo || (id.name ? `Estudiante de 5.º de secundaria${id.campus_name ? ' en ' + id.campus_name : ''}, responsable y con ganas de aprender${interes ? `. Me interesan áreas de ${interes.toLowerCase()}` : ''}. Busco una primera oportunidad (práctica, trabajo o estudios) para crecer y aportar.` : ''),
    eduInstitucion: saved.eduInstitucion || id.campus_name || '',
    eduEstado: saved.eduEstado || 'Secundaria — 5.º año (en curso)',
    experiencias: saved.experiencias && saved.experiencias.length ? saved.experiencias : [{ rol: '', lugar: '', periodo: '', desc: '' }],
    habilidades: saved.habilidades || '',
    idiomas: saved.idiomas || '',
    cursos: saved.cursos || '',
  };
}

function cvHTML(d) {
  const exp = (d.experiencias || []).filter((e) => e.rol || e.desc).map((e) => `
    <div class="item">
      <div class="row"><strong>${esc(e.rol)}</strong>${e.periodo ? `<span class="per">${esc(e.periodo)}</span>` : ''}</div>
      ${e.lugar ? `<div class="lugar">${esc(e.lugar)}</div>` : ''}
      ${e.desc ? `<div class="desc">${esc(e.desc)}</div>` : ''}
    </div>`).join('');
  const sec = (title, body) => body ? `<h2>${title}</h2>${body}` : '';
  const contacto = [d.distrito, d.telefono, d.correo].filter(Boolean).map(esc).join(' · ');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>CV - ${esc(d.nombre)}</title>
  <style>
    *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#1f2a44;max-width:720px;margin:24px auto;padding:0 24px;line-height:1.45}
    h1{font-size:26px;margin:0 0 2px} .contact{color:#555;font-size:13px;margin-bottom:14px}
    h2{font-size:14px;text-transform:uppercase;letter-spacing:.5px;color:#c2521a;border-bottom:2px solid #f0d6c4;padding-bottom:3px;margin:18px 0 8px}
    .item{margin-bottom:9px} .row{display:flex;justify-content:space-between;gap:10px} .per{color:#777;font-size:12px;white-space:nowrap}
    .lugar{color:#555;font-size:13px} .desc{font-size:13px;margin-top:2px} p{margin:0 0 6px;font-size:13px}
    .tags{font-size:13px} @media print{body{margin:0;padding:14px} .noprint{display:none}}
    .noprint{position:fixed;top:10px;right:10px;background:#c2521a;color:#fff;border:0;padding:10px 16px;border-radius:8px;font-weight:bold;cursor:pointer}
  </style></head><body>
  <button class="noprint" onclick="window.print()">🖨️ Guardar como PDF</button>
  <h1>${esc(d.nombre) || 'Tu Nombre'}</h1>
  ${contacto ? `<div class="contact">${contacto}</div>` : ''}
  ${sec('Perfil', d.objetivo ? `<p>${esc(d.objetivo)}</p>` : '')}
  ${sec('Educación', d.eduInstitucion || d.eduEstado ? `<div class="item"><div class="row"><strong>${esc(d.eduEstado)}</strong></div><div class="lugar">${esc(d.eduInstitucion)}</div></div>` : '')}
  ${sec('Experiencia y actividades', exp)}
  ${sec('Habilidades', d.habilidades ? `<p class="tags">${esc(d.habilidades)}</p>` : '')}
  ${sec('Idiomas', d.idiomas ? `<p class="tags">${esc(d.idiomas)}</p>` : '')}
  ${sec('Cursos y logros', d.cursos ? `<p class="tags">${esc(d.cursos)}</p>` : '')}
  <script>window.onload=function(){setTimeout(function(){window.print()},400)}</script>
  </body></html>`;
}

export function CVBuilder({ onDone }) {
  const [d, setD] = useState(initialData);
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(d)); } catch (e) {} }, [d]);
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
  const setExp = (i, k, v) => setD((p) => { const e = p.experiencias.slice(); e[i] = { ...e[i], [k]: v }; return { ...p, experiencias: e }; });
  const addExp = () => setD((p) => ({ ...p, experiencias: [...p.experiencias, { rol: '', lugar: '', periodo: '', desc: '' }] }));
  const delExp = (i) => setD((p) => ({ ...p, experiencias: p.experiencias.filter((_, j) => j !== i) }));
  function descargar() {
    try { telemetry.logEvent('cv_download', {}); } catch (e) {}
    const html = cvHTML(d);
    const w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    else { const b = new Blob([html], { type: 'text/html' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `CV-${(d.nombre || 'mi-cv').replace(/\s+/g, '-')}.html`; a.click(); }
  }
  const I = 'w-full bg-white rounded-lg px-3 py-2 text-sm text-navy-700 border-2 border-cream-200 focus:border-brand-300 transition';
  return (
    <div className="h-full overflow-y-auto bg-cream-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-xl font-black text-navy-700">📋 Tu primer CV</h2>
          {onDone && <button onClick={onDone} className="text-sm font-bold text-navy-400 hover:text-brand-500">Listo →</button>}
        </div>
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 text-xs text-navy-600 mb-4">
          💡 <strong>Aunque no hayas trabajado formalmente, SÍ tienes experiencia:</strong> ayudar en casa o en un negocio, voluntariado, deportes, proyectos del colegio, cuidar a alguien… Cuéntalo: <strong>qué hiciste</strong> y <strong>qué lograste o aprendiste</strong>.
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><label className="text-xs font-bold text-navy-600">Nombre completo</label><input className={I} value={d.nombre} onChange={(e) => set('nombre', e.target.value)} /></div>
            <div><label className="text-xs font-bold text-navy-600">Distrito / Ciudad</label><input className={I} value={d.distrito} onChange={(e) => set('distrito', e.target.value)} placeholder="Ej.: San Juan de Lurigancho, Lima" /></div>
            <div><label className="text-xs font-bold text-navy-600">Teléfono</label><input className={I} value={d.telefono} onChange={(e) => set('telefono', e.target.value)} placeholder="Ej.: 999 888 777" /></div>
            <div><label className="text-xs font-bold text-navy-600">Correo</label><input className={I} value={d.correo} onChange={(e) => set('correo', e.target.value)} placeholder="tucorreo@gmail.com" /></div>
          </div>

          <div><label className="text-xs font-bold text-navy-600">Perfil / Objetivo</label><textarea className={I} rows={3} value={d.objetivo} onChange={(e) => set('objetivo', e.target.value)} /></div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><label className="text-xs font-bold text-navy-600">Educación</label><input className={I} value={d.eduEstado} onChange={(e) => set('eduEstado', e.target.value)} /></div>
            <div><label className="text-xs font-bold text-navy-600">Colegio</label><input className={I} value={d.eduInstitucion} onChange={(e) => set('eduInstitucion', e.target.value)} placeholder="Nombre de tu colegio" /></div>
          </div>

          <div>
            <label className="text-xs font-bold text-navy-600">Experiencia y actividades</label>
            <div className="space-y-2 mt-1">
              {d.experiencias.map((e, i) => (
                <div key={i} className="bg-white border-2 border-cream-200 rounded-xl p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input className={`${I} sm:col-span-2`} value={e.rol} onChange={(ev) => setExp(i, 'rol', ev.target.value)} placeholder="Ej.: Ayudante en negocio familiar" />
                    <input className={I} value={e.periodo} onChange={(ev) => setExp(i, 'periodo', ev.target.value)} placeholder="2024–2025" />
                  </div>
                  <input className={I} value={e.lugar} onChange={(ev) => setExp(i, 'lugar', ev.target.value)} placeholder="Lugar (Ej.: Bodega de mi familia, club deportivo…)" />
                  <textarea className={I} rows={2} value={e.desc} onChange={(ev) => setExp(i, 'desc', ev.target.value)} placeholder="Qué hacías y qué lograste. Ej.: Atendía clientes y llevaba las cuentas; mejoré el orden del inventario." />
                  {d.experiencias.length > 1 && <button onClick={() => delExp(i)} className="text-[11px] text-navy-400 hover:text-red-500 font-bold">Quitar</button>}
                </div>
              ))}
              <button onClick={addExp} className="text-xs font-bold text-brand-500 hover:text-brand-600">+ Agregar otra experiencia</button>
            </div>
          </div>

          <div><label className="text-xs font-bold text-navy-600">Habilidades</label><input className={I} value={d.habilidades} onChange={(e) => set('habilidades', e.target.value)} placeholder="Ej.: trabajo en equipo, responsabilidad, computación, atención al cliente" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><label className="text-xs font-bold text-navy-600">Idiomas (opcional)</label><input className={I} value={d.idiomas} onChange={(e) => set('idiomas', e.target.value)} placeholder="Ej.: Quechua (nativo), inglés básico" /></div>
            <div><label className="text-xs font-bold text-navy-600">Cursos y logros (opcional)</label><input className={I} value={d.cursos} onChange={(e) => set('cursos', e.target.value)} placeholder="Ej.: Curso de computación; 1er puesto feria de ciencias" /></div>
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <button onClick={descargar} disabled={!d.nombre.trim()} className={`flex-1 py-3 rounded-2xl font-bold text-white shadow-lg transition ${d.nombre.trim() ? 'bg-navy-700 hover:bg-navy-800' : 'bg-navy-200 cursor-not-allowed'}`}>📄 Descargar / Imprimir CV (PDF)</button>
        </div>
        <p className="text-center text-navy-400 text-[11px] mt-2">Se abre tu CV listo para imprimir → elige "Guardar como PDF". Se guarda en este equipo para editarlo después.</p>
      </div>
    </div>
  );
}
