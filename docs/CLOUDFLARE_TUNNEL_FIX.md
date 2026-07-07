# Cloudflare Tunnel — 502 / Error 1033 Fix & Performance Guide

## Root Causes & Fixes Applied

### Issue 1 — Bad Gateway (502) / Error 1033

| # | Root Cause | Fix Applied |
|---|-----------|-------------|
| 1 | **Vite's `allowedHosts` security block** — Vite rejects requests from unknown hostnames (like `app.iaoms.dev`). When Cloudflare forwards a request to `localhost:8080`, Vite sees the tunnel hostname and returns 403 → Cloudflare shows 502/1033. | Added `allowedHosts: ["localhost", "app.iaoms.dev", "*.iaoms.dev", ".trycloudflare.com"]` to `vite.config.ts` |
| 2 | **Race condition at startup** — `cloudflared` was started via `concurrently` alongside `vite`, meaning the tunnel came online before Vite was ready. Tunnel traffic hit port 8080 when nothing was listening → 502. | `start-iaoms.ps1` now waits (up to 60 s) for Vite to actually listen on port 8080 before starting `cloudflared`. |
| 3 | **Stale port holder processes** — A previous crashed session's Node/Vite process still holds port 8080, so the new Vite instance fails to bind → tunnel has no backend → 502. | Startup script kills all processes on ports 3001/8080 before starting anything. |
| 4 | **HMR WebSocket mismatch** — Without explicit HMR config, the browser's HMR WebSocket tries to connect to `localhost` instead of the tunnel URL, causing connection errors that can cascade. | Added `hmr: { host: "app.iaoms.dev", protocol: "wss", clientPort: 443 }` to `vite.config.ts`. |

### Issue 2 — Slow Loading via Tunnel

| # | Root Cause | Fix Applied |
|---|-----------|-------------|
| 1 | **No chunk splitting** — All JS was bundled into one giant file. On first load, the browser must download/parse the entire bundle before rendering. | Added `manualChunks` in `vite.config.ts` build options to split vendor, UI, supabase, and query into separate cacheable chunks. |
| 2 | **SWC + lovable-tagger overhead** — Both run on every file change during dev, adding latency. | No change needed — `componentTagger()` was already guarded to dev-mode only. SWC itself is already the fastest option. |
| 3 | **Tunnel latency** — Traffic travels: Browser → Cloudflare Edge → cloudflared daemon on your machine → Vite. This round-trip adds ~50–150 ms per request. | This is inherent to tunnel architecture. Use `localhost:8080` directly for everyday development; use the tunnel only for external preview/sharing. |

## How to Use Going Forward

```powershell
# Always use this script — never start services manually
.\start-iaoms.ps1
```

The script guarantees:
1. Old processes are killed first
2. Vite is fully listening before cloudflared starts
3. No race-condition 502s

## Checklist if 502 Returns

- [ ] Is `cloudflared.exe` running? Check Task Manager.
- [ ] Is Vite running? Visit `http://localhost:8080` directly.
- [ ] Cloudflare DNS: `app.iaoms.dev` must have a CNAME pointing to your tunnel ID (e.g., `<uuid>.cfargotunnel.com`).
- [ ] Run `cloudflared tunnel info iaoms-tunnel` to verify the tunnel is healthy.
- [ ] Cloudflare Dashboard → Zero Trust → Access → Tunnels → verify status is **Healthy**.
