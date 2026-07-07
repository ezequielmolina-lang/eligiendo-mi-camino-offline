// refresh-region-salaries.mjs — fetch per-region salary data from MTPE "Mi Carrera" and
// bake it into src/data/kb.json (salarios_region). Run from the project root:  node scripts/refresh-region-salaries.mjs
//
// Source: https://micarrera.trabajo.gob.pe (public API, no auth). The app NEVER calls this at
// runtime — the data is downloaded here and baked at build time so the app works fully offline.
// Re-run this whenever MTPE updates its figures (roughly annual).
import fs from 'node:fs';

const API = 'https://portal.trabajo.gob.pe/micarreraback/api/carreras-mejor-pagadas/buscar';
const HEADERS = {
  'Content-Type': 'application/json', 'Accept': 'application/json',
  'Origin': 'https://micarrera.trabajo.gob.pe', 'Referer': 'https://micarrera.trabajo.gob.pe/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
};
// codDep -> app region label (Nacional = all-Peru reference; rest are departamentos).
const DEP = {
  '00': 'Nacional', '01': 'Amazonas', '02': 'Áncash', '03': 'Apurímac', '04': 'Arequipa', '05': 'Ayacucho',
  '06': 'Cajamarca', '07': 'Callao', '08': 'Cusco', '09': 'Huancavelica', '10': 'Huánuco', '11': 'Ica',
  '12': 'Junín', '13': 'La Libertad', '14': 'Lambayeque', '15': 'Lima', '16': 'Loreto', '17': 'Madre de Dios',
  '18': 'Moquegua', '19': 'Pasco', '20': 'Piura', '21': 'Puno', '22': 'San Martín', '23': 'Tacna',
  '24': 'Tumbes', '25': 'Ucayali', '26': 'Lima Provincias',
};
// Explorer occupation name (normalized) -> API career key (normalized), where the API has the
// SAME-level career under a slightly different spelling.
const ALIAS = { 'tecnico en mineria, metalurgia y petroleo': 'tecnico en minera, metalurgia y petroleo' };

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchDep(code) {
  const body = JSON.stringify({ departamentoId: code, page: 0, size: 200, sortBy: 'ingPromJovenes', sortDirection: 'desc' });
  const r = await fetch(API, { method: 'POST', headers: HEADERS, body });
  const j = await r.json();
  if (!j.exito || !j.data) throw new Error('dep ' + code + ': ' + (j.mensaje || 'sin data'));
  return j.data.content;
}

const carreras = {}, regionSet = new Set();
for (const code of Object.keys(DEP)) {
  const content = await fetchDep(code);
  const region = DEP[code];
  if (code !== '00') regionSet.add(region);
  for (const c of content) {
    const n = norm(c.carreraNombre);
    if (!carreras[n]) carreras[n] = { n: c.carreraNombre, r: {} };
    carreras[n].r[region] = [c.ingPromJovenes, c.ingPromAdultos];
  }
  console.log('  ' + region + ': ' + content.length + ' carreras');
  await sleep(250); // be polite to the public API
}

const salarios_region = {
  fuente: 'Mi Carrera — MTPE (Planilla Electrónica). Ingreso promedio mensual, referencial.',
  enlace: 'https://micarrera.trabajo.gob.pe',
  regiones: [...regionSet].sort((a, b) => a.localeCompare(b, 'es')),
  alias: ALIAS,
  carreras,
};
const KB_PATH = 'src/data/kb.json';
const kb = JSON.parse(fs.readFileSync(KB_PATH, 'utf8'));
kb.salarios_region = salarios_region;
fs.writeFileSync(KB_PATH, JSON.stringify(kb, null, 2) + '\n');
console.log('\n✅ Injected salarios_region:', Object.keys(carreras).length, 'carreras ×', salarios_region.regiones.length, 'regiones →', KB_PATH);
