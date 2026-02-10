import { renderDevSectionPage } from "./dev-sections/page-shell";

void renderDevSectionPage({
  currentPage: "avatar",
  title: "Mobile Access Control",
  description: "Authentication, authorization, and role governance for mobile monitoring actions.",
  cards: [
    {
      title: "Supabase Authentication",
      description: "Session-based access to mobile dashboard and control-plane endpoints.",
      bullets: [
        "Password login via Supabase auth",
        "Bearer token validation on control-plane",
        "Session gate before loading sensitive views",
      ],
      pills: ["Session", "JWT", "Supabase Auth"],
    },
    {
      title: "Role Model",
      description: "Mapped roles define who can run mobile-impacting commands.",
      bullets: [
        "dev_viewer: read-only operational visibility",
        "dev_operator: controlled command execution",
        "dev_admin: sensitive mutations and governance actions",
      ],
    },
    {
      title: "Operational Access Paths",
      description: "Use these pages to validate identity and privileges before interventions.",
      spanTwoColumns: true,
      links: [
        { label: "Dev Plus Login + Session Check", href: "/control-plane.html" },
        { label: "Audit Timeline", href: "/mobile-audit.html" },
      ],
    },
  ],
});
