export type AtclPromotionSlot = 'home' | 'turns';

export type AtclPromotion = {
  id: string;
  slot: AtclPromotionSlot;
  badgeLabel: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaUrl?: string;
  startsAt?: string;
  endsAt?: string;
};

const PROMOTIONS: AtclPromotion[] = [
  {
    id: 'atcl-home-lab-backstage-2026',
    slot: 'home',
    badgeLabel: 'Novita ATCL',
    title: 'Laboratorio backstage aperto',
    description:
      'Aperti nuovi incontri promozionali con i professionisti di palco nei teatri del circuito.',
    ctaLabel: 'Scopri il programma',
    ctaUrl: 'https://www.atcllazio.it/',
    startsAt: '2026-02-01T00:00:00.000Z',
    endsAt: '2026-06-30T23:59:59.000Z',
  },
  {
    id: 'atcl-turns-under30-2026',
    slot: 'turns',
    badgeLabel: 'Promo under 30',
    title: 'Biglietti ridotti su eventi selezionati',
    description:
      'Per un periodo limitato alcuni spettacoli ATCL hanno una promozione dedicata agli under 30.',
    ctaLabel: 'Verifica disponibilita',
    ctaUrl: 'https://www.atcllazio.it/',
    startsAt: '2026-02-15T00:00:00.000Z',
    endsAt: '2026-05-31T23:59:59.000Z',
  },
];

function parseTimestamp(value?: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isAtclPromotionActive(promotion: AtclPromotion, now: Date = new Date()): boolean {
  const nowMs = now.getTime();
  const startsAt = parseTimestamp(promotion.startsAt);
  const endsAt = parseTimestamp(promotion.endsAt);

  if (startsAt !== null && nowMs < startsAt) return false;
  if (endsAt !== null && nowMs > endsAt) return false;
  return true;
}

export function getLocalAtclPromotionBySlot(
  slot: AtclPromotionSlot,
  now: Date = new Date()
): AtclPromotion | null {
  return PROMOTIONS.find((promotion) => promotion.slot === slot && isAtclPromotionActive(promotion, now)) ?? null;
}

export function getAtclPromotionBySlot(
  slot: AtclPromotionSlot,
  now: Date = new Date()
): AtclPromotion | null {
  return getLocalAtclPromotionBySlot(slot, now);
}
