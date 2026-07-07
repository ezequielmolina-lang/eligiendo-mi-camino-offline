// CPU on-device benchmark for the deployed gallito-v2 (q4f16 ONNX), transformers.js.
// Measures: model load time, prefill / time-to-first-token, decode throughput (tok/s), peak RSS.
import { pipeline, env } from '@huggingface/transformers';
import os from 'os';

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = './public/models/';

// peak-RSS sampler (RSS includes native onnxruntime allocations)
let peakRss = 0;
const sampler = setInterval(() => {
  const r = process.memoryUsage().rss;
  if (r > peakRss) peakRss = r;
}, 150);

const MB = b => (b / 1048576).toFixed(0);
const S  = ms => (ms / 1000).toFixed(2);

console.log(`host: ${os.cpus()[0].model.trim()} | ${os.cpus().length} threads | ${(os.totalmem()/1e9).toFixed(1)} GB`);

const tLoad0 = Date.now();
const gen = await pipeline('text-generation', 'gallito-v2-onnx', { device: 'cpu', dtype: 'q4f16' });
const loadMs = Date.now() - tLoad0;
console.log(`load: ${S(loadMs)} s`);

const msgs = [
  { role: 'system', content: 'Eres Gallito, un guia vocacional calido y breve para estudiantes de secundaria en Peru.' },
  { role: 'user', content: 'Hola, me llamo Rosa. No se muy bien que estudiar despues del colegio.' },
];

// warmup (also compiles/caches graph)
await gen(msgs, { max_new_tokens: 8, do_sample: false });

// prefill / TTFT: time to produce 1 new token
const tA = Date.now();
await gen(msgs, { max_new_tokens: 1, do_sample: false });
const ttftMs = Date.now() - tA;

// decode throughput: N new tokens
const N = 64;
const tB = Date.now();
const out = await gen(msgs, { max_new_tokens: N, do_sample: false });
const tNMs = Date.now() - tB;

const txt = out?.[0]?.generated_text;
const reply = Array.isArray(txt) ? txt[txt.length - 1].content : txt;

const decodeMs = tNMs - ttftMs;                 // time to decode tokens 2..N
const decodeTps = (N - 1) / (decodeMs / 1000);  // tokens/sec during decode
const e2eTps = N / (tNMs / 1000);               // end-to-end incl. prefill

clearInterval(sampler);
console.log('----- RESULTS (CPU-only, q4f16) -----');
console.log(`model on disk : 1.35 GB`);
console.log(`load time     : ${S(loadMs)} s`);
console.log(`TTFT (prefill+1 tok, ${msgs.reduce((a,m)=>a+m.content.length,0)} prompt chars): ${S(ttftMs)} s`);
console.log(`decode        : ${decodeTps.toFixed(2)} tok/s  (${N-1} tokens in ${S(decodeMs)} s)`);
console.log(`end-to-end    : ${e2eTps.toFixed(2)} tok/s  (${N} tokens in ${S(tNMs)} s)`);
console.log(`peak RSS      : ${MB(peakRss)} MB`);
console.log(`sample reply  : ${String(reply).slice(0, 120).replace(/\n/g, ' ')}`);
