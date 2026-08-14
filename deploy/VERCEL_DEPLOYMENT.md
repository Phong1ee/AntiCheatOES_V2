# Vercel Deployment

Create a Vercel project from the repository with these settings:

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `build` |

Set this Vercel Production environment variable at build time:

```text
VITE_API_BASE_URL=https://<railway-api-domain>
```

Do not add a real Railway domain to source code. After Vercel creates its HTTPS
domain, set Railway `FRONTEND_ORIGIN` to that exact domain (or include it in
`CORS_ALLOWED_ORIGINS`). No Vercel or Railway token belongs in GitHub.

`frontend/vercel.json` declares the Vite `build` output directory. The build
script runs `prepare:vad-assets` before Vite, so the deployment output contains
the camera model, VAD model/worklet, overlap detector model, MediaPipe WASM,
and ONNX Runtime WASM. The CI workflow verifies those assets and rejects a
shipped localhost API URL before a deployment is recommended.
