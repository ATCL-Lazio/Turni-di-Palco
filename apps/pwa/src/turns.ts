import { renderDevSectionPage } from "./dev-sections/page-shell";

void renderDevSectionPage({
  currentPage: "turns",
  title: "Mobile Data Operations",
  description: "Read and mutate workflows for Supabase data that powers mobile monitoring and control.",
  cards: [
    {
      title: "Read Operations",
      description: "Use allowlisted read queries to inspect mobile telemetry/control-plane data safely.",
      bullets: [
        "Table allowlist enforcement",
        "Column and filter sanitization",
        "Role-aware read access",
      ],
      pills: ["Read", "Allowlist", "Guardrails"],
    },
    {
      title: "Mutations",
      description: "Mutating actions are explicitly scoped and role-gated to protect mobile production flows.",
      bullets: [
        "Dry-run as default validation path",
        "Delete restricted to admin role",
        "Execution and audit persistence",
      ],
      links: [{ label: "Open Dev Plus DB Commands", href: "/control-plane.html" }],
    },
    {
      title: "DB Ops Runbook",
      description: "Minimal sequence for safe mobile data operations.",
      spanTwoColumns: true,
      bullets: [
        "Validate session + role",
        "Prepare command with explicit reason",
        "Review preview and execute with confirmation",
      ],
    },
  ],
});
