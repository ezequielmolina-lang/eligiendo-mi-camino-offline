import { readFileSync, writeFileSync } from 'fs';
import { STEP1_SELF_KNOWLEDGE, STEP7_FAMILY, STEP8_PLAN, RESEARCH_SYSTEM, retrieveKB } from './src/prompts.mjs';
const KB = readFileSync('./src/data/kb-summary.txt','utf8');
const B='C:/Users/cosmo/Downloads/AI Career Coach/_distill/v2/audit/livetest/';
const bat=JSON.parse(readFileSync(B+'battery30.json','utf8'));
const sysFor=(s)=> s.step==='Paso1'?STEP1_SELF_KNOWLEDGE : s.step==='Paso7'?STEP7_FAMILY : s.step==='Paso8'?STEP8_PLAN : RESEARCH_SYSTEM(retrieveKB(s.research_q,KB));
const out=bat.map(s=>({id:s.id,step:s.step,check:s.check,system:sysFor(s),messages:s.messages}));
writeFileSync(B+'prompts_resolved32.json', JSON.stringify(out,null,1));
console.log('resueltos',out.length,'escenarios -> prompts_resolved32.json');
