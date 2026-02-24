import React from 'react';
import { ArrowUpRight, Megaphone } from 'lucide-react';
import type { AtclPromotion } from '../data/atcl_promotions';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

type AtclPromoBannerProps = {
  promotion: AtclPromotion;
};

function formatPromotionRange(startsAt?: string, endsAt?: string): string | null {
  const formatter = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' });
  const startDate = startsAt ? new Date(startsAt) : null;
  const endDate = endsAt ? new Date(endsAt) : null;
  const isValidDate = (value: Date | null) => Boolean(value && !Number.isNaN(value.getTime()));

  if (isValidDate(startDate) && isValidDate(endDate)) {
    return `${formatter.format(startDate!)} - ${formatter.format(endDate!)}`;
  }

  if (isValidDate(startDate)) {
    return `Dal ${formatter.format(startDate!)}`;
  }

  if (isValidDate(endDate)) {
    return `Fino al ${formatter.format(endDate!)}`;
  }

  return null;
}

export function AtclPromoBanner({ promotion }: AtclPromoBannerProps) {
  const canOpenCta = Boolean(promotion.ctaLabel && promotion.ctaUrl);
  const rangeLabel = formatPromotionRange(promotion.startsAt, promotion.endsAt);

  const handleOpenCta = () => {
    if (!promotion.ctaUrl || typeof window === 'undefined') return;
    window.open(promotion.ctaUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card
      animateOnMount
      className="overflow-hidden border border-[#f4bf4f]/20 bg-gradient-to-br from-[#2d0a0f] via-[#4a0e1a] to-[#1a1617]"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#f4bf4f]/15 px-3 py-1 text-[11px] uppercase tracking-wide text-[#f4bf4f]">
            <Megaphone size={13} />
            <span>{promotion.badgeLabel}</span>
          </div>
          {rangeLabel ? <span className="text-xs text-[#f5d9a8]">{rangeLabel}</span> : null}
        </div>

        <div className="space-y-1">
          <h4 className="text-white leading-tight">{promotion.title}</h4>
          <p className="text-sm text-[#f6ddd5] leading-relaxed">{promotion.description}</p>
        </div>

        {canOpenCta ? (
          <Button
            variant="secondary"
            size="sm"
            className="min-h-[40px] border-[#f4bf4f] bg-[#f4bf4f]/10 text-[#f4bf4f] hover:bg-[#f4bf4f]/20"
            onClick={handleOpenCta}
          >
            {promotion.ctaLabel}
            <ArrowUpRight size={14} />
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
