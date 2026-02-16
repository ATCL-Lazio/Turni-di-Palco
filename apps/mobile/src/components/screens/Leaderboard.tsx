import React, { useEffect, useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { useGameState } from '../../state/store';
import { Card } from '../ui/Card';
import { Tag } from '../ui/Tag';

export function Leaderboard() {
  const { authUserId, leaderboard, leaderboardLoading, refreshLeaderboard, roles } = useGameState();

  useEffect(() => {
    refreshLeaderboard();
  }, [refreshLeaderboard]);

  const sorted = useMemo(() => {
    return [...leaderboard].sort((a, b) => b.xpTotal - a.xpTotal);
  }, [leaderboard]);

  return (
    <div
      className="min-h-screen flex flex-col justify-center items-center"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
    >
      <div className="w-full app-content px-6 pt-6 pb-8 space-y-6">
        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl text-white font-semibold leading-tight">Classifica</h2>
            <button
              onClick={() => refreshLeaderboard()}
              className="text-sm text-[#0a84ff] hover:text-[#0066d6] px-3 py-[12px] rounded-lg"
              disabled={leaderboardLoading}
            >
              Aggiorna
            </button>
          </div>
          <p className="text-sm text-[#aeaeb2]">Top giocatori per XP</p>
        </header>

        {leaderboardLoading ? (
          <p className="text-[#aeaeb2]">Caricamento...</p>
        ) : sorted.length === 0 ? (
          <Card>
            <p className="text-[#aeaeb2]">Nessun dato disponibile.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {sorted.map((entry, index) => {
              const roleName = roles.find((role) => role.id === entry.roleId)?.name ?? 'Ruolo';
              const isMe = Boolean(authUserId) && entry.id === authUserId;
              const initial = (entry.name?.slice(0, 1) ?? 'P').toUpperCase();

              return (
                <Card key={entry.id}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 text-center text-[#aeaeb2]">{index + 1}</div>

                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#2c2c2e] overflow-hidden">
                      {entry.profileImage ? (
                        <img src={entry.profileImage} alt={entry.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-semibold">{initial}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate" style={{ marginBottom: 0 }}>{entry.name}</p>
                      <p className="text-xs text-[#aeaeb2] truncate">{roleName}</p>
                    </div>

                    {isMe ? (
                      <div className="absolute top-2 right-2">
                        <Tag size="sm">Tu</Tag>
                      </div>
                    ) : null}

                    <div className="flex items-center gap-2 text-[#0a84ff]">
                      <Trophy size={18} />
                      <span className="text-white font-semibold">{entry.xpTotal}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

