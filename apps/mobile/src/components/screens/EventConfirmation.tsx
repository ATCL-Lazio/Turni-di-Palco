import React, { useMemo, useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { MapPin, Calendar, Clock, TrendingUp, Award, Coins, CheckCircle2, Zap, AlertTriangle } from 'lucide-react';
import { GameEvent, Role, RoleId, Rewards, TurnSyncStatus, computeTurnRewards } from '../../state/store';

type ConfirmTurnResult =
  | {
    ok: true;
    syncStatus: TurnSyncStatus;
    boostRequested: boolean;
    boostApplied: boolean;
    boostRejectionReason: string | null;
    rewards?: Rewards;
  }
  | { ok: false; error: string };

interface EventConfirmationProps {
  event?: GameEvent;
  role?: Role;
  cachet: number;
  tokenAtcl: number;
  pendingBoostRequests: number;
  allowBoost?: boolean;
  onConfirm: (options: { boostRequested: boolean }) => Promise<ConfirmTurnResult> | ConfirmTurnResult;
  onSuccess: () => void;
  onCancel: () => void;
}

export function EventConfirmation({
  event,
  role,
  cachet,
  tokenAtcl,
  pendingBoostRequests,
  allowBoost = true,
  onConfirm,
  onSuccess,
  onCancel,
}: EventConfirmationProps) {
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [boostRequested, setBoostRequested] = useState(false);
  const [confirmResult, setConfirmResult] = useState<Extract<ConfirmTurnResult, { ok: true }> | null>(null);
  const roleId = (role?.id ?? 'attore') as RoleId;
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  const resolvedRewards = useMemo(() => {
    if (!event) return { xp: 0, reputation: 0, cachet: 0 };
    return computeTurnRewards(event, roleId);
  }, [event, roleId]);

  const boostedPreviewRewards = useMemo(() => ({
    ...resolvedRewards,
    xp: Math.ceil(resolvedRewards.xp * 1.1),
    cachet: Math.ceil(resolvedRewards.cachet * 1.1),
  }), [resolvedRewards]);

  const renderedRewards = confirmResult?.rewards ?? (
    boostRequested && allowBoost && !isOffline ? boostedPreviewRewards : resolvedRewards
  );

  const resolvedEvent = event ?? {
    name: 'Evento non trovato',
    theatre: 'N/D',
    date: '',
    time: '',
    genre: '',
  };

  const feedbackTitle = useMemo(() => {
    if (!confirmResult) return 'Turno registrato';
    if (confirmResult.syncStatus === 'pending') {
      return confirmResult.boostRequested
        ? 'Boost in verifica'
        : 'Turno in attesa di sincronizzazione';
    }
    if (confirmResult.boostRequested && confirmResult.boostApplied) return 'Boost applicato';
    if (confirmResult.boostRequested && !confirmResult.boostApplied) return 'Boost non applicato';
    return 'Turno registrato';
  }, [confirmResult]);

  const feedbackMessage = useMemo(() => {
    if (!confirmResult) return 'Il tuo turno è stato registrato con successo.';
    if (confirmResult.syncStatus === 'pending') {
      return confirmResult.boostRequested
        ? 'Richiesta boost salvata in coda: verrà verificata online.'
        : 'Turno salvato in coda: sarà sincronizzato appena torni online.';
    }
    if (confirmResult.boostRequested && confirmResult.boostApplied) {
      return 'Verifica completata: +10% XP e +10% Cachet applicati.';
    }
    if (confirmResult.boostRequested && !confirmResult.boostApplied) {
      return 'Boost non verificabile: applicate solo le ricompense base del turno.';
    }
    return 'Sincronizzazione completata.';
  }, [confirmResult]);

  const handleConfirm = async () => {
    if (isSubmitting || isSuccess) return;
    setIsSubmitting(true);

    try {
      const result = await onConfirm({ boostRequested: allowBoost ? boostRequested : false });
      if (!result.ok) {
        window.alert(result.error);
        return;
      }

      setConfirmResult(result);
      setIsSuccess(true);
      window.setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante la registrazione turno.';
      window.alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="app-content w-full text-center animate-fade-in">
          <div className="w-24 h-24 bg-gradient-to-br from-[#52c41a] to-[#389e0d] rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <CheckCircle2 className="text-white" size={48} />
          </div>

          <h2 className="text-white mb-3">{feedbackTitle}</h2>
          <p className="text-[#b8b2b3] mb-8">{feedbackMessage}</p>

          <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20] mb-6">
            <h4 className="text-[#f4bf4f] mb-4">Ricompense registrate</h4>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-[#e6a23c] to-[#f4bf4f] rounded-lg flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="text-[#0f0d0e]" size={24} />
                </div>
                <p className="text-2xl text-white mb-1">+{renderedRewards.xp}</p>
                <p className="text-xs text-[#b8b2b3]">XP</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Award className="text-[#f4bf4f]" size={24} />
                </div>
                <p className="text-2xl text-white mb-1">+{renderedRewards.reputation}</p>
                <p className="text-xs text-[#b8b2b3]">Reputazione</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-[#241f20] rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Coins className="text-[#f4bf4f]" size={24} />
                </div>
                <p className="text-2xl text-white mb-1">+{renderedRewards.cachet}</p>
                <p className="text-xs text-[#b8b2b3]">Cachet</p>
              </div>
            </div>
          </Card>

          <p className="text-sm text-[#b8b2b3]">Reindirizzamento alla home...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="app-content px-6 space-y-6 pt-6">
        <div>
          <h2 className="text-white mb-2">Conferma turno</h2>
        </div>

        <Card>
          <div className="mb-4">
            <h3 className="text-white mb-1">{resolvedEvent.name}</h3>
            {resolvedEvent.genre ? <Badge variant="default" size="sm">{resolvedEvent.genre}</Badge> : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-[#b8b2b3]">
              <MapPin size={18} className="text-[#f4bf4f]" />
              <span>{resolvedEvent.theatre}</span>
            </div>

            <div className="flex items-center gap-3 text-[#b8b2b3]">
              <Calendar size={18} className="text-[#f4bf4f]" />
              <span>{resolvedEvent.date}</span>
            </div>

            <div className="flex items-center gap-3 text-[#b8b2b3]">
              <Clock size={18} className="text-[#f4bf4f]" />
              <span>{resolvedEvent.time}</span>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-white mb-1">Ruolo registrato</h4>
              <p className="text-sm text-[#b8b2b3]">{role?.focus ?? 'Selezionato in fase di registrazione'}</p>
            </div>
            <Badge variant="outline" size="md">
              {role?.name ?? 'Ruolo'}
            </Badge>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-[#f4bf4f] mb-1">Boost token ATCL</h4>
              <p className="text-sm text-[#b8b2b3]">
                Costo 1 token. Effetto: +10% XP e +10% Cachet.
              </p>
              <p className="text-xs text-[#b8b2b3] mt-2">
                Saldo economico: Cachet {cachet} - Token {tokenAtcl}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBoostRequested((prev) => !prev)}
              disabled={!allowBoost}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                boostRequested
                  ? 'bg-[#f4bf4f] text-[#0f0d0e]'
                  : 'bg-[#241f20] text-[#b8b2b3]'
              }`}
            >
              {boostRequested ? 'Boost ON' : 'Boost OFF'}
            </button>
          </div>

          <div className="mt-3 rounded-lg bg-[#241f20] px-3 py-2 text-xs text-[#b8b2b3]">
            {!allowBoost
              ? 'Boost temporaneamente disattivato da configurazione.'
              : isOffline
              ? 'Offline: richiesta boost in coda, verifica solo online.'
              : boostRequested
                ? 'Online: la verifica token avviene lato server al momento della registrazione.'
                : 'Registrazione standard senza boost.'}
          </div>
        </Card>

        {pendingBoostRequests > 0 ? (
          <Card className="bg-[#2a1f14] border border-[#f4bf4f]/30">
            <div className="flex items-center gap-2 text-[#f4bf4f]">
              <AlertTriangle size={16} />
              <p className="text-sm">
                {pendingBoostRequests} richiesta/e boost in verifica in coda offline.
              </p>
            </div>
          </Card>
        ) : null}

        <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20]">
          <h4 className="text-[#f4bf4f] mb-4">Ricompense previste</h4>

          <div className="flex items-center justify-around">
            <div className="text-center">
              <TrendingUp className="text-[#f4bf4f] mx-auto mb-2" size={24} />
              <p className="text-white mb-1">+{boostRequested && allowBoost ? boostedPreviewRewards.xp : resolvedRewards.xp}</p>
              <p className="text-xs text-[#b8b2b3]">XP</p>
            </div>

            <div className="text-center">
              <Award className="text-[#f4bf4f] mx-auto mb-2" size={24} />
              <p className="text-white mb-1">+{resolvedRewards.reputation}</p>
              <p className="text-xs text-[#b8b2b3]">Reputazione</p>
            </div>

            <div className="text-center">
              <Coins className="text-[#f4bf4f] mx-auto mb-2" size={24} />
              <p className="text-white mb-1">+{boostRequested && allowBoost ? boostedPreviewRewards.cachet : resolvedRewards.cachet}</p>
              <p className="text-xs text-[#b8b2b3]">Cachet</p>
            </div>
          </div>
          {boostRequested && allowBoost ? (
            <div className="mt-3 text-xs text-[#f4bf4f] flex items-center gap-2">
              <Zap size={14} />
              Richiesta boost attiva (conferma finale solo lato server).
            </div>
          ) : null}
        </Card>

        <div className="space-y-3">
          <Button variant="primary" size="lg" fullWidth onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Conferma in corso...' : 'Conferma turno'}
          </Button>

          <Button variant="ghost" size="lg" fullWidth onClick={onCancel} disabled={isSubmitting}>
            Annulla
          </Button>
        </div>
      </div>
    </div>
  );
}
