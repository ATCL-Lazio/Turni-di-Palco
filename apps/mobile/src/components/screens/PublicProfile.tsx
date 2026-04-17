import React from 'react';
import { ArrowLeft, Coins, Shield, Sparkles, Theater, Trophy, Users } from 'lucide-react';
import { ProgressBar } from '../ui/ProgressBar';
import { Card } from '../ui/Card';
import { Tag } from '../ui/Tag';

interface PublicProfileProps {
  userName: string;
  userRole: string;
  xpTotal: number;
  reputation: number;
  cachet: number;
  turnsCount: number;
  theatres: Array<{
    theatre: string;
    turnsCount: number;
  }>;
  theatresLoading: boolean;
  profileImage?: string;
  onBack: () => void;
}

export function PublicProfile({
  userName,
  userRole,
  xpTotal,
  reputation,
  cachet,
  turnsCount,
  theatres,
  theatresLoading,
  profileImage,
  onBack,
}: PublicProfileProps) {
  const initial = (userName?.slice(0, 1) ?? 'U').toUpperCase();

  return (
    <div
      className="min-h-screen"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}
    >
      <div className="w-full app-content pt-[36px] pb-0 flex flex-col gap-[20px]">
        <div className="px-[25px]">
          <button
            type="button"
            onClick={onBack}
            aria-label="Torna alla classifica"
            className="inline-flex items-center gap-[8px] text-[14px] leading-[20px] text-[--color-text-secondary] hover:text-white"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Torna alla classifica
          </button>
        </div>

        <div className="flex items-center px-[25px] gap-[16px]">
          <div className="bg-gradient-to-b from-[--color-burgundy-600] to-[--color-burgundy-800] rounded-full shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] size-[96px] flex items-center justify-center overflow-hidden">
            {profileImage ? (
              <img
                src={profileImage}
                alt={userName || 'Profilo utente'}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[--color-gold-400] text-[34px] leading-none font-semibold">{initial}</span>
            )}
          </div>
          <div className="min-w-0 flex-1 flex flex-col gap-[6px]">
            <p className="text-[24px] leading-[31.2px] font-bold tracking-[-0.24px] text-white truncate !m-0">
              {userName || 'Utente'}
            </p>
            <p className="text-[16px] leading-[25.6px] text-[--color-gold-400] truncate !m-0">
              {userRole || 'Ruolo'}
            </p>
          </div>
        </div>

        <div className="px-[25px]">
          <Card className="space-y-[14px]">
            <div className="flex items-center justify-between gap-[12px]">
              <div>
                <p className="text-[18px] leading-[25.2px] font-semibold text-white !m-0">
                  Progressione
                </p>
                <p className="text-[14px] leading-[20px] text-[--color-text-secondary] !m-0">
                  Una panoramica rapida del percorso ATCL.
                </p>
              </div>
              <Tag size="sm">{turnsCount} turni</Tag>
            </div>

            <dl className="grid grid-cols-2 gap-[12px] m-0" aria-label="Statistiche del profilo">
              <div
                aria-label={`XP totale: ${xpTotal}`}
                className="rounded-[12px] bg-[--color-bg-surface-elevated] p-[12px] flex flex-col gap-[8px]"
              >
                <dt className="inline-flex items-center gap-[8px] text-[13px] leading-[18px] text-[--color-text-secondary]">
                  <Trophy aria-hidden="true" size={14} />
                  XP totale
                </dt>
                <dd className="text-[24px] leading-[28px] font-semibold text-white m-0">{xpTotal}</dd>
              </div>
              <div
                aria-label={`Cachet: ${cachet}`}
                className="rounded-[12px] bg-[--color-bg-surface-elevated] p-[12px] flex flex-col gap-[8px]"
              >
                <dt className="inline-flex items-center gap-[8px] text-[13px] leading-[18px] text-[--color-text-secondary]">
                  <Coins aria-hidden="true" size={14} />
                  Cachet
                </dt>
                <dd className="text-[24px] leading-[28px] font-semibold text-white m-0">{cachet}</dd>
              </div>
              <div
                aria-label={`Reputazione: ${reputation} su 100`}
                className="rounded-[12px] bg-[--color-bg-surface-elevated] p-[12px] flex flex-col gap-[8px]"
              >
                <dt className="inline-flex items-center gap-[8px] text-[13px] leading-[18px] text-[--color-text-secondary]">
                  <Shield aria-hidden="true" size={14} />
                  Reputazione
                </dt>
                <dd className="text-[24px] leading-[28px] font-semibold text-white m-0">{reputation}/100</dd>
              </div>
              <div
                aria-label={`Presenze: ${turnsCount} turni`}
                className="rounded-[12px] bg-[--color-bg-surface-elevated] p-[12px] flex flex-col gap-[8px]"
              >
                <dt className="inline-flex items-center gap-[8px] text-[13px] leading-[18px] text-[--color-text-secondary]">
                  <Users aria-hidden="true" size={14} />
                  Presenze
                </dt>
                <dd className="text-[24px] leading-[28px] font-semibold text-white m-0">{turnsCount}</dd>
              </div>
            </dl>

            <div className="flex flex-col gap-[6px]">
              <div className="flex items-center justify-between text-[14px] leading-[20px] text-[--color-text-secondary]">
                <span className="inline-flex items-center gap-[8px]">
                  <Sparkles size={14} />
                  Reputazione ATCL
                </span>
                <span className="text-white">{reputation}/100</span>
              </div>
              <ProgressBar value={reputation} max={100} color="gold" size="md" />
            </div>
          </Card>
        </div>

        <div className="px-[25px]">
          <Card className="space-y-[14px]">
            <div className="flex items-center justify-between gap-[12px]">
              <div>
                <p className="text-[18px] leading-[25.2px] font-semibold text-white !m-0">
                  Teatri frequentati
                </p>
                <p className="text-[14px] leading-[20px] text-[--color-text-secondary] !m-0">
                  Le venue in cui questo profilo ha gia lavorato.
                </p>
              </div>
              <div className="bg-[--color-bg-surface-elevated] rounded-[12px] size-[40px] flex items-center justify-center">
                <Theater className="text-[--color-gold-400]" size={18} />
              </div>
            </div>

            {theatresLoading ? (
              <p className="text-[14px] leading-[20px] text-[--color-text-secondary] !m-0">Caricamento...</p>
            ) : theatres.length > 0 ? (
              <div className="flex flex-col gap-[10px]">
                {theatres.map((item) => (
                  <div
                    key={item.theatre}
                    className="flex items-center justify-between gap-[12px] rounded-[12px] bg-[--color-bg-surface-elevated] px-[12px] py-[10px]"
                  >
                    <span className="text-[15px] leading-[20px] text-white">{item.theatre}</span>
                    <Tag size="sm">{item.turnsCount} turni</Tag>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[14px] leading-[20px] text-[--color-text-secondary] !m-0">
                Nessun teatro registrato per questo profilo.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
