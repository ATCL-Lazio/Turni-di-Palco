import { renderDevSectionPage } from "./dev-sections/page-shell";

void renderDevSectionPage({
  currentPage: "game",
  title: "Mobile Ops Hub",
  description: "Control-room overview for mobile stability, release workflow, and runbook access.",
  quickActions: [
    { id: "map", label: "Infrastructure", href: "/map.html" },
    { id: "profile", label: "Runtime Metrics", href: "/profile.html" },
    { id: "events", label: "Deployments", href: "/events.html" },
    { id: "turns", label: "Database Ops", href: "/turns.html" },
    { id: "leaderboard", label: "Audit Timeline", href: "/leaderboard.html" },
  ],
  cards: [
    {
      title: "Mobile Surface",
      description: "Single entrypoint for mobile shell health, control-plane actions, and telemetry.",
      bullets: [
        "PWA multipage dedicated to mobile monitoring",
        "Supabase-authenticated control-plane",
        "Render-backed delivery and service integration",
      ],
      pills: ["Mobile", "Control-Plane", "Render", "Supabase"],
    },
    {
      title: "Intervention Model",
      description: "Two-step command flow for mobile-impacting actions with audit persistence.",
      bullets: [
        "Prepare command with mobile-impact preview and risk level",
        "Confirm with token + explicit confirm text",
        "Execution tracked in audit and execution tables",
      ],
      links: [{ label: "Open Dev Plus Console", href: "/dev-plus.html" }],
    },
    {
      title: "Navigation",
      description: "Each section maps to a mobile monitoring domain.",
      spanTwoColumns: true,
      links: [
        { label: "Infrastructure", href: "/map.html" },
        { label: "Identity & Access", href: "/avatar.html" },
        { label: "Runtime Metrics", href: "/profile.html" },
        { label: "Deployments", href: "/events.html" },
        { label: "Database Ops", href: "/turns.html" },
        { label: "Audit Timeline", href: "/leaderboard.html" },
      ],
    },
  ],
});
