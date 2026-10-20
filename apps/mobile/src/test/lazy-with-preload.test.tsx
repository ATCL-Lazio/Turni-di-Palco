import React, { act, Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lazyWithPreload } from '../lib/lazy-with-preload';

function Hello({ name }: { name: string }) {
  return <p>ciao {name}</p>;
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('lazyWithPreload', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders a preloaded component without showing the Suspense fallback', async () => {
    const loader = vi.fn(() => Promise.resolve({ default: Hello }));
    const LazyHello = lazyWithPreload(loader);
    await LazyHello.preload();

    const seen: string[] = [];
    function Fallback() {
      seen.push('fallback');
      return <p>caricamento</p>;
    }

    act(() => {
      root.render(
        <Suspense fallback={<Fallback />}>
          <LazyHello name="Ada" />
        </Suspense>,
      );
    });

    expect(container.textContent).toBe('ciao Ada');
    expect(seen).toEqual([]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('shares a single request between preload and render', async () => {
    let resolve!: (mod: { default: typeof Hello }) => void;
    const loader = vi.fn(() => new Promise<{ default: typeof Hello }>((r) => { resolve = r; }));
    const LazyHello = lazyWithPreload(loader);
    const preload = LazyHello.preload();

    act(() => {
      root.render(
        <Suspense fallback={<p>caricamento</p>}>
          <LazyHello name="Bea" />
        </Suspense>,
      );
    });
    expect(container.textContent).toBe('caricamento');

    await act(async () => {
      resolve({ default: Hello });
      await preload;
    });

    expect(container.textContent).toBe('ciao Bea');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('allows a retry after a failed preload', async () => {
    const loader = vi
      .fn<() => Promise<{ default: typeof Hello }>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ default: Hello });
    const LazyHello = lazyWithPreload(loader);

    await expect(LazyHello.preload()).rejects.toThrow('offline');
    await expect(LazyHello.preload()).resolves.toBeUndefined();
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
