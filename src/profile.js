// Shared student profile that accumulates across steps, so the later AI steps
// (Paso 7 familia, Paso 8 plan) know what the earlier steps learned. Persisted locally.
const LS = 'emc_profile';

export function getProfile() {
  try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; }
}
export function updateProfile(patch) {
  try { const p = { ...getProfile(), ...patch }; localStorage.setItem(LS, JSON.stringify(p)); return p; } catch (e) { return patch; }
}

// A compact context block to inject into the system prompt of later steps.
export function profileContext() {
  const p = getProfile();
  const L = [];
  if (p.name) L.push('Nombre: ' + p.name);
  if (p.selfDescription) L.push('Autoconocimiento (Paso 1): ' + p.selfDescription);
  if (p.riasec) L.push('Intereses — test RIASEC (Paso 2): ' + p.riasec);
  if (p.route) L.push('Ruta que prefiere (Paso 4): ' + p.route);
  if (p.favorites && p.favorites.length) L.push('Ocupaciones que le interesan (Paso 5): ' + p.favorites.join(', '));
  // Step-6 research shortlist — the offline-only memory the cloud (external NotebookLM) never had.
  // Lets later steps fill the "explored/researched" slot from what the student actually researched,
  // instead of inventing it. Written by the Step-6 flow via updateProfile({ step6: ... }).
  if (p.step6) L.push('Investigación que hizo (Paso 6): ' + p.step6);
  if (!L.length) return '';
  return '\n\n=== LO QUE YA SABEMOS DEL ESTUDIANTE (de los pasos anteriores) ===\n' + L.join('\n') +
    '\n=== FIN DEL CONTEXTO ===\nUsa esta información para personalizar tu ayuda y hacer un plan concreto y realista; no la repitas textualmente.';
}
