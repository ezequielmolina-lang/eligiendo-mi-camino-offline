import { pipeline, env } from '@huggingface/transformers';
env.allowLocalModels = true;
env.localModelPath = './dist/models/';
const t0 = Date.now();
console.log('cargando v2 en CPU (q4f16)...');
let gen;
try { gen = await pipeline('text-generation', 'gallito-v2-onnx', { device: 'cpu', dtype: 'q4f16' }); }
catch(e){ console.log('q4f16 CPU fallo:', String(e.message||e).slice(0,180)); try{ gen = await pipeline('text-generation','gallito-v2-onnx',{device:'cpu',dtype:'q4'});}catch(e2){console.log('q4 fallo:',String(e2.message||e2).slice(0,180));process.exit(1);} }
console.log('cargado en', ((Date.now()-t0)/1000).toFixed(1),'s. generando...');
const t1 = Date.now();
const out = await gen([{role:'system',content:'Eres Gallito, guia vocacional. Se breve.'},{role:'user',content:'Hola, me llamo Rosa.'}], {max_new_tokens:40, do_sample:false});
const txt = out?.[0]?.generated_text; const c = Array.isArray(txt)? txt[txt.length-1].content : txt;
console.log('=== RESPUESTA ('+((Date.now()-t1)/1000).toFixed(1)+'s) ===\n'+c);
