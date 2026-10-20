import React, { useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { buildDisplacementMap, supportsBackdropRefraction } from '../../lib/liquid-glass';
import { cn } from './utils';

type LiquidGlassTag = 'div' | 'nav' | 'section' | 'header' | 'footer';

interface LiquidGlassProps extends React.HTMLAttributes<HTMLElement> {
  as?: LiquidGlassTag;
  /** Raggio degli angoli in px: deve combaciare con il border-radius CSS. */
  radius?: number;
  /** Spostamento massimo dei pixel sul bordo, in px. */
  strength?: number;
  /** Ampiezza della fascia rifratta, in px. Default: 30% del lato corto. */
  falloff?: number;
}

const OPT_OUT_QUERY = '(prefers-reduced-transparency: reduce), (prefers-contrast: more)';

function subscribeToOptOut(onChange: () => void) {
  const mql = window.matchMedia?.(OPT_OUT_QUERY);
  mql?.addEventListener('change', onChange);
  return () => mql?.removeEventListener('change', onChange);
}

function getRefractionAllowed(): boolean {
  if (typeof window === 'undefined' || typeof CSS === 'undefined') return false;
  if (window.matchMedia?.(OPT_OUT_QUERY).matches) return false;
  return supportsBackdropRefraction({
    userAgent: window.navigator.userAgent,
    supports: (property, value) => CSS.supports(property, value),
  });
}

function useRefractionAllowed(): boolean {
  return useSyncExternalStore(subscribeToOptOut, getRefractionAllowed, () => false);
}

interface RefractionMap {
  href: string;
  width: number;
  height: number;
}

function renderMap(width: number, height: number, radius: number, falloff: number): string | null {
  const map = buildDisplacementMap(width, height, { radius, falloff });
  const canvas = document.createElement('canvas');
  canvas.width = map.width;
  canvas.height = map.height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.putImageData(new ImageData(map.data, map.width, map.height), 0, 0);
  return canvas.toDataURL();
}

/**
 * Superficie "liquid glass": blur + saturazione del contenuto sottostante,
 * riflesso sul bordo e, nei browser Chromium, rifrazione del bordo tramite
 * un filtro SVG applicato al backdrop. Altrove resta un vetro solo-blur;
 * con riduzione trasparenza o contrasto elevato diventa una superficie piena
 * (gestito in CSS su `.liquid-glass`).
 */
export function LiquidGlass({
  as = 'div',
  radius = 0,
  strength = 10,
  falloff,
  className,
  style,
  children,
  ...rest
}: LiquidGlassProps) {
  const Tag = as as React.ElementType;
  const ref = useRef<HTMLElement>(null);
  const filterId = `liquid-glass-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const refractionAllowed = useRefractionAllowed();
  const [map, setMap] = useState<RefractionMap | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!refractionAllowed || !element || typeof ResizeObserver === 'undefined') {
      setMap(null);
      return undefined;
    }

    let frameId = 0;
    let lastKey = '';
    const update = () => {
      frameId = 0;
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      if (width === 0 || height === 0) return;
      const key = `${width}x${height}`;
      if (key === lastKey) return;
      lastKey = key;
      const band = falloff ?? Math.max(4, Math.min(width, height) * 0.3);
      const href = renderMap(width, height, radius, band);
      setMap(href ? { href, width, height } : null);
    };

    const observer = new ResizeObserver(() => {
      if (!frameId) frameId = window.requestAnimationFrame(update);
    });
    observer.observe(element);
    update();

    return () => {
      observer.disconnect();
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [refractionAllowed, radius, falloff]);

  const glassStyle = map
    ? ({ ...style, '--lg-refraction': `url(#${filterId})` } as React.CSSProperties)
    : style;

  return (
    <Tag ref={ref} className={cn('liquid-glass', className)} style={glassStyle} {...rest}>
      {map ? (
        <svg className="liquid-glass-defs" width="0" height="0" aria-hidden="true" focusable="false">
          <filter
            id={filterId}
            x="0"
            y="0"
            width={map.width}
            height={map.height}
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={map.href}
              x="0"
              y="0"
              width={map.width}
              height={map.height}
              preserveAspectRatio="none"
              result="liquid-glass-map"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="liquid-glass-map"
              scale={strength * 2}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </svg>
      ) : null}
      {children}
    </Tag>
  );
}
