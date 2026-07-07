// Supabase Edge Function — recibe el lote de sincronización de la app offline y lo guarda en las
// tablas del RCT (students / voc_chat / voc_events / voc_steps). Idempotente (upsert por id).
// Desplegar público (sin JWT) para que la app pueda hacer POST sin cabecera de auth:
//   supabase functions deploy offline-sync --no-verify-jwt
// URL resultante:  https://<PROJECT_REF>.supabase.co/functions/v1/offline-sync
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  // Clave compartida opcional: si defines el secreto SYNC_KEY, la app debe llamar con ?k=ESA_CLAVE.
  const needKey = Deno.env.get('SYNC_KEY');
  if (needKey && new URL(req.url).searchParams.get('k') !== needKey) return json({ ok: false, error: 'unauthorized' }, 401);

  try {
    const p = await req.json();
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const id = p.identity || {};
    const rx = new Date().toISOString();

    if (id.user_id) {
      await sb.from('students').upsert({
        user_id: id.user_id, name: id.name ?? null, list_number: id.list_number ?? null,
        campus_id: id.campus_id ?? null, campus_name: id.campus_name ?? null, section: id.section ?? null,
        teacher: id.teacher ?? null, institution_id: id.institution_id ?? null, device_id: id.device_id ?? null,
        last_seen: rx,
      }, { onConflict: 'user_id' });
    }

    const chat = (p.voc_chat || []).map((r: any) => ({
      message_id: r.message_id, user_id: r.user_id ?? id.user_id, conversation_id: r.conversation_id ?? null,
      step: r.step ?? null, message_type: r.message_type ?? null, is_student: r.is_student ?? null,
      message_text: r.message_text ?? null, msg_length: r.msg_length ?? null,
      ts_created: r.ts_created ?? null, date_created: r.date_created ?? null,
      campus_id: r.campus_id ?? id.campus_id ?? null, received_at: rx,
    })).filter((r: any) => r.message_id);

    const events = (p.voc_events || []).map((r: any) => ({
      insert_id: r.insert_id, event: r.event ?? null, user_id: r.user_id ?? id.user_id,
      campus_id: r.campus_id ?? id.campus_id ?? null, props: r.props ?? {},
      ts: r.ts ?? null, date: r.date ?? null, received_at: rx,
    })).filter((r: any) => r.insert_id);

    const steps = (p.voc_steps || []).map((r: any) => ({
      user_id: r.user_id ?? id.user_id, institution_id: r.institution_id ?? id.institution_id ?? null,
      campus_id: r.campus_id ?? id.campus_id ?? null, section: r.section ?? id.section ?? null,
      current_step: r.current_step ?? null, completed_steps_count: r.completed_steps_count ?? null,
      completed_steps: r.completed_steps ?? null, journey_status: r.journey_status ?? null,
      updated_at: r.updated_at ?? null, received_at: rx,
    })).filter((r: any) => r.user_id);

    if (chat.length) { const { error } = await sb.from('voc_chat').upsert(chat, { onConflict: 'message_id', ignoreDuplicates: true }); if (error) throw error; }
    if (events.length) { const { error } = await sb.from('voc_events').upsert(events, { onConflict: 'insert_id', ignoreDuplicates: true }); if (error) throw error; }
    if (steps.length) { const { error } = await sb.from('voc_steps').upsert(steps, { onConflict: 'user_id' }); if (error) throw error; }

    return json({ ok: true, stored: { voc_chat: chat.length, voc_events: events.length, voc_steps: steps.length } });
  } catch (e) {
    return json({ ok: false, error: String((e as any)?.message || e) }, 400);
  }
});
