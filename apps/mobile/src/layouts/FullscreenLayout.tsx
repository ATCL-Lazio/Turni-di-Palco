import React from 'react';

interface FullscreenLayoutProps {
  children: React.ReactNode;
}

export function FullscreenLayout({ children }: FullscreenLayoutProps) {
  return <div className="app-frame">{children}</div>;
}
