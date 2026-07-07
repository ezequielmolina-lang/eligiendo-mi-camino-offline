// HQ stub sync server — stand-in for the real headquarters endpoint.
// Accepts the app's sync payload and appends each dataset to a JSONL file (one record per line),
// in the project's RCT schema, so HQ's pipeline can ingest. Replace with the real endpoint in production.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('./received', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT || 8787;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function appendJSONL(file, rows) {
  if (!rows || !rows.length) return 0;
  fs.appendFileSync(path.join(OUT, file), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return rows.length;
}
const count = (f) => { try { return fs.readFileSync(path.join(OUT, f), 'utf8').split('\n').filter(Boolean).length; } catch { return 0; } };

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  if (req.method === 'GET') {
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, received: { voc_chat: count('voc_chat.jsonl'), voc_events: count('voc_events.jsonl'), voc_steps: count('voc_steps.jsonl') } }, null, 2));
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const p = JSON.parse(body || '{}');
        const rx = new Date().toISOString();
        const id = p.identity || {};
        const chat = appendJSONL('voc_chat.jsonl', (p.voc_chat || []).map((r) => ({ ...r, campus_id: r.campus_id ?? id.campus_id, _received: rx })));
        const ev = appendJSONL('voc_events.jsonl', (p.voc_events || []).map((r) => ({ ...r, _received: rx })));
        const st = appendJSONL('voc_steps.jsonl', (p.voc_steps || []).map((r) => ({ ...r, _received: rx })));
        console.log(`[sync] +${chat} chat  +${ev} events  +${st} steps  · user=${id.user_id} campus=${id.campus_id}`);
        res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, stored: { voc_chat: chat, voc_events: ev, voc_steps: st } }));
      } catch (e) {
        res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
      }
    });
    return;
  }
  res.writeHead(404, CORS); res.end();
}).listen(PORT, () => console.log(`HQ stub sync server → http://localhost:${PORT}  (POST to sync, GET for status)\nWriting JSONL to ${OUT}`));
