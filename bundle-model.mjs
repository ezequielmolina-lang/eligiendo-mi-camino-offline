// Downloads an MLC model (weights + tokenizer + wasm) INTO the package so it runs fully
// offline from first launch — no per-device download. For pen-drive / USB distribution.
// Usage: node bundle-model.mjs [model_id]   (default: Llama-3.2-3B-Instruct-q4f16_1-MLC)
// Then: node build.mjs   (copies models/ into dist/). The app auto-uses the local model.
import { prebuiltAppConfig } from '@mlc-ai/web-llm';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

const modelId = process.argv[2] || 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
const m = prebuiltAppConfig.model_list.find((x) => x.model_id === modelId);
if (!m) { console.error('Unknown model_id:', modelId); process.exit(1); }

const repo = m.model.replace(/\/$/, '');                               // https://huggingface.co/mlc-ai/<id>
const apiUrl = repo.replace('https://huggingface.co/', 'https://huggingface.co/api/models/');
// WebLLM appends "/resolve/main/<file>" to the model URL (HF-style), so the bundled
// weights/config must live under that subpath for local loading to resolve correctly.
const outDir = path.join('models', modelId, 'resolve', 'main');
const libDir = path.join('models', 'libs');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(libDir, { recursive: true });

async function dl(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  await finished(Readable.fromWeb(res.body).pipe(fs.createWriteStream(dest)));
  return fs.statSync(dest).size;
}

console.log('Bundling model:', modelId, '\n  from', repo, '\n');
const info = await (await fetch(apiUrl)).json();
const files = (info.siblings || []).map((s) => s.rfilename).filter((f) => !/^\.|^README/i.test(f));
let total = 0;
for (const f of files) {
  const dest = path.join(outDir, f);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  process.stdout.write('  ' + f + ' ... ');
  const sz = await dl(repo + '/resolve/main/' + encodeURIComponent(f), dest);
  total += sz; console.log((sz / 1048576).toFixed(1) + ' MB');
}
const wasmName = m.model_lib.split('/').pop();
process.stdout.write('  lib/' + wasmName + ' ... ');
total += await dl(m.model_lib, path.join(libDir, wasmName));
console.log('ok');

const appConfig = { model_list: [{ model: './models/' + modelId, model_id: modelId, model_lib: './models/libs/' + wasmName }] };
fs.writeFileSync(path.join('models', 'app-config.json'), JSON.stringify(appConfig, null, 2));

console.log('\n✅ Done. Total ' + (total / 1048576).toFixed(0) + ' MB in models/');
console.log('   Wrote models/app-config.json');
console.log('   Next: node build.mjs   (copies models/ into dist/ so the app loads it offline, no download)');
