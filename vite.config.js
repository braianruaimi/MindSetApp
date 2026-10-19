import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

function offlineWorkerPlugin() {
  return {
    name: "mindset-offline-worker",
    generateBundle(_, bundle) {
      const precache = [...new Set([
        "./index.html",
        "./manifest.webmanifest",
        "./favicon.svg",
        "./apple-touch-icon.png",
        "./icon-192.png",
        "./icon-512.png",
        ...Object.keys(bundle)
        .filter((fileName) => fileName !== "sw.js" && !fileName.endsWith(".map"))
        .map((fileName) => `./${fileName}`),
      ])];
      const source = `
const CACHE = "mindset-shell-v2";
const PRECACHE = ${JSON.stringify(precache)};
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("mindset-shell-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(new URL("./index.html", self.registration.scope), copy));
        }
        return response;
      }).catch(async () => {
        const shell = await caches.match(new URL("./index.html", self.registration.scope));
        return shell || caches.match(request);
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })),
  );
});
`;
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), offlineWorkerPlugin()],
});
