# Build the best model (v3 · Trained on Opus, 1.5B) for the offline app

The offline app runs models **in the browser via ONNX** (`@huggingface/transformers`). v1 and v2 already have
ONNX builds; **v3 (Trained on Opus, 1.5B) — the best, most cloud-like model — is published only as PyTorch
weights**, so it cannot load in the browser until it is exported to ONNX `q4f16` (the same format as
`public/models/gallito-v2-onnx/onnx/model_q4f16.onnx`).

This is the one remaining step to let students try the best model offline. Do it once on any machine with
Python 3.10+ and ~12 GB free disk (a GPU is **not** required — CPU export is fine, just slower).

## 1. Export + quantize (the official transformers.js converter — produces the exact `onnx/` layout)

```bash
pip install -U torch transformers "optimum[onnxruntime]" onnx onnxruntime huggingface_hub

git clone https://github.com/huggingface/transformers.js
cd transformers.js
pip install -r scripts/requirements.txt

# Export the PyTorch v3 weights to browser ONNX with q4f16 quantization:
python -m scripts.convert \
  --model_id ezequielmolina/gallito-v3-1.5b \
  --task text-generation \
  --quantize --modes q4f16
# Output: models/ezequielmolina/gallito-v3-1.5b/ with onnx/model_q4f16.onnx + tokenizer/config files.
```

If `scripts.convert` errors on the architecture, upgrade first (`pip install -U optimum transformers`) — Qwen2.5
support needs recent versions; that is the most common cause of the earlier export failure.

## 2. Publish a browser-ready repo

```bash
huggingface-cli upload ezequielmolina/gallito-v3-1.5b-onnx \
  ./models/ezequielmolina/gallito-v3-1.5b .
```

(Confirm the repo ends up with `config.json`, the tokenizer files, and `onnx/model_q4f16.onnx`, matching
`gallito-1.5b-v2-onnx`.)

## 3. Flip it on in the app

In `src/coach.js` set:

```js
export const V3_ONNX_READY = true;
```

That automatically makes **"Gallito · Trained on Opus (recomendado)"** the default in-browser model (falling back
to v2 only if the ONNX is missing), and moves v3-1.5B out of the "try on a PC" list. Rebuild and redeploy.

## 4. (Optional) bundle it for fully offline / USB use

```bash
# download the repo files into the app so no network is needed on first load:
huggingface-cli download ezequielmolina/gallito-v3-1.5b-onnx \
  --local-dir public/models/gallito-v3-1.5b-onnx
```

## Sanity check

Load the app with `?engine=transformers`, pick "Gallito · Trained on Opus (recomendado)", and run the Paso-1
interview: it should reflect the student's answers, reach the `## Tu descripción` synthesis, and read like the
cloud coach — not the terser/looping v2.

> Why this matters: in the whole-app evaluation v2 (what the app runs today) is the *weakest* deployable student
> (quality 0.92/2, completes 60% of steps), while v3 reaches 1.55/2 and completes 88% — the model that actually
> resembles the cloud coach testers know from `eligiendomicamino.org`.
