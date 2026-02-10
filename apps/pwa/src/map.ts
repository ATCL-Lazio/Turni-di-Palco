import { renderDevSectionPage } from "./dev-sections/page-shell";

void renderDevSectionPage({
  currentPage: "map",
  title: "Mobile Infrastructure",
  description: "Topology and environment inventory that supports the mobile experience.",
  cards: [
    {
      title: "Core Services",
      description: "Track ownership and role of each service behind the mobile app.",
      bullets: [
        "PWA/mobile shell delivery on Render static service",
        "Control-plane API service",
        "Supabase as auth + data backbone",
      ],
      pills: ["Mobile Shell", "API", "Database", "Auth"],
    },
    {
      title: "Environment Matrix",
      description: "Keep mobile deploy targets and environment variables aligned across environments.",
      bullets: [
        "Prod: Render + Supabase",
        "Dev: local PWA/mobile preview + local control-plane",
        "Shared contracts through env examples and render.yaml",
      ],
      links: [
        { label: "Deployments", href: "/events.html" },
        { label: "Runtime Metrics", href: "/profile.html" },
      ],
    },
    {
      title: "Runbook Entry Points",
      description: "Quick links to views used during mobile incident response.",
      spanTwoColumns: true,
      links: [
        { label: "Mobile Preview", href: "/mobile/" },
        { label: "Dev Plus Console", href: "/dev-plus.html" },
        { label: "Database Ops", href: "/turns.html" },
        { label: "Audit Timeline", href: "/leaderboard.html" },
      ],
    },
  ],
});
