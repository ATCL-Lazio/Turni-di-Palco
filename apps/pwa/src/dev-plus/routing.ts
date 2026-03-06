import { CONTROL_PLANE_VIEWS } from "../services/ops-sdk";

export type AppPage = "overview" | "cp" | "privacy";

export function resolveInitialPage(search: string): AppPage {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const view = params.get("view");
  if (view === "privacy") return "privacy";
  if (view && (CONTROL_PLANE_VIEWS as readonly string[]).includes(view)) return "cp";
  return "overview";
}
