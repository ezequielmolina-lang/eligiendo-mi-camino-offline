// coach.js — local LLM engine (WebLLM / WebGPU) for the offline Gallito.
// First use downloads the model (~1–2 GB) and caches it in the browser; afterwards it runs fully offline.
import { CreateMLCEngine, hasModelInCache } from '@mlc-ai/web-llm';
import { logEvent } from './telemetry.js';

// ---- ENGINE SWITCH (additive) --------------------------------------------------------------------------
// Two interchangeable inference backends behind the SAME public API:
//   'webllm'       (DEFAULT) — MLC/WebLLM, the original path below. Behavior is 100% unchanged.
//   'transformers'           — @huggingface/transformers (ONNX/q4f16) in coach-transformers.js, for the
//                              fine-tuned model that MLC can't load. Opt-in only.
// Chosen via localStorage['emc_engine']; default 'webllm' so nothing changes unless explicitly switched.
const LS_ENGINE = 'emc_engine';
export function getEngineKind() {
  try {
    // URL override so a shareable link can opt into the distilled v1: ...?engine=transformers (persists).
    const q = new URLSearchParams(location.search).get('engine');
    if (q === 'transformers' || q === 'webllm') { localStorage.setItem(LS_ENGINE, q); return q; }
    // DEFAULT = the trained v1 (transformers/ONNX). Stock WebLLM only via explicit ?engine=webllm opt-out.
    return localStorage.getItem(LS_ENGINE) === 'webllm' ? 'webllm' : 'transformers';
  } catch (e) { return 'transformers'; }
}
export function setEngineKind(kind) { try { localStorage.setItem(LS_ENGINE, kind === 'transformers' ? 'transformers' : 'webllm'); } catch (e) {} }
// Lazy-load the transformers module ONLY when selected, so its (heavy, ESM) deps never load for webllm users.
let _tfMod = null;          // the import() promise (started on first use)
let _tfModResolved = null;  // the resolved module, cached for SYNC access (engineReady can't await)
function _tf() {
  if (!_tfMod) _tfMod = import('./coach-transformers.js').then((m) => { _tfModResolved = m; return m; });
  return _tfMod;
}

// Curated, Spanish-capable small models available in this WebLLM build.
export const MODELS = [
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Gallito', sizeGB: 1.0, note: 'Recomendado · equilibrado' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Gallito Lite', sizeGB: 0.9, note: 'Más liviano · equipos modestos / celular' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Gallito Plus', sizeGB: 1.9, note: 'Mejor calidad · solo PC potente (exige más GPU)' },
];
// 1.5B por defecto: mucho menos uso de GPU que el 3B (que tumbaba equipos); buena calidad conversacional y los datos son deterministas.
export const DEFAULT_MODEL = MODELS[0].id;

// The model is chosen ONCE (on Home) and reused across every step — one download, cached forever.
const LS_MODEL = 'emc_model';
// The distilled v1 (transformers/ONNX engine) ships as a SINGLE model. Mirror it here (lightweight, no heavy
// import) so the picker shows one option instead of the three WebLLM sizes when that engine is active.
// ⭐ THE BEST MODEL. In the whole-app evaluation, v3 (Trained on Opus, 1.5B) is the offline coach that most
// resembles the cloud coach (quality 1.55/2 vs 1.85; far above v1/v2). To let students try IT in the browser it
// must ship as ONNX q4f16 like v1/v2 — build it once with `export-v3-onnx.md`, push to the HF repo below, then
// flip V3_ONNX_READY to true. It then becomes the recommended DEFAULT automatically; until then the app safely
// falls back to v2 so the loader never breaks.
export const V3_ONNX_READY = true; // ezequielmolina/gallito-v3-1.5b-onnx built + uploaded 2026-07-06 (q4f16, 1.22 GB)
const V3_TF = { id: 'ezequielmolina/gallito-v3-1.5b-onnx', label: 'Gallito · Trained on Opus (recomendado)', sizeGB: 1.35, note: 'el mejor modelo pequeño · el más parecido al coach de la nube · ONNX · corre en el navegador' };
const TF_MODELS = [
  ...(V3_ONNX_READY ? [V3_TF] : []),
  { id: 'ezequielmolina/gallito-1.5b-v2-onnx', label: 'v2 · Trained on Haiku (4 pasos)', sizeGB: 1.35, note: 'versión preliminar (destilado de Haiku, 4 pasos) · ONNX · corre en el navegador' },
  { id: 'ezequielmolina/gallito-1.5b-onnx', label: 'v1 · Trained on Haiku (Paso 1)', sizeGB: 1.35, note: 'destilado de Haiku, Paso 1 · ONNX · corre en el navegador' },
];
// Display-only lineup: models published as PyTorch weights on the HF Hub whose browser ONNX export is still
// pending are shown as "try on a PC" links rather than in-browser options. They are NEVER passed to getEngine()
// (which only loads the ONNX ids above), so the loader can't break. Once V3_ONNX_READY, v3-1.5B moves up into the
// in-browser list and drops off this one.
export const OTHER_MODELS = [
  ...(V3_ONNX_READY ? [] : [{ label: 'v3 · Trained on Opus (1.5B) — el mejor', hf: 'https://huggingface.co/ezequielmolina/gallito-v3-1.5b', note: 'mejor modelo pequeño (como el de la nube) · ONNX en el navegador próximamente · hoy: PyTorch (PC con 🤗 Transformers)' }]),
  { label: 'v3 · Trained on Opus (0.5B)', hf: 'https://huggingface.co/ezequielmolina/gallito-v3-0.5b', note: 'más liviano · PyTorch (PC)' },
  { label: 'v3 · Trained on Opus (Llama-1B)', hf: 'https://huggingface.co/ezequielmolina/gallito-v3-llama-1b', note: 'otra arquitectura · PyTorch (PC)' },
];
// v4 = v3-1.5B run with the grounding directive appended to the system prompt (no separate weights).
export const GROUNDING_DIRECTIVE = 'IMPORTANTE (fidelidad): menciona SOLO carreras, intereses, instituciones o cifras que el estudiante haya dicho o que estén en el contexto. Si no estás seguro, omítelo: es mejor omitir que inventar.';
// Engine-aware model list for the UI picker.
export function getModels() { return getEngineKind() === 'transformers' ? TF_MODELS : MODELS; }
export function getOtherModels() { return getEngineKind() === 'transformers' ? OTHER_MODELS : []; }
export function getSelectedModel() { try { if (getEngineKind() === 'transformers') { const s = localStorage.getItem(LS_MODEL); return (s && TF_MODELS.some((m) => m.id === s)) ? s : TF_MODELS[0].id; } return localStorage.getItem(LS_MODEL) || DEFAULT_MODEL; } catch (e) { return getEngineKind() === 'transformers' ? TF_MODELS[0].id : DEFAULT_MODEL; } }
export function setSelectedModel(id) { try { localStorage.setItem(LS_MODEL, id); } catch (e) {} }

// Mock mode (?mock=1): simulate the engine + streaming WITHOUT downloading a model.
// Lets us verify the full chat UX/flow/telemetry offline; the real model path is identical.
export const MOCK = (typeof location !== 'undefined' && /[?&]mock=1/.test(location.search));

export function webgpuAvailable() {
  if (MOCK) return true;
  return typeof navigator !== 'undefined' && !!navigator.gpu;
}

// If the package ships a bundled model (models/app-config.json), use it — loads from local
// files, fully offline, with NO per-device download (pen-drive / USB distribution).
let _localCfg;
async function getLocalConfig() {
  if (_localCfg !== undefined) return _localCfg;
  try {
    const r = await fetch('./models/app-config.json', { cache: 'no-store' });
    // No bundled model: missing file may 404 or (with SPA fallback) return HTML — both mean "none".
    if (!r.ok || !/json/i.test(r.headers.get('content-type') || '')) { _localCfg = null; return _localCfg; }
    const cfg = await r.json();
    const base = new URL('./', location.href).href; // WebLLM requires ABSOLUTE urls
    (cfg.model_list || []).forEach((m) => {
      if (m.model && m.model.startsWith('.')) m.model = new URL(m.model, base).href;
      if (m.model_lib && m.model_lib.startsWith('.')) m.model_lib = new URL(m.model_lib, base).href;
    });
    _localCfg = cfg;
  } catch (e) { _localCfg = null; }
  return _localCfg;
}
export async function hasBundledModel() {
  if (getEngineKind() === 'transformers') return (await _tf()).hasBundledModel();
  return !!(await getLocalConfig());
}

let _engine = null;
let _engineModel = null;
let _loading = null;

// Heaviest→lightest ladder for auto-fallback when a device can't handle the chosen model.
const _LADDER = ['Llama-3.2-3B-Instruct-q4f16_1-MLC', 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', 'Llama-3.2-1B-Instruct-q4f16_1-MLC', 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'];
const _isGpuErr = (e) => /device.*lost|gpu|webgpu|out of memory|oom|adapter|d3d|vulkan/i.test(String((e && e.message) || e));

// Lazily create (or reuse) the engine. onProgress receives WebLLM init reports ({progress, text}).
// AUTO-FALLBACK: if a device can't load the chosen model (GPU/OOM), it drops to the next lighter
// model automatically (e.g. 1.5B → 1B → 0.5B) so weak school devices still get a working Gallito.
export async function getEngine(modelId = DEFAULT_MODEL, onProgress) {
  if (getEngineKind() === 'transformers') return (await _tf()).getEngine(modelId, onProgress);
  if (MOCK) {
    for (let i = 0; i <= 10; i++) {
      await new Promise((r) => setTimeout(r, 120));
      onProgress && onProgress({ progress: i / 10, text: `Modo demo: simulando descarga ${i * 10}%` });
    }
    _engine = { mock: true }; _engineModel = modelId; return _engine;
  }
  if (!webgpuAvailable()) throw new Error('NO_WEBGPU');
  const lc = await getLocalConfig();
  if (lc && lc.model_list && lc.model_list[0]) modelId = lc.model_list[0].model_id; // bundled model wins
  if (_engine && _engineModel === modelId) return _engine;
  if (_loading && _engineModel === modelId) return _loading;
  _engineModel = modelId;
  // Bundled package ships ONE model → no fallback. Otherwise: chosen model, then progressively lighter.
  let candidates;
  if (lc) candidates = [modelId];
  else { const i = _LADDER.indexOf(modelId); candidates = i >= 0 ? _LADDER.slice(i) : [modelId, 'Llama-3.2-1B-Instruct-q4f16_1-MLC', 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC']; }

  _loading = (async () => {
    let lastErr;
    for (let k = 0; k < candidates.length; k++) {
      const id = candidates[k];
      try {
        if (k > 0) { try { onProgress && onProgress({ progress: 0, text: 'El equipo no pudo con ese modelo; probando uno más liviano…' }); } catch (e) {} }
        const initOpts = { initProgressCallback: (r) => { try { onProgress && onProgress(r); } catch (e) {} } };
        if (lc) initOpts.appConfig = lc;
        const e = await CreateMLCEngine(id, initOpts);
        // Warm up (compiles shaders now → fast first reply). A GPU failure here also triggers fallback.
        try {
          onProgress && onProgress({ progress: 1, text: 'Afinando el modelo…' });
          await e.chat.completions.create({ messages: [{ role: 'user', content: 'Hola' }], max_tokens: 1 });
        } catch (e2) { if (_isGpuErr(e2)) { try { await (e.unload && e.unload()); } catch (_) {} throw e2; } }
        _engine = e; _engineModel = id; _loading = null;
        if (id !== modelId) { try { setSelectedModel(id); } catch (_) {} } // remember the model that worked
        // RCT: record which model the student actually got (auto-fallback changes the "dose").
        try { logEvent('model_ready', { model: id, requested: modelId, fell_back: id !== modelId, attempt: k }); } catch (_) {}
        return e;
      } catch (err) {
        lastErr = err;
        if (!_isGpuErr(err) || k === candidates.length - 1) break; // non-GPU error, or no lighter option left
      }
    }
    _loading = null; _engineModel = null; throw lastErr;
  })();
  return _loading;
}

export async function isModelCached(modelId = DEFAULT_MODEL) {
  if (getEngineKind() === 'transformers') return (await _tf()).isModelCached(modelId);
  if (MOCK) return false;
  if (await getLocalConfig()) return true; // bundled = always ready, no download
  try { return await hasModelInCache(modelId); } catch (e) { return false; }
}

// Canned streaming reply for demo mode: reflects the last answer, asks the next scripted
// question, and emits the completion marker after enough turns — enough to verify the flow.
async function _mockChat(messages, onToken) {
  const userTurns = messages.filter((m) => m.role === 'user').length;
  const last = [...messages].reverse().find((m) => m.role === 'user');
  const lastTxt = (last?.content || '').slice(0, 40);
  const Q = [
    'Para empezar, **¿qué palabras usarías para describirte hoy?**',
    'Gracias por contarme eso. **¿Qué actividades te gustan o te dan curiosidad en tu día a día?** 😊',
    '¡Interesante! **¿Qué se te da bien casi sin esfuerzo?**',
    'Buen punto. **¿Cómo es un día normal para ti después del colegio?**',
    'Entiendo. **¿En qué cursos sientes que las cosas "hacen clic"?**',
    'Te entiendo. **Cuando algo no te sale bien, ¿qué haces?**',
  ];
  let reply;
  if (userTurns >= 6) {
    reply = '## Tu descripción\n\n**Rasgos que aparecen en tus experiencias**\nEres una persona reflexiva y honesta (demo).\n\n**Talentos o fortalezas iniciales**\nMuestras facilidad e iniciativa (demo).\n\n**Motivaciones e intereses**\nTe atraen los temas que exploraste hoy (demo).\n\n_Esta es una primera mirada que puede cambiar._';
  } else {
    const refl = lastTxt ? `Anoté: “${lastTxt}…”. ` : '';
    reply = refl + (Q[userTurns] || Q[0]);
  }
  const words = reply.split(/(\s+)/);
  let full = '';
  for (const w of words) {
    await new Promise((r) => setTimeout(r, 18));
    full += w; onToken && onToken(w, full);
  }
  return full;
}

export function engineReady(modelId) {
  // transformers path: consult that module's own engine state. It's sync, so we use the cached resolved
  // module (populated once getEngine has run). Before it's loaded, "not ready" is the correct answer.
  if (getEngineKind() === 'transformers') { _tf(); return _tfModResolved ? _tfModResolved.engineReady(modelId) : false; }
  return !!_engine && (!modelId || _engineModel === modelId);
}

// Streaming chat completion. `messages` = [{role,content}] including a system message.
// Calls onToken(deltaText, fullText) as tokens arrive; resolves to the full text.
export async function chat(messages, opts = {}) {
  if (getEngineKind() === 'transformers') return (await _tf()).chat(messages, opts);
  const { temperature = 0.6, max_tokens = 768, frequency_penalty = 0, presence_penalty = 0, onToken, signal } = opts;
  if (MOCK) return _mockChat(messages, onToken);
  if (!_engine) throw new Error('ENGINE_NOT_READY');
  try {
    const stream = await _engine.chat.completions.create({ messages, stream: true, temperature, max_tokens, frequency_penalty, presence_penalty });
    let full = '';
    for await (const chunk of stream) {
      if (signal?.aborted) break;
      const d = chunk?.choices?.[0]?.delta?.content || '';
      if (d) { full += d; try { onToken && onToken(d, full); } catch (e) {} }
    }
    return full;
  } catch (e) {
    // GPU "device lost" / OOM: drop the dead engine so a retry RELOADS it (instead of reusing the dead one).
    if (_isGpuErr(e)) { _engine = null; _engineModel = null; _loading = null; }
    throw e;
  }
}
