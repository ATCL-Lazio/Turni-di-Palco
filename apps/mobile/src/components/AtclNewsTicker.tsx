import React from 'react';
import { Pause, Play, Radio } from 'lucide-react';
import type { AtclNewsTickerItem } from '../services/atcl-promotions';
import { Card } from './ui/Card';

type AtclNewsTickerProps = {
  items: AtclNewsTickerItem[];
};

export function AtclNewsTicker({ items }: AtclNewsTickerProps) {
  const [isPaused, setIsPaused] = React.useState(false);
  if (!items.length) return null;

  const tickerItems = [...items, ...items];
  const durationSeconds = Math.max(70, items.length * 14);

  return (
    <Card className="overflow-hidden border border-[#f4bf4f]/15 bg-gradient-to-r from-[#1a1617] via-[#221b1d] to-[#1a1617] p-0">
      <div className="atcl-news-headline border-b border-[#f4bf4f]/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#f4bf4f]/15 text-[#f4bf4f]">
            <Radio size={13} />
          </div>
          <p className="text-[11px] uppercase tracking-wide text-[#f4bf4f]">News ATCL Live</p>
        </div>

        <button
          type="button"
          className="atcl-news-toggle"
          onClick={() => setIsPaused((value) => !value)}
          aria-pressed={isPaused}
          aria-label={isPaused ? 'Riprendi ticker news' : 'Ferma ticker news'}
        >
          {isPaused ? (
            <>
              <Play size={14} />
              Riprendi
            </>
          ) : (
            <>
              <Pause size={14} />
              Ferma
            </>
          )}
        </button>
      </div>

      <div
        className={`atcl-news-ticker-mask${isPaused ? ' is-paused' : ''}`}
        style={{ '--atcl-news-duration': `${durationSeconds}s` } as React.CSSProperties}
      >
        <div className="atcl-news-ticker-track">
          {tickerItems.map((item, index) => (
            <a
              key={`${item.id}-${index}`}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="atcl-news-ticker-item"
              title={`${item.sourceLabel}: ${item.title}`}
            >
              <span className="atcl-news-source-pill">{item.sourceLabel}</span>
              <span className="atcl-news-ticker-title">{item.title}</span>
            </a>
          ))}
        </div>
      </div>
    </Card>
  );
}
