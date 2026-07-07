# Deploy the offline app to `eligiendomicamino.org/offline`

The whole offline app (with the best model, **v3 · Trained on Opus**, as the default) is built and ready in
`dist/`. It is a static PWA — no server code — so hosting it is just serving that folder. It uses **relative
paths** throughout (`./bundle.js`, `scope: "./"`, `start_url: "./index.html"`), so it works under a sub-path like
`/offline` with no changes.

At runtime the app streams the model (~1.2 GB, cached after first load) from the public HuggingFace repo
`ezequielmolina/gallito-v3-1.5b-onnx` over CORS, so it works from any origin.

## Rebuild (only if you change source)

```bash
cd eligiendo-mi-camino-offline
npm install            # first time only
node build.mjs         # -> writes dist/
```

## Option A — same server as the cloud app (recommended: `/offline` path)

Copy `dist/` into the web root under `offline/` and make that path serve `index.html` (SPA fallback):

```
<webroot>/offline/          <-  contents of dist/
   index.html
   bundle.js
   styles.css
   service-worker.js
   manifest.webmanifest
   fonts/  icons/  gallito.png
```

- Nginx example:
  ```nginx
  location /offline/ {
      alias /var/www/eligiendomicamino/offline/;
      try_files $uri $uri/ /offline/index.html;
  }
  ```
- Serve over **HTTPS** (WebGPU and service workers require a secure context).
- No special MIME config needed beyond the defaults; `.wasm`/`.onnx` are fetched from HuggingFace, not your server.

Result: `https://eligiendomicamino.org/offline` runs the whole journey in-browser with the best model.

## Option B — static host (Netlify / Vercel / GitHub Pages / S3+CloudFront)

Publish the `dist/` folder as the site root (or under `/offline`). Enable HTTPS and an SPA fallback to
`index.html`. Nothing else is required.

## Option C — fully offline / USB (no network at all on first load)

Bundle the model into the package so first load needs no internet:

```bash
huggingface-cli download ezequielmolina/gallito-v3-1.5b-onnx \
  --local-dir public/models/gallito-v3-1.5b-onnx
# then point the transformers engine at the local path and rebuild
```

## Verify after deploy

1. Open `https://eligiendomicamino.org/offline` on a WebGPU browser (Chrome/Edge).
2. Start the journey; on first model use it downloads ~1.2 GB once (progress shown), then caches.
3. Run the Paso-1 interview: it should reflect the student's answers, reach `## Tu descripción`, and read like
   the cloud coach — the model in use is **Gallito · Trained on Opus (recomendado)**.

## Notes

- The default model is set in `src/coach.js` (`V3_ONNX_READY = true`, `V3_TF` first in `TF_MODELS`); it falls
  back to v2 automatically if the v3 repo is ever unreachable.
- The verified-data (salary) layer and the safety guard run locally and need no network.
