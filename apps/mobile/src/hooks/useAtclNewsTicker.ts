import { useEffect, useState } from 'react';
import type { AtclNewsTickerItem } from '../services/atcl-promotions';
import { getAtclNewsTickerItemsSmart, getLocalAtclNewsTickerItems } from '../services/atcl-promotions';

export function useAtclNewsTicker(limit = 20) {
  const [items, setItems] = useState<AtclNewsTickerItem[]>(() =>
    getLocalAtclNewsTickerItems().slice(0, Math.max(1, Math.floor(limit)))
  );

  useEffect(() => {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 20;
    let active = true;
    setItems(getLocalAtclNewsTickerItems().slice(0, normalizedLimit));

    void getAtclNewsTickerItemsSmart(normalizedLimit).then((nextItems) => {
      if (!active) return;
      setItems(nextItems);
    });

    return () => {
      active = false;
    };
  }, [limit]);

  return items;
}
