import { renderDevSectionPage } from "./dev-sections/page-shell";

void renderDevSectionPage({
  currentPage: "profile",
  title: "Mobile Runtime Health",
  description: "Health and trend indicators for the live mobile experience.",
  cards: [
    {
      title: "Dashboard Metrics",
      description: "Track pending confirmations, execution trends, and mobile-facing runtime signals.",
      bullets: [
        "Control-plane metrics endpoint as primary source",
        "Fallback-safe metric rendering on UI",
        "Refresh-driven troubleshooting workflow",
      ],
      pills: ["Observability", "KPIs", "Health"],
    },
    {
      title: "Refresh Discipline",
      description: "Use periodic manual refresh for mobile incident checks and validation.",
      bullets: [
        "Validate active role and session expiry",
        "Review critical cards before commands",
        "Confirm data freshness in incident handling",
      ],
    },
    {
      title: "Related Views",
      description: "Jump directly to sections that explain mobile anomalies.",
      spanTwoColumns: true,
      links: [
        { label: "Dev Plus Metrics", href: "/control-plane.html" },
        { label: "Mobile Infrastructure", href: "/mobile-infrastructure.html" },
        { label: "Mobile Audit", href: "/mobile-audit.html" },
      ],
    },
  ],
});
