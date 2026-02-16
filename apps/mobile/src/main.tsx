
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "../../../shared/styles/main.css";
import "./styles/ios26-native.css";

// On the dev server (5173) keep SW caches out of the way to avoid stale bundles.
const isDevServer = window.location.port === "5173";

if ("serviceWorker" in navigator && isDevServer) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister().catch(() => undefined));
  });

  if ("caches" in window) {
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))).catch(() => undefined));
  }
}

createRoot(document.getElementById("root")!).render(<App />);
