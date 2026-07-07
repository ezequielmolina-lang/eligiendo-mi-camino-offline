// One-config CPU benchmark: emulate a lower-core device by capping onnxruntime intra-op threads.
// Usage: THREADS=2 node bench_thread.mjs
import { pipeline, env } from '@huggingface/transformers';
import os from 'os';
env.allowLocalModels = true; env.allowRemoteModels = false; env.localModelPath = './public/models/';

const T = parseInt(process.env.THREADS || '0', 10) || os.cpus().length;
let peakRss = 0;
const sampler = setInterval(() => { const r = process.memoryUsage().rss; if (r > peakRss) peakRss = r; }, 150);

const tL = Date.now();
const gen = await pipeline('text-generation', 'gallito-v2-onnx', {
  device: 'cpu', dtype: 'q4f16',
  session_options: { intraOpNumThreads: T, interOpNumThreads: 1 },
});
const loadS = (Date.now() - tL) / 1000;

const msgs = [
  { role: 'system', content: 'Eres Gallito, un guia vocacional calido y breve para estudiantes de secundaria en Peru.' },
  { role: 'user', content: 'Hola, me llamo Rosa. No se muy bien que estudiar despues del colegio.' },
];
await gen(msgs, { max_new_tokens: 8, do_sample: false }); // warmup

const N = 48, REPS = 2;
let dec = [];
for (let i = 0; i < REPS; i++) {
  const a = Date.now(); await gen(msgs, { max_new_tokens: 1, do_sample: false }); const t1 = (Date.now() - a) / 1000;
  const b = Date.now(); await gen(msgs, { max_new_tokens: N, do_sample: false }); const tN = (Date.now() - b) / 1000;
  dec.push((N - 1) / (tN - t1));
}
clearInterval(sampler);
const mean = dec.reduce((x, y) => x + y, 0) / dec.length;
console.log(`threads=${T}\tload=${loadS.toFixed(1)}s\tdecode=${mean.toFixed(2)} tok/s\tpeakRSS=${(peakRss/1048576).toFixed(0)} MB`);
