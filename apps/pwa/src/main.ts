import "./styles.css";
import { requireDevAccess } from "./services/dev-gate";
import { renderDashboard } from "./dashboard";

const start = async () => {
  const allowed = await requireDevAccess();
  if (!allowed) return;
  renderDashboard(document.querySelector<HTMLElement>("#app")!);
};

void start();
