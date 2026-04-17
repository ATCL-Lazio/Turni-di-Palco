# Security Policy

## Supported Versions

`Turni-di-Palco` is released with continuous deployment from `main`.
Security fixes are applied only to the latest commit on `main` and to the production deployment built from it.
No backports are provided for historical commits, feature branches, or forks.

| Branch / Version | Supported |
| ------- | ------------------ |
| `main` (latest commit) | :white_check_mark: |
| Feature and preview branches | :x: |
| Historical commits and tags | :x: |
| Forks and custom deployments | :x: |

## Reporting a Vulnerability

Do not report vulnerabilities through public GitHub issues.
Use private disclosure only.

1. Open a private report from this repository's **Security** tab using **Report a vulnerability**.
2. Include:
   - affected component (for example `apps/pwa`, `apps/mobile`, `supabase/functions`, `tools/*`)
   - reproducible steps and prerequisites
   - impact and attack scenario
   - proof of concept and logs/screenshots when available

If you cannot access the Security tab, contact the maintainers on GitHub first and request a private channel before sharing technical details.

## Disclosure Process

- Acknowledgement target: within 3 business days.
- Triage update target: within 7 business days.
- Remediation timeline: depends on severity and reproducibility; confirmed critical issues are prioritized.
- Public disclosure: after a fix or mitigation is available and coordinated with the reporter.
