# PWA demo — offline and installability

Reproducible walkthrough for the PWA module (Web · Minor · 1 pt).
Written 08/09/26, updated 12/09/26 after testing the API path.

**A useful service worker only exists in a production build.**
`devOptions: { enabled: true }` registers a lighter one in dev, but it
precaches just two files — `index.html` and `registerSW.js` — because Vite
serves modules on demand under names that change on every request. Offline
will not work against the dev server, and the console fills with precache
misses that mean nothing.

**And the demo runs outside Caddy.** Caddy forwards to the `frontend` service
on 5173, which the dev server owns. A one-off preview container doesn't get
that service alias, so routing it through Caddy gives a 502. Publishing a port
directly is simpler than fighting it.

---

## 1. Build and serve

```bash
docker compose exec frontend npm run build
docker compose stop frontend
docker compose run --rm -p 4173:4173 frontend npx vite preview --host --port 4173
```

The build should report `precache 10 entries` and generate `dist/sw.js`.

Then open **http://localhost:4173**. Not https://localhost — that's Caddy, and
it's now pointing at a stopped container.

`http://localhost` counts as a secure origin in Chrome, so the service worker
registers normally without TLS.

**Quick check without DevTools:**

```bash
curl -s http://localhost:4173/ | grep -c "assets/index-"
```

Any number above `0` (usually `2`: the JS and CSS bundles) means the production
build is being served. `0` means it isn't — or nothing is answering on 4173 at
all, so check the `docker compose run` terminal.

> **Do not log in or use the app on 4173.** The `/api` proxy works here — the
> preview container sits on the internal network — so any account action would
> send credentials to the backend over plain HTTP, which the subject forbids.
> This demo is the app shell and offline behaviour only. Everything else is
> demoed at https://localhost.

---

## 2. Clear any previous service worker

Skip only if you have never opened http://localhost:4173 in this browser.

**Application → Service workers**

- Untick **Bypass for network** if it's ticked
- **Unregister**
- Close the tab, open a new one at http://localhost:4173

A service worker belongs to one origin — scheme, host and port — so the dev
one at https://localhost can't touch 4173. The one to clear is left over from
an earlier demo run on 4173. It keeps serving that run's `index.html`, which
points at JS files the new build has deleted: you get a blank page or an old
version, and it looks exactly like the build not working.

---

## 3. Confirm you're on the build

**Application → Service workers**

| Field | Expected |
|---|---|
| Source | `sw.js` — not `dev-sw.js` |
| Status | activated and is running |

If it says `dev-sw.js`, you're on https://localhost, not 4173. Check the
address bar.

---

## 4. Show what's cached

**Application → Cache storage → workbox-precache**

Ten entries are already there — the service worker fetched them all when it
installed, before you clicked anything. They include `index.html`, the JS and
CSS bundles, `favicon.ico`, `manifest.webmanifest` and the PWA icons, with
`entries: 10` at the bottom.

This is the best thing to show. It's concrete: these are the files the service
worker holds, and that's what makes the app load without a network.

---

## 5. Offline

**Network → throttling dropdown → Offline**, or the Offline checkbox at the top
of the Service workers pane.

- Toggle offline with the page open → the red banner appears
- Reload → the app still loads

Check the status bar at the bottom of the Network panel:

```
0 / 11 requests    0.0 kB / 0.0 kB transferred    0.0 kB / 276 kB resources
```

Zero requests reached the network. 276 kB came from the cache. That number is
the proof.

Untick Offline to go back.

---

## 6. Install

Click the Install icon in the address bar. The app opens in its own window with
no browser chrome, using the manifest's name, icons and theme colour.

-
---

## Restore dev afterwards

Stop the preview with Ctrl+C in its terminal, then:

```bash
docker compose up -d frontend
```

Then https://localhost is the normal dev app again. The demo's service worker
belongs to http://localhost:4173 only, so it doesn't affect it.


