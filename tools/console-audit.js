#!/usr/bin/env node
/**
 * Console Audit — tools/console-audit.js
 *
 * Visits the production Vercel deployment with Playwright, captures browser
 * console errors, page errors and failed network requests, then opens a
 * GitHub issue labelled "console-audit" with the collected findings.
 *
 * Required env:
 *   DEPLOYMENT_URL   Production URL to audit (e.g. https://turni-di-palco.vercel.app)
 *   GITHUB_TOKEN     GitHub Actions token  (issues: write permission)
 *   GH_REPO          "owner/repo" string   (${{ github.repository }})
 *
 * The script exits 0 (no issue created) when:
 *   - DEPLOYMENT_URL is not set
 *   - No errors are collected
 *   - A console-audit issue for today already exists
 */

import { chromium } from 'playwright';

const DEPLOYMENT_URL = (process.env.DEPLOYMENT_URL ?? '').replace(/\/$/, '');
const GITHUB_TOKEN   = process.env.GITHUB_TOKEN ?? '';
const GH_REPO        = process.env.GH_REPO ?? '';

const PAGES_TO_VISIT   = ['/', '/mobile/'];
const AUDIT_LABEL      = 'console-audit';
const MAX_ROWS_IN_BODY = 50;

// ── Browser audit ────────────────────────────────────────────────────────────

async function auditBrowser() {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const collected = [];

  for (const path of PAGES_TO_VISIT) {
    const page = await browser.newPage();

    page.on('console', msg => {
      if (msg.type() !== 'error' && msg.type() !== 'warning') return;
      collected.push({
        source: 'browser-console',
        level:  msg.type(),
        message: msg.text().slice(0, 400),
        page: path,
      });
    });

    page.on('pageerror', err => {
      collected.push({
        source:  'browser-pageerror',
        level:   'error',
        message: err.message.slice(0, 400),
        page: path,
      });
    });

    page.on('requestfailed', req => {
      // Skip browser-extension injected requests
      if (/^(chrome|moz)-extension:/.test(req.url())) return;
      collected.push({
        source:  'browser-network',
        level:   'error',
        message: `${req.url().slice(0, 200)} — ${req.failure()?.errorText ?? 'network error'}`,
        page: path,
      });
    });

    try {
      await page.goto(DEPLOYMENT_URL + path, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.waitForTimeout(2_000);
    } catch (err) {
      collected.push({
        source:  'browser-navigation',
        level:   'error',
        message: err.message.slice(0, 400),
        page: path,
      });
    }

    await page.close();
  }

  await browser.close();
  return collected;
}

// ── GitHub helpers ───────────────────────────────────────────────────────────

function ghFetch(path, init = {}) {
  const [owner, repo] = GH_REPO.split('/');
  return fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    ...init,
    headers: {
      Authorization:  `Bearer ${GITHUB_TOKEN}`,
      Accept:         'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function ensureLabel() {
  await ghFetch('/labels', {
    method: 'POST',
    body: JSON.stringify({
      name:        AUDIT_LABEL,
      color:       'dc2626',
      description: 'Automated daily browser console audit',
    }),
  });
  // 422 Unprocessable = label already exists; that is fine
}

async function hasIssueToday() {
  const today = new Date().toISOString().slice(0, 10);
  const res = await ghFetch(`/issues?labels=${encodeURIComponent(AUDIT_LABEL)}&state=open&per_page=10`);
  if (!res.ok) return false;
  const issues = await res.json();
  return Array.isArray(issues) && issues.some(i => i.title?.includes(today));
}

async function createIssue(errors) {
  const today = new Date().toISOString().slice(0, 10);
  const shown    = errors.slice(0, MAX_ROWS_IN_BODY);
  const overflow = errors.length - shown.length;

  const tableRows = shown
    .map(e => `| \`${e.source}\` | ${e.level} | ${e.message.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')} | \`${e.page}\` |`)
    .join('\n');

  const body = [
    `## Console Audit — ${today}`,
    '',
    `> Automated daily browser audit of \`${DEPLOYMENT_URL}\`.`,
    `> **${errors.length}** issue(s) collected across pages: ${PAGES_TO_VISIT.map(p => `\`${p}\``).join(', ')}.`,
    '',
    '### Collected errors',
    '',
    '| Source | Level | Message | Page |',
    '|--------|-------|---------|------|',
    tableRows,
    overflow > 0 ? `\n_…and ${overflow} more (truncated to first ${MAX_ROWS_IN_BODY})_` : '',
    '',
    '---',
    '### Next steps',
    '',
    '- [ ] Run `/console-audit` in Claude Code to enrich this issue with Vercel runtime logs + AI analysis',
    '- [ ] Triage each error and assign priority',
    '- [ ] Open fix PRs for `error`-level items',
    '- [ ] Re-run the audit manually after fixes (`Actions → Console Audit → Run workflow`)',
    '',
    '---',
    '_v1 — browser console only. Run `/console-audit` in Claude Code for the full audit (runtime logs + analysis)._',
    '_Generated by the [Console Audit](../../actions/workflows/console-audit.yml) workflow._',
  ].join('\n');

  const res = await ghFetch('/issues', {
    method: 'POST',
    body: JSON.stringify({
      title:  `[Console Audit] ${today} — ${errors.length} issue(s) detected`,
      body,
      labels: [AUDIT_LABEL],
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`GitHub issue creation failed (${res.status} ${res.statusText}): ${errorBody}`);
  }

  const issue = await res.json();
  if (!issue?.html_url) {
    throw new Error('GitHub issue creation returned an unexpected response (missing html_url).');
  }
  return issue.html_url;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!DEPLOYMENT_URL) {
    console.log('DEPLOYMENT_URL not set — nothing to audit.');
    process.exit(0);
  }
  if (!GITHUB_TOKEN || !GH_REPO) {
    console.error('GITHUB_TOKEN and GH_REPO must be set.');
    process.exit(1);
  }

  console.log(`Auditing ${DEPLOYMENT_URL} (pages: ${PAGES_TO_VISIT.join(', ')}) …`);

  const errors = await auditBrowser();

  console.log(`Collected ${errors.length} issue(s).`);

  if (errors.length === 0) {
    console.log('No errors — skipping issue creation.');
    process.exit(0);
  }

  if (await hasIssueToday()) {
    console.log('A console-audit issue for today already exists — skipping.');
    process.exit(0);
  }

  await ensureLabel();
  const url = await createIssue(errors);
  console.log(`Issue created: ${url}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
