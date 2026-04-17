import "./styles.css";
import { requireDevAccess } from "./services/dev-gate";
import { renderDashboard } from "./dashboard";

const start = async () => {
  const allowed = await requireDevAccess();
  if (!allowed) return;
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) return;
  renderDashboard(root);
};

void start();
