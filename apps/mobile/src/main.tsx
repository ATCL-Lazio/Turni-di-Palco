
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "../../../shared/styles/main.css";

// On local hosts, keep stale SW caches out of the way across dev and preview sessions.
const isLocalHost = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(window.location.hostname);

if ("serviceWorker" in navigator && isLocalHost) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister().catch(() => undefined));
  });

  if ("caches" in window) {
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))).catch(() => undefined));
  }
}

createRoot(document.getElementById("root")!).render(<App />);
