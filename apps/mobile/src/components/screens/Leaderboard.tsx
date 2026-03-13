import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { LeaderboardEntry, useGameState } from '../../state/store';
import { Card } from '../ui/Card';
import { Screen } from '../ui/Screen';

interface LeaderboardProps {
  onSelectEntry?: (entry: LeaderboardEntry, isCurrentUser: boolean) => void;
}

export function Leaderboard({ onSelectEntry }: LeaderboardProps) {
  const { authUserId, leaderboard, leaderboardLoading, refreshLeaderboard, roles } = useGameState();
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const previousRowTops = useRef(new Map<string, number>());

  useEffect(() => {
    let cancelled = false;
    const runInitialRefresh = async () => {
      await refreshLeaderboard();
      if (!cancelled) setHasBootstrapped(true);
    };
    void runInitialRefresh();
    const intervalId = window.setInterval(() => { void refreshLeaderboard(); }, 15000);
    return () => { cancelled = true; window.clearInterval(intervalId); };
  }, [refreshLeaderboard]);

  const sorted = useMemo(
    () => [...leaderboard].sort((a, b) => b.xpTotal - a.xpTotal).filter(e => e.xpTotal > 0 || e.id === authUserId),
    [leaderboard, authUserId],
  );

  useLayoutEffect(() => {
    animateRowTransitions(sorted, rowRefs, previousRowTops);
  }, [sorted]);

  const showInitialLoading = leaderboardLoading && !hasBootstrapped && sorted.length === 0;

  return (
    <Screen contentClassName="px-6 pt-6 pb-8 space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl text-white font-semibold leading-tight">Classifica</h2>
        <p className="text-sm text-[#b8b2b3]">Top giocatori per XP</p>
      </header>

      {showInitialLoading ? (
        <p className="text-[#b8b2b3]">Caricamento...</p>
      ) : sorted.length === 0 ? (
        <Card><p className="text-[#b8b2b3]">Nessun dato disponibile.</p></Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((entry, index) => {
            const roleName = roles.find(r => r.id === entry.roleId)?.name ?? 'Ruolo';
            const isMe = Boolean(authUserId) && entry.id === authUserId;
            return (
              <div
                key={entry.id}
                ref={node => { if (node) rowRefs.current.set(entry.id, node); else rowRefs.current.delete(entry.id); }}
                className="transform-gpu"
              >
                <LeaderboardRow
                  entry={entry}
                  index={index}
                  roleName={roleName}
                  isMe={isMe}
                  onClick={onSelectEntry ? () => onSelectEntry(entry, isMe) : undefined}
                  hoverable={Boolean(onSelectEntry)}
                />
              </div>
            );
          })}
        </div>
      )}
    </Screen>
  );
}

// === Sub-components ===

function LeaderboardRow({
  entry, index, roleName, isMe, onClick, hoverable,
}: {
  entry: LeaderboardEntry;
  index: number;
  roleName: string;
  isMe: boolean;
  onClick?: () => void;
  hoverable: boolean;
}) {
  const initial = (entry.name?.slice(0, 1) ?? 'P').toUpperCase();

  return (
    <Card onClick={onClick} hoverable={hoverable} className={getPodiumCardClass(index, isMe)}>
      <div className="flex items-center gap-3">
        <RankBadge position={index} />

        <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-[#241f20] overflow-hidden ${
          isMe ? 'ring-2 ring-[#f4bf4f]/45 shadow-[0_0_16px_rgba(244,191,79,0.16)]' : ''
        }`}>
          {entry.profileImage ? (
            <img src={entry.profileImage} alt={entry.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-semibold">{initial}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {isMe && <CurrentUserIndicator />}
            <p className="text-white font-semibold truncate min-w-0" style={{ marginBottom: 0 }}>{entry.name}</p>
          </div>
          <p className="text-xs text-[#b8b2b3] truncate">{roleName}</p>
        </div>

        <div className="flex items-center gap-2 text-[#f4bf4f] shrink-0">
          <Trophy size={18} />
          <span className="text-white font-semibold">{entry.xpTotal}</span>
        </div>
      </div>
    </Card>
  );
}

function RankBadge({ position }: { position: number }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${getRankClass(position)}`}>
      {position + 1}
    </div>
  );
}

function CurrentUserIndicator() {
  return (
    <span className="relative inline-flex w-2.5 h-2.5 shrink-0" aria-hidden="true">
      <span className="absolute inset-0 rounded-full bg-[#f4bf4f]/35 animate-ping" />
      <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-[#f4bf4f] shadow-[0_0_10px_rgba(244,191,79,0.28)]" />
    </span>
  );
}

// === Helpers ===

const PODIUM_CLASSES = [
  'border border-[#f4bf4f]/35 bg-[linear-gradient(135deg,rgba(244,191,79,0.08),rgba(26,22,23,0.95))] shadow-[0_0_0_1px_rgba(244,191,79,0.10),0_0_24px_rgba(244,191,79,0.14)]',
  'border border-[#d0d5dd]/28 bg-[linear-gradient(135deg,rgba(208,213,221,0.07),rgba(26,22,23,0.95))] shadow-[0_0_0_1px_rgba(208,213,221,0.08),0_0_20px_rgba(208,213,221,0.10)]',
  'border border-[#c97a3d]/28 bg-[linear-gradient(135deg,rgba(201,122,61,0.08),rgba(26,22,23,0.95))] shadow-[0_0_0_1px_rgba(201,122,61,0.08),0_0_20px_rgba(201,122,61,0.10)]',
];

function getPodiumCardClass(position: number, isMe: boolean) {
  if (position < 3) {
    return `${PODIUM_CLASSES[position]}${isMe ? ' ring-1 ring-[#f4bf4f]/18' : ''}`;
  }
  return isMe ? 'border border-[#f4bf4f]/25 shadow-[0_0_0_1px_rgba(244,191,79,0.08),0_0_18px_rgba(244,191,79,0.10)]' : '';
}

function getRankClass(position: number) {
  switch (position) {
    case 0: return 'bg-gradient-to-b from-[#f6c85f] to-[#d89a1f] text-[#0f0d0e] shadow-[0_8px_18px_rgba(244,191,79,0.24)]';
    case 1: return 'bg-gradient-to-b from-[#e5e7eb] to-[#aeb6c2] text-[#0f0d0e] shadow-[0_8px_18px_rgba(208,213,221,0.18)]';
    case 2: return 'bg-gradient-to-b from-[#d7996a] to-[#a95e27] text-white shadow-[0_8px_18px_rgba(201,122,61,0.18)]';
    default: return 'text-[#b8b2b3]';
  }
}

function animateRowTransitions(
  sorted: { id: string }[],
  rowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>,
  previousRowTops: React.MutableRefObject<Map<string, number>>,
) {
  const nextRowIds = new Set(sorted.map(e => e.id));

  for (const [rowId, previousTop] of previousRowTops.current.entries()) {
    if (!nextRowIds.has(rowId)) { previousRowTops.current.delete(rowId); continue; }
    const rowNode = rowRefs.current.get(rowId);
    if (!rowNode) continue;
    const deltaY = previousTop - rowNode.getBoundingClientRect().top;
    if (Math.abs(deltaY) > 1) {
      rowNode.style.transition = 'none';
      rowNode.style.transform = `translateY(${deltaY}px)`;
      rowNode.style.willChange = 'transform';
      requestAnimationFrame(() => {
        rowNode.style.transition = 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)';
        rowNode.style.transform = 'translateY(0)';
        window.setTimeout(() => { rowNode.style.willChange = ''; }, 400);
      });
    }
  }

  for (const entry of sorted) {
    const rowNode = rowRefs.current.get(entry.id);
    if (rowNode) previousRowTops.current.set(entry.id, rowNode.getBoundingClientRect().top);
  }
}
