# Endpoint de sincronización en Supabase — paso a paso

Crea la URL a la que la app offline envía los datos. Gratis y durable (Postgres → exportable a Stata).

## 1. Crear el proyecto
- Entra a https://supabase.com → **New project** (plan Free). Anota la contraseña de la BD.
- Cuando esté listo, ve a **Project Settings → General** y copia el **Reference ID** (`<PROJECT_REF>`).

## 2. Crear las tablas
- **SQL Editor** → pega el contenido de `schema.sql` → **Run**.

## 3. Desplegar la función
Opción CLI (recomendada):
```bash
npm i -g supabase                 # instala el CLI (una vez)
supabase login                    # abre el navegador para autenticar
supabase link --project-ref <PROJECT_REF>
# copia la función a la ruta que espera Supabase:
mkdir -p supabase/functions/offline-sync
cp server/supabase/functions/offline-sync/index.ts supabase/functions/offline-sync/index.ts
supabase functions deploy offline-sync --no-verify-jwt
```
`--no-verify-jwt` la hace pública (la app hace POST sin cabecera de auth).
La función usa `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, que Supabase inyecta solo (no expones llaves).

## 4. (Opcional) Proteger con una clave
```bash
supabase secrets set SYNC_KEY=una-clave-larga-secreta
```
Si la pones, la URL debe llevar `?k=una-clave-larga-secreta` al final.

## 5. Tu URL
```
https://<PROJECT_REF>.supabase.co/functions/v1/offline-sync
```
(o con clave: `…/offline-sync?k=una-clave-larga-secreta`)

Pruébala:
```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/offline-sync" \
  -H "Content-Type: application/json" \
  -d '{"identity":{"user_id":"TEST-1","campus_id":"C1","name":"Prueba"},"voc_events":[{"insert_id":"e1","event":"app_open","ts":"2026-06-21T00:00:00Z"}]}'
# → {"ok":true,"stored":{"voc_chat":0,"voc_events":1,"voc_steps":0}}
```

## 6. Conectarla a la app
Pon la URL en el `escuela.json` de cada colegio:
```json
{ "campus_id":"...", "campus_name":"...", "section":"...", "teacher":"...",
  "sync_endpoint":"https://<PROJECT_REF>.supabase.co/functions/v1/offline-sync" }
```
La app sincroniza sola cuando hay internet.

## 7. Ver / exportar los datos
- **Table Editor** → tablas `students`, `voc_chat`, `voc_events`, `voc_steps`.
- Para Stata/análisis: **SQL Editor** → `select * from voc_chat;` → botón de exportar a CSV;
  o usa la API/`psql`. Cada estudiante es `students.user_id` = `<campus>-<seccion>-<n_lista>`.
