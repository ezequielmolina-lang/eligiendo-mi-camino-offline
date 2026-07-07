# Endpoint de sincronización (HQ) — guía de despliegue

La app offline guarda todo localmente y, cuando hay internet, hace **POST** del lote a una URL
(`sync_endpoint`). Esa URL es lo que hay que crear. Este doc define el contrato para que
**quien la aloje** (udocz, un servidor propio, o un backend gestionado) lo implemente igual.

## Contrato del endpoint

- **Método:** `POST` (y `OPTIONS` para preflight CORS).
- **URL sugerida:** `https://eligiendomicamino.match.udocz.com/offline/sync` (o la que definas).
- **CORS:** debe responder `Access-Control-Allow-Origin: *` (o el origen de la app),
  `Access-Control-Allow-Methods: POST, GET, OPTIONS`, `Access-Control-Allow-Headers: Content-Type`.
- **Cuerpo (JSON):**
  ```json
  {
    "client": { "app": "eligiendo-mi-camino-offline", "sentAt": "ISO-8601" },
    "identity": { "user_id": "<campus>-<seccion>-<n_lista>", "device_id": "...",
                  "institution_id": 28, "campus_id": "...", "campus_name": "...",
                  "section": "...", "teacher": "...", "name": "...", "list_number": "..." },
    "voc_chat":   [ /* mensajes: user_id, conversation_id, step, message_id, message_type,
                       is_student, message_text, msg_length, ts_created, date_created */ ],
    "voc_events": [ /* eventos: insert_id, event, user_id, campus_id, props, ts, date */ ],
    "voc_steps":  [ /* avance: user_id, institution_id, campus_id, section, current_step,
                       completed_steps_count, completed_steps, journey_status, updated_at */ ]
  }
  ```
- **Respuesta de éxito:** HTTP `200` con `{ "ok": true }`. **Importante:** la app solo borra
  los registros locales cuando recibe `200`; ante cualquier otro código los **reintenta** (no se
  pierde nada). Por eso el endpoint debe responder 200 SOLO si guardó de verdad.
- **Idempotencia:** cada registro trae un id único (`message_id`, `insert_id`); si un lote se
  reenvía, deduplicar por esos ids para no duplicar.

## Dónde alojarlo (elige uno)

> ⚠️ **Persistencia:** NO uses un disco efímero (p. ej. el plan gratis de Render/Railway borra el
> disco al reiniciar → se pierden datos). Guarda en una base de datos o almacenamiento durable.

1. **udocz (recomendado para producción):** que udocz agregue `POST /offline/sync` al backend del
   tool y escriba en las **mismas tablas del RCT** (voc_chat/voc_events/voc_steps). Ventajas: URL
   con tu marca, datos durables y **ya unificados** con los datos del tool online. Entrégale a
   udocz este documento + `sync-server.mjs` como referencia.
2. **Backend gestionado (Supabase/Firebase):** una función que reciba el POST y haga INSERT en
   Postgres/Firestore. Gratis para empezar, durable. Te puedo escribir la función.
3. **Servidor propio con disco persistente (VPS, o Render/Railway con disco pagado):** corre
   `node server/sync-server.mjs` tal cual (ya escribe JSONL en `server/received/`). Para Stata,
   los JSONL se importan directo.

## Conectar la URL a la app

Una vez tengas la URL, ponla en el `escuela.json` de cada colegio:
```json
{ "campus_id": "...", "campus_name": "...", "section": "...", "teacher": "...",
  "sync_endpoint": "https://.../offline/sync" }
```
La app la adopta al abrir y sincroniza sola cuando hay internet.
