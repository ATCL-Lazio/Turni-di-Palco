import React from 'react';

type LazyModule<T> = { default: T };
// Stesso vincolo di React.lazy (accetta componenti con props qualsiasi).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;

export type PreloadableComponent<T extends AnyComponent> =
  React.LazyExoticComponent<T> & {
    /** Scarica il chunk in anticipo. Se fallisce, il caricamento potrà essere ritentato. */
    preload: () => Promise<void>;
  };

/**
 * `React.lazy` con `preload()`. Il loader è condiviso tra lazy e preload, così
 * il chunk viene richiesto una volta sola.
 *
 * Se il modulo è già stato scaricato quando React monta il componente per la
 * prima volta, la factory restituisce un thenable che risolve in modo
 * sincrono: React.lazy legge il modulo nello stesso render e non sospende.
 * Con una Promise già risolta, invece, React mostrerebbe comunque il fallback
 * di Suspense (e lo terrebbe per ~300 ms di throttling).
 */
export function lazyWithPreload<T extends AnyComponent>(
  loader: () => Promise<LazyModule<T>>,
): PreloadableComponent<T> {
  let loaded: LazyModule<T> | undefined;
  let pending: Promise<LazyModule<T>> | undefined;

  const load = () => {
    if (!pending) {
      pending = loader().then(
        (mod) => {
          loaded = mod;
          return mod;
        },
        (error: unknown) => {
          // Consente un nuovo tentativo alla prossima richiesta.
          pending = undefined;
          throw error;
        },
      );
    }
    return pending;
  };

  const Component = React.lazy(() => {
    if (loaded) {
      const mod = loaded;
      const syncThenable = {
        then(onFulfilled: (value: LazyModule<T>) => unknown) {
          onFulfilled(mod);
        },
      };
      return syncThenable as unknown as Promise<LazyModule<T>>;
    }
    return load();
  }) as PreloadableComponent<T>;

  Component.preload = () => load().then(() => undefined);
  return Component;
}
