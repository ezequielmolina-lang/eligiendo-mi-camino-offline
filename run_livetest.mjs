// Corre v1 (HF) + v2 (local) sobre la bateria sintetica, en CPU (sin box, sin WebGPU).
import { pipeline, env } from '@huggingface/transformers';
import { readFileSync, writeFileSync } from 'fs';
import { STEP1_SELF_KNOWLEDGE, STEP7_FAMILY, STEP8_PLAN, RESEARCH_SYSTEM, retrieveKB } from './src/prompts.mjs';
env.allowLocalModels = true;
env.localModelPath = './dist/models/';

const KB = readFileSync('./src/data/kb-summary.txt', 'utf8');
const BATT = 'C:/Users/cosmo/Downloads/AI Career Coach/_distill/v2/audit/livetest/battery.json';
const OUT  = 'C:/Users/cosmo/Downloads/AI Career Coach/_distill/v2/audit/livetest/results_models.json';
const battery = JSON.parse(readFileSync(BATT, 'utf8'));

function sysFor(s){
  if (s.step==='Paso1') return STEP1_SELF_KNOWLEDGE;
  if (s.step==='Paso7') return STEP7_FAMILY;
  if (s.step==='Paso8') return STEP8_PLAN;
  if (s.step==='Paso6') return RESEARCH_SYSTEM(retrieveKB(s.research_q, KB));
  return 'Eres Gallito.';
}

const MODELS = [
  { tag:'v2', id:'gallito-v2-onnx' },
  { tag:'v1', id:'ezequielmolina/gallito-1.5b-onnx' },
];

const results = {}; // id -> {step,check, v1, v2}
for (const s of battery) results[s.id] = { id:s.id, step:s.step, check:s.check };

for (const m of MODELS){
  console.log(`\n===== cargando ${m.tag} (${m.id}) en CPU =====`);
  const t0 = Date.now();
  let gen;
  try { gen = await pipeline('text-generation', m.id, { device:'cpu', dtype:'q4f16' }); }
  catch(e){ console.log(`${m.tag} FALLO al cargar:`, String(e.message||e).slice(0,200)); continue; }
  console.log(`${m.tag} cargado en ${((Date.now()-t0)/1000).toFixed(0)}s`);
  for (const s of battery){
    const msgs = [{role:'system',content:sysFor(s)}, ...s.messages];
    const t1 = Date.now();
    try {
      const out = await gen(msgs, { max_new_tokens:s.max||256, do_sample:false, repetition_penalty:1.15 });
      const gt = out?.[0]?.generated_text; const c = Array.isArray(gt)? gt[gt.length-1].content : String(gt);
      results[s.id][m.tag] = c;
      console.log(`  ${m.tag} ${s.id}: ${((Date.now()-t1)/1000).toFixed(0)}s (${(c||'').length} chars)`);
    } catch(e){
      results[s.id][m.tag] = 'ERROR: '+String(e.message||e).slice(0,120);
      console.log(`  ${m.tag} ${s.id}: ERROR ${String(e.message||e).slice(0,80)}`);
    }
    writeFileSync(OUT, JSON.stringify(Object.values(results), null, 1)); // dump incremental
  }
}
console.log('\n=== DONE -> results_models.json ===');
