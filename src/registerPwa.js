export function registerPwa() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(new URL(`${import.meta.env.BASE_URL}sw.js`, window.location.href), {
      scope: new URL(import.meta.env.BASE_URL, window.location.href).pathname,
    }).then((registration) => {
      const announceUpdate = () => {
        if (registration.waiting) {
          window.dispatchEvent(new CustomEvent("mindset:pwa-status", { detail: { updateAvailable: true } }));
        }
      };
      announceUpdate();
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) announceUpdate();
        });
      });
      window.setInterval(() => registration.update().catch((error) => {
        console.error("No se pudo comprobar si hay una actualización de MindSet.", error);
        window.dispatchEvent(new CustomEvent("mindset:pwa-status", { detail: { error: "No se pudo comprobar si hay actualizaciones." } }));
      }), 60 * 60 * 1000);
    }).catch((error) => {
      console.error("No se pudo registrar el modo sin conexión de MindSet.", error);
      window.dispatchEvent(new CustomEvent("mindset:pwa-status", { detail: { error: "No se pudo activar el modo sin conexión en este navegador." } }));
    });
  });
}
