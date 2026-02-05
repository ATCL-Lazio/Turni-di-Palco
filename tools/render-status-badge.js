#!/usr/bin/env node
require('dotenv').config();

const API_BASE = 'https://api.render.com/v1';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

function encodeBadgeValue(value) {
  return encodeURIComponent(value).replace(/-/g, '--');
}

function resolveLatestDeploy(payload) {
  if (Array.isArray(payload) && payload.length > 0) {
    return payload[0];
  }
  if (payload && Array.isArray(payload.deploys) && payload.deploys.length > 0) {
    return payload.deploys[0];
  }
  if (payload && payload.deploy) {
    return payload.deploy;
  }
  return null;
}

function resolveStatus(deploy) {
  if (!deploy || typeof deploy !== 'object') return 'unknown';
  const status = deploy.status || deploy.state || deploy.deployStatus || deploy.deploy?.status;
  return typeof status === 'string' && status.trim() ? status.trim().toLowerCase() : 'unknown';
}

function mapStatus(status) {
  const successStatuses = new Set(['live', 'deployed', 'ready', 'success', 'succeeded']);
  const inProgressStatuses = new Set([
    'created',
    'queued',
    'pending',
    'in_progress',
    'build_in_progress',
    'update_in_progress',
    'deploying',
  ]);
  const failedStatuses = new Set([
    'failed',
    'error',
    'build_failed',
    'update_failed',
    'deactivate_failed',
  ]);
  const cancelledStatuses = new Set(['canceled', 'cancelled']);

  if (successStatuses.has(status)) {
    return { text: 'Live', color: 'brightgreen' };
  }
  if (inProgressStatuses.has(status)) {
    return { text: 'Deploying', color: 'blue' };
  }
  if (failedStatuses.has(status)) {
    return { text: 'Failed', color: 'red' };
  }
  if (cancelledStatuses.has(status)) {
    return { text: 'Canceled', color: 'lightgrey' };
  }
  if (status === 'deactivated') {
    return { text: 'Inactive', color: 'lightgrey' };
  }
  return { text: 'Unknown', color: 'lightgrey' };
}

async function fetchLatestDeployStatus(apiKey, serviceId) {
  const response = await fetch(`${API_BASE}/services/${serviceId}/deploys?limit=1`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Render API ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = await response.json();
  const deploy = resolveLatestDeploy(payload);
  return resolveStatus(deploy);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.RENDER_API_KEY;
  const serviceId = args['service-id'] || process.env.RENDER_SERVICE_ID;
  const label = args.label || process.env.RENDER_BADGE_LABEL || 'Render';
  const style = args.style || process.env.RENDER_BADGE_STYLE || 'for-the-badge';
  const logo = args.logo || 'render';

  if (!apiKey) {
    console.error('Missing RENDER_API_KEY');
    process.exit(1);
  }
  if (!serviceId) {
    console.error('Missing service id. Set RENDER_SERVICE_ID or pass --service-id.');
    process.exit(1);
  }

  let status = 'unknown';
  try {
    status = await fetchLatestDeployStatus(apiKey, serviceId);
  } catch (error) {
    console.error(`Error fetching deploy status: ${error.message}`);
  }

  const mapped = mapStatus(status);
  const badgeUrl = `https://img.shields.io/badge/${encodeBadgeValue(label)}-${encodeBadgeValue(mapped.text)}-${mapped.color}?logo=${encodeURIComponent(
    logo
  )}&style=${encodeURIComponent(style)}`;
  process.stdout.write(`${badgeUrl}\n`);
}

main();
