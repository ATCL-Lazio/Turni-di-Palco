import { ROLE_IDS } from './types';
import type { RoleId, RoleJourney, RoleActivityOverride, RoleProfile } from './types';

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeUnicodeEscapes(value: string) {
  if (!value.includes('\\u')) return value;
  return value.replace(/\\u([0-9a-fA-F]{4})/g, (match, codePoint: string) => {
    const parsed = Number.parseInt(codePoint, 16);
    if (!Number.isFinite(parsed)) return match;
    return String.fromCodePoint(parsed);
  });
}

function decodeHtmlEntities(value: string) {
  if (!value.includes('&')) return value;
  let decoded = value;
  for (let i = 0; i < 2; i += 1) {
    const next = decoded.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
      if (entity[0] === '#') {
        const isHex = entity[1]?.toLowerCase() === 'x';
        const number = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        if (!Number.isFinite(number)) return match;
        try {
          return String.fromCodePoint(number);
        } catch {
          return match;
        }
      }
      return HTML_ENTITY_MAP[entity] ?? match;
    });
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

export function normalizeText(value: string | null | undefined) {
  if (!value) return '';
  return decodeHtmlEntities(decodeUnicodeEscapes(value));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isRoleId(value: unknown): value is RoleId {
  return typeof value === 'string' && (ROLE_IDS as readonly string[]).includes(value);
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const next = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return next.length ? next : undefined;
}

function normalizeRoleJourney(value: unknown): RoleJourney | undefined {
  if (!isRecord(value)) return undefined;
  const headline = typeof value.headline === 'string' ? value.headline.trim() : '';
  const summary = typeof value.summary === 'string' ? value.summary.trim() : '';
  if (!headline || !summary) return undefined;
  const eyebrow = typeof value.eyebrow === 'string' && value.eyebrow.trim()
    ? value.eyebrow.trim()
    : undefined;
  const recommendedActivityId =
    typeof value.recommendedActivityId === 'string' && value.recommendedActivityId.trim()
      ? value.recommendedActivityId.trim()
      : undefined;
  const starterBadgeLabels = normalizeStringArray(value.starterBadgeLabels);
  const objectives = normalizeStringArray(value.objectives);
  const homeCtaLabel = typeof value.homeCtaLabel === 'string' && value.homeCtaLabel.trim()
    ? value.homeCtaLabel.trim()
    : undefined;

  return {
    eyebrow,
    headline,
    summary,
    recommendedActivityId,
    starterBadgeLabels,
    objectives,
    homeCtaLabel,
  };
}

function normalizeRoleActivityOverride(value: unknown): RoleActivityOverride | undefined {
  if (!isRecord(value)) return undefined;
  const xpMultiplier = Number(value.xpMultiplier);
  const cachetMultiplier = Number(value.cachetMultiplier);
  const reputationBonus = Number(value.reputationBonus);
  const highlightLabel = typeof value.highlightLabel === 'string' && value.highlightLabel.trim()
    ? value.highlightLabel.trim()
    : undefined;
  const homeNote = typeof value.homeNote === 'string' && value.homeNote.trim()
    ? value.homeNote.trim()
    : undefined;

  const next: RoleActivityOverride = {};
  if (Number.isFinite(xpMultiplier) && xpMultiplier > 0) next.xpMultiplier = xpMultiplier;
  if (Number.isFinite(cachetMultiplier) && cachetMultiplier > 0) next.cachetMultiplier = cachetMultiplier;
  if (Number.isFinite(reputationBonus)) next.reputationBonus = Math.round(reputationBonus);
  if (highlightLabel) next.highlightLabel = highlightLabel;
  if (homeNote) next.homeNote = homeNote;
  return Object.keys(next).length ? next : undefined;
}

export function normalizeRoleProfile(value: unknown): RoleProfile | undefined {
  if (!isRecord(value)) return undefined;
  const allowedActivityIds = normalizeStringArray(value.allowedActivityIds);
  const activityOrder = normalizeStringArray(value.activityOrder);
  const homeMessage = typeof value.homeMessage === 'string' && value.homeMessage.trim()
    ? value.homeMessage.trim()
    : undefined;
  const journey = normalizeRoleJourney(value.journey);
  const activityOverrides = isRecord(value.activityOverrides)
    ? Object.fromEntries(
      Object.entries(value.activityOverrides)
        .map(([activityId, override]) => [activityId, normalizeRoleActivityOverride(override)])
        .filter((entry): entry is [string, RoleActivityOverride] => Boolean(entry[1]))
    )
    : undefined;

  const next: RoleProfile = {};
  if (allowedActivityIds?.length) next.allowedActivityIds = allowedActivityIds;
  if (activityOrder?.length) next.activityOrder = activityOrder;
  if (homeMessage) next.homeMessage = homeMessage;
  if (journey) next.journey = journey;
  if (activityOverrides && Object.keys(activityOverrides).length) next.activityOverrides = activityOverrides;
  return Object.keys(next).length ? next : undefined;
}
