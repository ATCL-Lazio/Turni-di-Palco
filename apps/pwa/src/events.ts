import { renderDevSectionPage } from "./dev-sections/page-shell";

void renderDevSectionPage({
  currentPage: "events",
  title: "Mobile Releases",
  description: "Render deployment lifecycle for mobile delivery, rollout checks, and control actions.",
  cards: [
    {
      title: "Deployment Read Path",
      description: "Read release status before triggering any mobile-impacting action.",
      bullets: [
        "Service health snapshot",
        "Recent deploy history",
        "Status and failure context",
      ],
      pills: ["Render API", "Read First", "Safe Ops"],
    },
    {
      title: "Controlled Triggers",
      description: "Release triggers should always pass through prepare/execute flow.",
      bullets: [
        "Reason required for traceability",
        "Dry-run recommended as first step",
        "Confirmation token required for execution",
      ],
      links: [{ label: "Open Dev Plus Commands", href: "/control-plane.html" }],
    },
    {
      title: "Mobile Release Checklist",
      description: "Standard checks to reduce regressions in live mobile environments.",
      spanTwoColumns: true,
      bullets: [
        "Validate mobile runtime metrics before rollout",
        "Run mobile smoke checks after deploy completion",
        "Confirm audit records for all critical commands",
      ],
    },
  ],
});
