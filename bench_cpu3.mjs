// CPU on-device benchmark, 3 reps, for deployed gallito-v2 (q4f16 ONNX), transformers.js.
import { pipeline, env } from '@huggingface/transformers';
import os from 'os';
env.allowLocalModels = true; env.allowRemoteModels = false; env.localModelPath = './public/models/';

let peakRss = 0;
const sampler = setInterval(() => { const r = process.memoryUsage().rss; if (r > peakRss) peakRss = r; }, 150);
const MB = b => (b / 1048576).toFixed(0);
const S = ms => (ms / 1000).toFixed(2);
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

console.log(`host: ${os.cpus()[0].model.trim()} | ${os.cpus().length} threads | ${(os.totalmem()/1e9).toFixed(1)} GB`);
const tLoad0 = Date.now();
const gen = await pipeline('text-generation', 'gallito-v2-onnx', { device: 'cpu', dtype: 'q4f16' });
const loadS = (Date.now() - tLoad0) / 1000;
console.log(`load: ${loadS.toFixed(2)} s`);

const msgs = [
  { role: 'system', content: 'Eres Gallito, un guia vocacional calido y breve para estudiantes de secundaria en Peru.' },
  { role: 'user', content: 'Hola, me llamo Rosa. No se muy bien que estudiar despues del colegio.' },
];
await gen(msgs, { max_new_tokens: 8, do_sample: false }); // warmup

const N = 64, REPS = 3;
const ttfts = [], decTps = [], e2eTps = [];
for (let i = 0; i < REPS; i++) {
  const tA = Date.now(); await gen(msgs, { max_new_tokens: 1, do_sample: false }); const t1 = (Date.now() - tA) / 1000;
  const tB = Date.now(); await gen(msgs, { max_new_tokens: N, do_sample: false }); const tN = (Date.now() - tB) / 1000;
  const dtps = (N - 1) / (tN - t1);
  ttfts.push(t1); decTps.push(dtps); e2eTps.push(N / tN);
  console.log(`rep ${i+1}: TTFT ${t1.toFixed(2)}s | decode ${dtps.toFixed(2)} tok/s | e2e ${(N/tN).toFixed(2)} tok/s`);
}
clearInterval(sampler);
console.log('----- MEAN (CPU-only, q4f16, n=3) -----');
console.log(`load time  : ${loadS.toFixed(1)} s`);
console.log(`TTFT       : ${mean(ttfts).toFixed(2)} s`);
console.log(`decode     : ${mean(decTps).toFixed(2)} tok/s   (reps: ${decTps.map(x=>x.toFixed(2)).join(', ')})`);
console.log(`end-to-end : ${mean(e2eTps).toFixed(2)} tok/s`);
console.log(`peak RSS   : ${MB(peakRss)} MB`);
