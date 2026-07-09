// coach-transformers.js — ALTERNATIVE local LLM engine using transformers.js (@huggingface/transformers v3) on WebGPU.
//
// WHY THIS EXISTS: coach.js runs models via WebLLM/MLC. We now have a FINE-TUNED model that will be
// distributed as ONNX (q4f16) on the HuggingFace Hub — which MLC/WebLLM cannot load, but transformers.js can.
// This module is an ADDITIVE, drop-in alternative: it mirrors coach.js's EXACT public API so the rest of the
// app (gallito-chat.jsx, offline-card.jsx) works unchanged. coach.js delegates here when the engine switch
// (localStorage['emc_engine'] === 'transformers') is set. Default stays 'webllm' — see getEngineKind() in coach.js.
//
// BUILD NOTE (esbuild): @huggingface/transformers is pure ESM. build.mjs already bundles ESM (it pulls in
// @mlc-ai/web-llm), so `import`-ing it works with no esbuild config change. The ONNX model itself is NOT
// bundled: transformers.js fetches it from the HF Hub by repo id at runtime (over the network on first use)
// and caches it in the browser Cache Storage, so subsequent loads are offline — same UX as the WebLLM path.
// The ONNX Runtime Web WASM/WebGPU backend files are fetched from a jsDelivr CDN by default; for a fully
// air-gapped/USB build you must self-host them and set `env.backends.onnx.wasm.wasmPaths` (see VERIFY below).
import { pipeline, TextStreamer, env } from '@huggingface/transformers';
import { logEvent } from './telemetry.js';

// The fine-tuned model lives on the HF Hub as ONNX (q4f16). It is selected/loaded by repo id at runtime.
// Hosted (public): https://huggingface.co/ezequielmolina/gallito-1.5b-onnx
export const EMC_MODEL_ID = 'ezequielmolina/gallito-1.5b-onnx';
// Quantization of the ONNX weights to load. q4f16 = 4-bit weights + fp16 compute → small + WebGPU-friendly.
const EMC_DTYPE = 'q4f16';

// transformers.js fetches model files from the HF Hub by id and caches them in the browser.
// allowLocalModels=false: do NOT look for ./models/<id> first (that path is the WebLLM bundled-model convention,
// not an ONNX layout) — go straight to the Hub. useBrowserCache=true: cache fetched files so reloads are offline.
try {
  // OPTIONAL same-origin local model source. When the model files are self-hosted alongside the app
  // (build.mjs copies a top-level models/ dir into dist/models/), loading from same-origin is faster and
  // — crucially — RESUMABLE: unlike the HF Xet CDN (which doesn't expose Content-Length cross-origin, so a
  // dropped connection restarts the whole 1.3 GB download), a same-origin static host sends Content-Length +
  // Accept-Ranges. Enable with ?localmodel=1 (or persist emc_localmodel=1). Default stays: stream from the Hub.
  const _wantLocal = (() => {
    try {
      if (typeof location !== 'undefined' && /[?&]localmodel=1/.test(location.search)) return true;
      if (typeof localStorage !== 'undefined' && localStorage.getItem('emc_localmodel') === '1') return true;
    } catch (e) {}
    return false;
  })();
  if (_wantLocal) {
    env.allowLocalModels = true;
    env.localModelPath = '/models/';   // resolves /models/<repo-id>/onnx/model_q4f16.onnx
    env.useBrowserCache = false;        // files are already local; no need to duplicate in Cache Storage
  } else {
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    // WHERE TO STREAM THE MODEL FROM. Default = Hugging Face Hub. To use a host that supports Content-Length +
    // Range (Cloudflare R2, S3+CloudFront, uDocz's own server) — which fixes the flaky/no-resume 1.3 GB HF
    // download — set MODEL_CDN to that base URL. transformers.js fetches {remoteHost}/{repo-id}/resolve/main/
    // onnx/model_q4f16.onnx (+ .onnx_data + configs), so the CDN must mirror that exact path layout.
    const MODEL_CDN = '';  // e.g. 'https://pub-xxxxxxxx.r2.dev'  — leave '' to use Hugging Face
    let _cdn = MODEL_CDN;
    try {
      const q = (typeof location !== 'undefined') && new URLSearchParams(location.search).get('modelhost');
      _cdn = q || (typeof localStorage !== 'undefined' && localStorage.getItem('emc_modelhost')) || MODEL_CDN || '';
    } catch (e) {}
    if (_cdn) {
      try { env.remoteHost = String(_cdn).replace(/\/$/, ''); env.remotePathTemplate = '{model}/resolve/{revision}/'; } catch (e) {}
    }
  }
} catch (e) {}

// CRITICAL for GitHub Pages / any host WITHOUT COOP+COEP cross-origin-isolation headers:
// the page is NOT crossOriginIsolated, so SharedArrayBuffer is unavailable. onnxruntime-web ships a
// *threaded* WASM build (ort-wasm-simd-threaded.jsep.wasm); if it tries to spawn pthreads it aborts with an
// opaque numeric WASM exception (e.g. 1364322384) at SESSION CREATION — for EVERY model, before any generation.
// That was the real "No pude iniciar el asistente" cause. Force single-thread + no proxy worker so the WebGPU
// EP runs on the main thread with no SharedArrayBuffer requirement. (GPU still does the compute; this only
// controls the WASM glue/threading.)
try {
  env.backends.onnx.wasm.numThreads = 1;
  // proxy=true runs ORT (WASM + WebGPU EP) in a Web Worker, so the heavy first-load shader compile of a big
  // model (the 1.5B takes minutes) happens OFF the main thread — the UI stays responsive with a progress bar
  // instead of freezing the tab. Key to making the 1.5B usable in-browser. Disable with ?noproxy=1 if a device's
  // worker can't get WebGPU (then it compiles on the main thread as before).
  const _noProxy = (() => { try { return typeof location !== 'undefined' && /[?&]noproxy=1/.test(location.search); } catch (e) { return false; } })();
  env.backends.onnx.wasm.proxy = !_noProxy;
} catch (e) {}

// ---- Public API mirror (must match coach.js) -----------------------------------------------------------
// Single curated model: the fine-tuned Gallito. (coach.js exposes 3 MLC sizes; here there is one ONNX build.)
// Same shape {id,label,sizeGB,note} so offline-card.jsx's model <select> renders without changes.
export const V2_MODEL_ID = 'ezequielmolina/gallito-1.5b-v2-onnx';   // hosted on HF (4-step v2)
export const V3_MODEL_ID = 'ezequielmolina/gallito-v3-1.5b-onnx';   // hosted on HF (Trained on Opus, 1.5B)
export const V3_05B_MODEL_ID = 'ezequielmolina/gallito-v3-0.5b-onnx'; // Trained on Opus, 0.5B
export const V3_LLAMA_MODEL_ID = 'ezequielmolina/gallito-v3-llama-1b-onnx'; // Trained on Opus, Llama-3.2-1B
// The 0.5B v3 is the DEFAULT for the browser: onnxruntime-web can't stage the 1.5B (q4f16 ~1.27 GB) — WebGPU
// aborts with an opaque numeric exception and single-thread wasm (no cross-origin isolation on GitHub Pages) is
// too slow. The 0.5B (~0.56 GB) runs on the WebGPU EP and downloads fast. The 1.5B stays available for powerful
// PCs / a cross-origin-isolated host. NOTE: keep in sync with coach.js's TF_MODELS.
// 1.5B is now packaged with EXTERNAL DATA (small graph + streamed .onnx_data) so ort-web no longer has to
// stage the whole 1.27 GB in the WASM heap (the single-file blob was what aborted at ~model size). It's the
// DEFAULT (best quality). The 0.5B stays as the immediate auto-fallback: if a device still can't run the 1.5B,
// getEngine drops to it (fast, WebGPU-safe) so the student always gets a working coach.
// Browser DEFAULT = 0.5B: it loads in seconds and generates smoothly on WebGPU. The 1.5B (best quality) is
// kept selectable, BUT in a typical browser its WebGPU shader-compile takes minutes and freezes the tab each
// load (compilation isn't cached across sessions) — so it's a "powerful PC / server-side" option, not the
// default. External-data packaging fixed the 1.5B's load *crash*, but not its compile *time*.
// DEFAULT = 1.5B (best quality). It runs in the browser with external-data weights + proxy (off-main-thread
// compile); the first load is heavy (minutes to compile) but the UI stays responsive. If a device can't run it,
// getEngine auto-falls-back down this list: Llama-1B (lighter, strong quality) → 0.5B (fastest) → v2 → v1.
export const MODELS = [
  { id: V3_MODEL_ID, label: 'Gallito · Trained on Opus (1.5B)', sizeGB: 1.35, note: 'máxima calidad — destilado de Opus (recomendado)' },
  { id: V3_LLAMA_MODEL_ID, label: 'Gallito · Trained on Opus (Llama 1B)', sizeGB: 0.9, note: 'buena calidad, más liviano que el 1.5B' },
  { id: V3_05B_MODEL_ID, label: 'Gallito · Trained on Opus (0.5B)', sizeGB: 0.56, note: 'el más rápido — para equipos modestos' },
  { id: V2_MODEL_ID, label: 'Gallito v2', sizeGB: 1.35, note: 'v2 afinado 4 pasos (ONNX)' },
  { id: EMC_MODEL_ID, label: 'Gallito v1', sizeGB: 1.0, note: 'v1 Paso-1 (ONNX)' },
];
export const DEFAULT_MODEL = MODELS[0].id;   // 1.5B v3 — best quality; auto-falls back to Llama-1B / 0.5B

// Model selection persists in localStorage. We reuse the SAME key coach.js uses ('emc_model') so switching
// engines doesn't lose/clobber the choice. If a stale WebLLM/MLC id is stored, we coerce to our ONNX id
// (transformers.js can't load MLC ids), so the fine-tuned model is always what actually loads here.
const LS_MODEL = 'emc_model';
export function getSelectedModel() {
  try {
    const v = localStorage.getItem(LS_MODEL);
    if (!v || !MODELS.some((m) => m.id === v)) return DEFAULT_MODEL; // ignore MLC ids from the other engine
    return v;
  } catch (e) { return DEFAULT_MODEL; }
}
export function setSelectedModel(id) { try { localStorage.setItem(LS_MODEL, id); } catch (e) {} }

// Mock mode (?mock=1): identical to coach.js — simulate engine + streaming with NO download. Same flag,
// so demo behavior is engine-agnostic.
export const MOCK = (typeof location !== 'undefined' && /[?&]mock=1/.test(location.search));

export function webgpuAvailable() {
  if (MOCK) return true;
  return typeof navigator !== 'undefined' && !!navigator.gpu;
}

// No pen-drive/USB "bundled model" path for ONNX yet (the WebLLM app-config.json convention doesn't apply).
// Kept for API parity so callers can call it unconditionally. Always false → app shows the normal download flow.
// VERIFY ONCE MODEL IS HOSTED: if you later want a fully offline/USB ONNX build, self-host the model files +
// the ORT wasm/webgpu backend and wire env.localModelPath / env.backends.onnx.wasm.wasmPaths here.
export async function hasBundledModel() { return false; }

let _engine = null;       // the loaded text-generation pipeline (carries .tokenizer)
let _engineModel = null;  // id of the currently loaded model
let _engineDevice = null; // execution provider actually used ('webgpu' | 'wasm')
let _loading = null;      // in-flight load promise (dedupes concurrent getEngine calls)

const _isGpuErr = (e) => /device.*lost|gpu|webgpu|out of memory|oom|adapter|d3d|vulkan/i.test(String((e && e.message) || e));

// Map transformers.js progress_callback events → the {progress: 0..1, text} shape coach.js/WebLLM emit,
// so gallito-chat.jsx's loading bar and offline-card.jsx work unchanged.
// progress_callback fires per-file with {status, name, file, progress: 0..100, loaded, total} and an aggregate
// {status:'progress_total', progress: 0..100}. We surface the aggregate when present, else the per-file value.
function _mkProgressCb(onProgress) {
  return (info) => {
    if (!onProgress) return;
    try {
      if (info.status === 'progress' || info.status === 'progress_total') {
        const frac = typeof info.progress === 'number' ? info.progress / 100 : 0;
        const what = info.file ? `Descargando ${info.file}` : 'Descargando modelo';
        onProgress({ progress: frac, text: `${what}…` });
      } else if (info.status === 'initiate' || info.status === 'download') {
        onProgress({ progress: 0, text: 'Preparando descarga…' });
      } else if (info.status === 'done' || info.status === 'ready') {
        onProgress({ progress: 1, text: 'Listo' });
      }
    } catch (e) {}
  };
}

// Lazily create (or reuse) the pipeline. onProgress receives {progress, text} reports (WebLLM-compatible).
// NOTE: unlike coach.js there is NO model-size auto-fallback ladder — there is a single fine-tuned ONNX build.
// If WebGPU can't load it, we surface the error (gallito-chat.jsx shows the retry / "continue without AI" screen).
export async function getEngine(modelId = DEFAULT_MODEL, onProgress) {
  if (MOCK) {
    for (let i = 0; i <= 10; i++) {
      await new Promise((r) => setTimeout(r, 120));
      onProgress && onProgress({ progress: i / 10, text: `Modo demo: simulando descarga ${i * 10}%` });
    }
    _engine = { mock: true }; _engineModel = modelId; return _engine;
  }
  modelId = MODELS.some((m) => m.id === modelId) ? modelId : DEFAULT_MODEL; // only our ONNX id is loadable here
  if (_engine && _engineModel === modelId) return _engine;
  if (_loading && _engineModel === modelId) return _loading;
  _engineModel = modelId;

  // AUTO-FALLBACK ladder: the requested model first, then EVERY model in MODELS order (deduped). Listing the
  // full set — not just the ones after the requested index — guarantees the in-browser-safe 0.5B default is
  // always reachable even if a heavier model (e.g. the 1.5B, which WebGPU can't stage) was selected/stored.
  const _candidates = [...new Set([modelId, ...MODELS.map((m) => m.id)])];

  // For each candidate we try TWO execution providers, in order:
  //   'webgpu' → fast, GPU. But onnxruntime-web's WebGPU EP CRASHES on the 1.5B q4f16 graph on some
  //              GPUs/drivers with an opaque numeric WASM exception (verified: a tiny model runs on WebGPU here,
  //              but the 1.5B throws 1364322384 with no name/message — a raw WASM abort, not a JS Error).
  //   'wasm'   → CPU. Slower (this is exactly the paper's ~5.8 tok/s low-end-CPU path) but ROBUST — the same
  //              q4f16 model generates on CPU (verified via a Node onnxruntime harness). So if WebGPU aborts,
  //              the student still gets a working coach on CPU instead of a dead-end error screen.
  // Only offer 'webgpu' when the browser actually has it; otherwise go straight to CPU.
  // CPU MODE (?cpu=1 or emc_cpu=1): skip WebGPU entirely and run on WASM-CPU. WebGPU is fast to RUN but has a
  // huge one-time SHADER-COMPILE cost on a big model (the 1.5B: minutes). CPU has NO compile step — it starts
  // generating immediately (slower per token, but no multi-minute "Preparando" freeze). On a host with COOP/COEP
  // (Cloudflare/uDocz) CPU also goes multi-threaded → noticeably faster. For a heavy model on a modest machine,
  // CPU-immediate is often a better experience than GPU-after-a-long-compile.
  const _forceCpu = (() => { try {
    if (typeof location !== 'undefined' && /[?&]cpu=1/.test(location.search)) return true;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('emc_cpu') === '1') return true;
  } catch (e) {} return false; })();
  const _devices = _forceCpu ? ['wasm'] : (webgpuAvailable() ? ['webgpu', 'wasm'] : ['wasm']);

  async function _tryLoad(id, device) {
    const gen = await pipeline('text-generation', id, {
      device,
      dtype: EMC_DTYPE,
      progress_callback: _mkProgressCb(onProgress),
    });
    // Warm up: surface any instantiation/first-run error NOW (so we can fall back).
    onProgress && onProgress({ progress: 1, text: device === 'wasm' ? 'Afinando el modelo (CPU)…' : 'Afinando el modelo…' });
    await gen([{ role: 'user', content: 'Hola' }], { max_new_tokens: 1, do_sample: false });
    return gen;
  }

  _loading = (async () => {
    let lastErr;
    for (let k = 0; k < _candidates.length; k++) {
      const id = _candidates[k];
      for (const device of _devices) {
        try {
          if (device === 'wasm' && _devices.length > 1) { try { onProgress && onProgress({ progress: 0, text: 'Cambiando a modo CPU (más lento)…' }); } catch (_) {} }
          else if (k > 0) { try { onProgress && onProgress({ progress: 0, text: 'Probando un modelo alternativo…' }); } catch (_) {} }
          const gen = await _tryLoad(id, device);
          _engine = gen; _engineModel = id; _engineDevice = device; _loading = null;
          try { logEvent('model_ready', { model: id, requested: modelId, fell_back: id !== modelId, device, engine: 'transformers' }); } catch (_) {}
          return gen;
        } catch (err) {
          lastErr = err;
          console.error(`[getEngine] load FAILED model=${id} device=${device}:`, err, '| val=', String(err), '| type=', typeof err, '| name=', err && err.name, '| msg=', err && err.message);
          try { logEvent('model_load_failed', { model: id, requested: modelId, device, err: String((err && err.message) || err).slice(0, 140) }); } catch (_) {}
          // webgpu failed → retry SAME model on CPU (wasm); if that fails too → next (lighter) candidate.
        }
      }
    }
    _loading = null; _engineModel = null;
    throw lastErr;
  })();
  return _loading;
}

// Whether the fine-tuned model is already cached locally (browser Cache Storage) → "ready offline".
// VERIFY ONCE MODEL IS HOSTED: confirm the exact cache key/listing transformers.js v3 uses; the heuristic
// below checks Cache Storage for any entry mentioning the repo id. Falls back to false (shows download flow).
export async function isModelCached(modelId = DEFAULT_MODEL) {
  if (MOCK) return false;
  try {
    if (typeof caches === 'undefined') return false;
    const idPart = String(modelId).split('/').pop();
    const names = await caches.keys();
    for (const n of names) {
      // transformers.js stores Hub files in a cache named like 'transformers-cache'.
      if (!/transformers/i.test(n)) continue;
      const c = await caches.open(n);
      const reqs = await c.keys();
      if (reqs.some((r) => r.url.includes(modelId) || r.url.includes(idPart))) return true;
    }
    return false;
  } catch (e) { return false; }
}

export function engineReady(modelId) {
  return !!_engine && (!modelId || _engineModel === modelId);
}

// Build a Qwen2.5 prompt from [{role,content}] messages using the tokenizer's chat template, then stream tokens.
// We use the tokenizer's apply_chat_template (NOT a hand-written template) so it stays correct for whatever
// chat format the fine-tuned model was trained with (Qwen2.5 = ChatML <|im_start|>/<|im_end|>).
//
// Streaming/return shape MATCHES coach.js exactly: calls onToken(deltaText, fullText) as tokens arrive and
// resolves to the full text. Generation params are mapped to transformers.js equivalents:
//   max_tokens          → max_new_tokens
//   temperature         → temperature (+ do_sample=true when temperature>0, else greedy)
//   frequency/presence  → repetition_penalty (transformers.js has no separate freq/presence penalties;
//                         we fold them into a single repetition_penalty so the anti-repeat intent carries over)
export async function chat(messages, { temperature = 0.6, max_tokens = 768, frequency_penalty = 0, presence_penalty = 0, onToken, signal } = {}) {
  if (MOCK) return _mockChat(messages, onToken);
  if (!_engine) throw new Error('ENGINE_NOT_READY');

  // Map WebLLM/OpenAI-style freq/presence penalties (~0..1) onto transformers.js repetition_penalty (~1.0..1.3).
  // repetition_penalty=1.0 means "no penalty"; higher = stronger. We take the larger of the two as the driver.
  const penalty = Math.max(frequency_penalty || 0, presence_penalty || 0);
  const repetition_penalty = 1 + Math.min(0.3, Math.max(0, penalty) * 0.3);
  const do_sample = temperature > 0;

  // Stream deltas via TextStreamer. skip_prompt:true → only NEW tokens; skip_special_tokens:true → no <|im_end|>.
  let full = '';
  const streamer = new TextStreamer(_engine.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (text) => {
      if (!text) return;
      if (signal?.aborted) return; // best-effort: stop forwarding once aborted (generation may still finish)
      full += text;
      try { onToken && onToken(text, full); } catch (e) {}
    },
  });

  try {
    // Passing the messages array lets the pipeline apply the tokenizer's chat template + add_generation_prompt.
    const out = await _engine(messages, {
      max_new_tokens: max_tokens,
      temperature,
      do_sample,
      repetition_penalty,
      streamer,
    });
    // Prefer the streamed text. If a backend ever doesn't stream, fall back to parsing the pipeline output:
    // out = [{ generated_text: [...messages, { role:'assistant', content }] }] for chat-style input.
    if (!full) {
      try {
        const gt = out?.[0]?.generated_text;
        if (Array.isArray(gt)) full = gt[gt.length - 1]?.content || '';
        else if (typeof gt === 'string') full = gt;
      } catch (e) {}
    }
    return full;
  } catch (e) {
    // GPU "device lost"/OOM: drop the dead pipeline so a retry RELOADS it (mirrors coach.js).
    if (_isGpuErr(e)) { _engine = null; _engineModel = null; _loading = null; }
    throw e;
  }
}

// Canned streaming reply for demo mode — copied from coach.js so ?mock=1 behaves identically on both engines.
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

// =====================================================================================================
// VERIFY ONCE MODEL IS HOSTED (cannot be tested here — no hosted model, no GPU):
//   1. REAL HF REPO ID: set EMC_MODEL_ID to the real repo (e.g. 'EMC/gallito-1.5b-onnx'). The repo must
//      contain an `onnx/` folder with the q4f16 weights + config.json/tokenizer.json/tokenizer_config.json
//      (and generation_config.json). Confirm `pipeline('text-generation', id, {dtype:'q4f16'})` resolves them.
//   2. CHAT TEMPLATE: confirm tokenizer_config.json ships a Qwen2.5 chat_template (ChatML) so
//      apply_chat_template produces <|im_start|>system…<|im_end|>…<|im_start|>assistant correctly, and that
//      a system message + multi-turn history render as expected. Compare one prompt vs. the WebLLM path.
//   3. q4f16 ON WEBGPU: verify dtype 'q4f16' actually loads & runs on WebGPU on a target school device
//      (Chrome/Edge). If q4f16 is unavailable for this model, fall back to 'q4' (q4f16 needs fp16 GPU support).
//   4. STREAMING: confirm TextStreamer callback_function fires per token and onToken(delta, full) drives the
//      live typing UI in gallito-chat.jsx (skip_prompt:true must hide the prompt echo).
//   5. STOP TOKENS: confirm generation stops at the Qwen2.5 EOS / <|im_end|> (from generation_config.json)
//      and that skip_special_tokens:true strips it from the visible text — no trailing <|im_end|> leakage.
//   6. ABORT: signal-based cancel is best-effort here (we stop forwarding tokens). If hard cancel is needed,
//      check whether this transformers.js version supports a StoppingCriteria / AbortSignal on generate().
//   7. OFFLINE CACHE: confirm isModelCached() matches the actual Cache Storage name/keys this version uses,
//      and that a 2nd load works with the network disconnected (true offline). Adjust the heuristic if needed.
//   8. ORT BACKEND FILES: by default the ONNX Runtime Web wasm/webgpu files load from a CDN. For an
//      air-gapped/USB build, self-host them and set env.backends.onnx.wasm.wasmPaths to the local path.
//   9. VERSION/API: pinned to @huggingface/transformers ^3.8.1 (latest v3). v4.x is now published; if you
//      upgrade, re-verify pipeline/TextStreamer/dtype/device signatures (this file targets the v3 API).
// =====================================================================================================
