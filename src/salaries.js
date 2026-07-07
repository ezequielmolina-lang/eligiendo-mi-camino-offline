// salaries.js — regional salary lookups over the baked MTPE dataset (kb.json → salarios_region).
// Source: Mi Carrera (MTPE), downloaded and baked at build time so the app stays fully offline.
// `Nacional` is the all-Peru reference; the rest are departamentos.
import KB from './data/kb.json';

const SAL = KB.salarios_region || { carreras: {}, alias: {}, regiones: [] };
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

export const SAL_REGIONS = SAL.regiones || [];          // departamentos with data (sorted)
export const SAL_FUENTE = SAL.fuente || '';
export const SAL_ENLACE = SAL.enlace || 'https://micarrera.trabajo.gob.pe';
const VALID = new Set(['Nacional', ...SAL_REGIONS]);

export function fmtSoles(n) { return 'S/ ' + Number(n || 0).toLocaleString('es-PE'); }
export function isSalRegion(r) { return VALID.has(r); }

// Regional figure for one career: { joven, adulto } or null if we have no data for that career/region.
export function careerSalary(careerName, region) {
  const key = norm(careerName);
  const entry = SAL.carreras[key] || (SAL.alias[key] ? SAL.carreras[SAL.alias[key]] : null);
  if (!entry) return null;
  const v = entry.r[region];
  return v ? { joven: v[0], adulto: v[1] } : null;
}

// All careers that have data for a region, as {nombre, joven, adulto}, sorted by young-salary desc.
export function salariesForRegion(region) {
  const out = [];
  for (const k in SAL.carreras) {
    const e = SAL.carreras[k];
    const v = e.r[region];
    if (v) out.push({ nombre: e.n, joven: v[0], adulto: v[1] });
  }
  return out.sort((a, b) => b.joven - a.joven);
}

// Pick the region to show: a valid saved choice → the school's region → Lima.
export function defaultSalRegion(schoolRegion) {
  try { const s = localStorage.getItem('emc_region'); if (s && VALID.has(s)) return s; } catch (e) {}
  if (schoolRegion && VALID.has(schoolRegion)) return schoolRegion;
  return 'Lima';
}
export function saveSalRegion(r) { try { localStorage.setItem('emc_region', r); } catch (e) {} }

// --- Gallito research chat: inject EXACT regional salary facts into the context ---
// retrieveKB() only sees kb-summary.txt (no per-region figures), so a salary question got
// "no tengo ese dato". This builds a compact, verified salary block (career × region) the
// chat can answer from directly — same MTPE figures as the "Datos verificados" tab.
const SALARY_RE = /(gana|gano|sueldo|salari|ingres|cu[aá]nto|paga|remunera|cobr|cuesta vivir|rentab)/;
// Common job words a student types → the MTPE career name fragment (degree names differ from job titles).
const CAREER_KW = {
  medico: 'medicina', medica: 'medicina', doctor: 'medicina', doctora: 'medicina',
  abogado: 'derecho', abogada: 'derecho', profesor: 'educacion', profesora: 'educacion', docente: 'educacion', maestro: 'educacion', maestra: 'educacion',
  enfermero: 'enfermeria', enfermera: 'enfermeria', contador: 'contabilidad', contadora: 'contabilidad',
  psicologo: 'psicologia', psicologa: 'psicologia', arquitecto: 'arquitectura', arquitecta: 'arquitectura',
  programador: 'computacion', dentista: 'odontologia', odontologo: 'odontologia', veterinario: 'veterinaria', veterinaria: 'veterinaria',
  economista: 'economia', periodista: 'comunicacion', administrador: 'administracion', enfermeria: 'enfermeria',
};
const fmtPair = (v) => `a los 18-29 años S/ ${Number(v[0]).toLocaleString('es-PE')}, a los 30+ años S/ ${Number(v[1]).toLocaleString('es-PE')}`;

export function salaryContextFor(question, studentRegion) {
  const nq = norm(question);
  if (!SALARY_RE.test(nq)) return '';
  // regions mentioned (or student's, or Lima as default), max 3
  const all = ['Nacional', ...SAL_REGIONS];
  let regions = all.filter((r) => nq.includes(norm(r)));
  if (/\b(peru|pais)\b/.test(nq) && !regions.includes('Nacional')) regions.push('Nacional');
  if (studentRegion && all.includes(studentRegion) && !regions.includes(studentRegion)) regions.unshift(studentRegion);
  if (!regions.length) regions = ['Lima'];
  regions = [...new Set(regions)].slice(0, 3);
  // careers mentioned (stem overlap + job-word aliases), max 4.
  // Drop generic words a student uses that aren't career-specific (else "carreras" matches
  // "Otras carreras de educación", "mejor" nothing, etc.).
  const STOP = new Set(['carre', 'traba', 'estud', 'curso', 'mejor', 'futur', 'opcio', 'pagan', 'otras', 'gente', 'much', 'menos']);
  const qStems = new Set((nq.match(/[a-z]{4,}/g) || []).map((w) => w.slice(0, 5)).filter((s) => !STOP.has(s)));
  for (const kw in CAREER_KW) if (nq.includes(kw)) qStems.add(norm(CAREER_KW[kw]).slice(0, 5));
  const matched = [];
  for (const key in SAL.carreras) {
    const stems = (norm(SAL.carreras[key].n).match(/[a-z]{4,}/g) || []).map((w) => w.slice(0, 5));
    const hit = stems.filter((s) => qStems.has(s)).length;
    if (hit > 0) matched.push({ key, name: SAL.carreras[key].n, hit });
  }
  matched.sort((a, b) => b.hit - a.hit);
  const lines = [];
  if (matched.length) {
    for (const m of matched.slice(0, 4)) {
      const parts = regions.map((reg) => { const v = SAL.carreras[m.key].r[reg]; return v ? `${reg}: ${fmtPair(v)}` : null; }).filter(Boolean);
      if (parts.length) lines.push(`- ${m.name} — ${parts.join('; ')}.`);
    }
  } else {
    const reg = regions[0];
    for (const c of salariesForRegion(reg).slice(0, 12)) lines.push(`- ${c.nombre} (${reg}): ${fmtPair([c.joven, c.adulto])}.`);
  }
  if (!lines.length) return '';
  return '== SUELDOS REALES POR REGIÓN (MTPE · Mi Carrera, ingreso mensual promedio) ==\n' +
    'Usa estas cifras EXACTAS si responden la pregunta. Son ingresos promedio POR EDAD del trabajador (no por años de experiencia): la primera cifra es a los 18-29 años, la segunda a los 30+ años. No las llames "con experiencia".\n' +
    lines.join('\n') +
    '\nSi piden otra carrera o región que no esté aquí, di que abran «Datos verificados → Sueldos» y elijan su región. No inventes cifras.\n';
}
