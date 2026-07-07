# Eligiendo Mi Camino — versión offline (instalable)

App de orientación vocacional para estudiantes de 5.º de secundaria (Perú), que funciona **sin internet** y con un **asistente de IA (Gallito) que corre en el propio dispositivo**. Versión offline del piloto Banco Mundial × uDocz (live: https://eligiendomicamino.match.udocz.com).

## Qué incluye
- **App offline instalable (PWA):** todo el journey de 8 pasos; React, Tailwind, fuente Poppins y el mascota incrustados localmente — cero CDNs.
- **Gallito con IA local:** un modelo de lenguaje que se ejecuta en el navegador con **WebGPU** (vía WebLLM). Se descarga una vez (~1–2 GB) y luego funciona **sin conexión**. Conduce las entrevistas de los Pasos 1 (Autoconocimiento), 7 (Decisión familiar) y 8 (Plan).
- **Seguimiento de uso con sincronización periódica:** registra el uso localmente (IndexedDB) y lo **envía a la sede (HQ)** cuando hay conexión, en el **mismo esquema del RCT** (`voc_chat`, `voc_events`, `voc_steps`).

## Requisitos
- **Para construir:** Node 18+ (probado con v24).
- **Para usar el Gallito IA:** navegador con WebGPU (Chrome/Edge recientes, de preferencia en computadora). Sin WebGPU, la app funciona pero el chat con IA muestra un aviso.

## Construir
```bash
npm install
node build.mjs        # genera dist/ (app autocontenida)
node serve.mjs        # sirve dist/ en http://localhost:5173  (o usa cualquier hosting estático)
```
`dist/` es totalmente estático: se puede servir desde cualquier servidor, copiar a una USB o publicar en GitHub Pages.

## Instalar como app (offline)
- **Computadora (Chrome/Edge):** abrir la URL → icono "Instalar" en la barra de direcciones → la app queda como aplicación de escritorio y funciona offline.
- **Android (Chrome):** menú → "Agregar a pantalla de inicio".
- La primera vez que un estudiante entra al Paso 1/7/8 y pulsa "Comenzar", se descarga el modelo de IA (una sola vez). Después funciona sin internet.

## El asistente de IA (modelos)
En la pantalla de inicio de cada chat el estudiante elige el modelo según su equipo:
- **Gallito Plus** — Llama-3.2-3B (~1.9 GB), mejor calidad (PC/laptop).
- **Gallito** — Qwen2.5-1.5B (~1.0 GB), equilibrado.
- **Gallito Lite** — Llama-3.2-1B (~0.9 GB), equipos modestos.

Modo demo: agregar `?mock=1` a la URL simula el chat **sin descargar** ningún modelo (útil para probar el flujo).

## Seguimiento y sincronización con HQ
- Los datos se guardan **localmente** (IndexedDB) y se sincronizan cuando hay conexión: al abrir, al recuperar conexión, cada 3 min, y con el botón **"Sincronizar"** (barra lateral).
- **Identidad por estudiante:** abrir con `?uid=<id_roster>&campus=<id_escuela>` (p. ej. un enlace o QR por estudiante) asigna el `user_id`/`campus_id` para atribuir los datos. Sin esos parámetros se usa un id anónimo del dispositivo.
- **Endpoint de HQ:** configurar con `?sync=<URL>` (se guarda) o vía `localStorage.emc_sync_endpoint`. Si no hay endpoint, los datos quedan solo en el equipo ("Solo local").

### Esquema enviado a HQ (POST JSON)
```json
{
  "client": { "app": "eligiendo-mi-camino-offline", "sentAt": "ISO" },
  "identity": { "user_id": "...", "device_id": "...", "institution_id": 28, "campus_id": "...", "section": "...", "name": "..." },
  "voc_chat":   [ { "user_id","conversation_id","step","message_id","message_type","is_student","message_text","msg_length","ts_created","date_created" } ],
  "voc_events": [ { "insert_id","event","user_id","campus_id","props","ts","date" } ],
  "voc_steps":  [ { "user_id","institution_id","campus_id","section","current_step","completed_steps_count","completed_steps","journey_status","updated_at" } ]
}
```
Estos esquemas coinciden con `voc_chat` / `voc_events` / `voc_steps` del RCT, para que el pipeline existente de HQ pueda ingerirlos. Tras un `HTTP 200`, el cliente borra los registros ya enviados (entrega "al menos una vez").

### Servidor de prueba (stub)
```bash
node server/sync-server.mjs    # http://localhost:8787 ; escribe JSONL en server/received/
```
Reemplazar por el endpoint real de HQ en producción (debe aceptar el POST anterior y responder 200).

## Privacidad
Son datos de menores de edad. Se almacenan identificadores anonimizados y el contenido de las interacciones; no se envía nada hasta configurar un endpoint. Coordinar consentimiento y manejo de datos con el equipo del proyecto/HQ.

## Desarrollo
- Código fuente en `src/`: `app.jsx` (app portada), `coach.js` (motor WebLLM), `prompts.js` (prompts de Gallito), `gallito-chat.jsx` (UI de chat reutilizable), `telemetry.js` (registro + sync), `data/` (base de conocimiento).
- `?nosw=1` desactiva el service worker (útil al desarrollar para evitar caché).
- `?view=<paso>` abre directo un paso (`chat`, `test`, `myths`, `routes`, `explore`, `notebook`, `family`, `plan`).
