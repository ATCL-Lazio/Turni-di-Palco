import { useEffect, useState } from 'react';
import type { AtclPromotion, AtclPromotionSlot } from '../data/atcl_promotions';
import { getLocalAtclPromotionBySlot } from '../data/atcl_promotions';
import { getAtclPromotionBySlotSmart } from '../services/atcl-promotions';

export function useAtclPromotion(slot: AtclPromotionSlot) {
  const [promotion, setPromotion] = useState<AtclPromotion | null>(() =>
    getLocalAtclPromotionBySlot(slot)
  );

  useEffect(() => {
    let active = true;
    setPromotion(getLocalAtclPromotionBySlot(slot));

    void getAtclPromotionBySlotSmart(slot).then((value) => {
      if (!active) return;
      setPromotion(value);
    }).catch((err) => {
      if (import.meta.env.DEV) console.warn('[useAtclPromotion] fetch error:', err);
    });

    return () => {
      active = false;
    };
  }, [slot]);

  return promotion;
}
