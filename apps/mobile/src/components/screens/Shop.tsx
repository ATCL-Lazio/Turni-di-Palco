import React from 'react';
import { AlertCircle, Coins, ShoppingBag, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ShopCatalogItem, ShopPurchaseResult } from '../../state/store';

type TheatreOption = {
  theatre: string;
  reputation: number;
};

interface ShopProps {
  cachet: number;
  extraActivitySlots: number;
  items: ShopCatalogItem[];
  theatreOptions: TheatreOption[];
  loading?: boolean;
  onPurchase: (itemCode: string, targetTheatre?: string | null) => Promise<ShopPurchaseResult>;
}

function formatCategory(category: ShopCatalogItem['category']) {
  if (category === 'slot') return 'Slot attività';
  if (category === 'rep_atcl') return 'Reputazione ATCL';
  return 'Reputazione Teatro';
}

export function Shop({
  cachet,
  extraActivitySlots,
  items,
  theatreOptions,
  loading = false,
  onPurchase,
}: ShopProps) {
  const [selectedTheatre, setSelectedTheatre] = React.useState<string>(theatreOptions[0]?.theatre ?? '');
  const [busyItemCode, setBusyItemCode] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{ type: 'ok' | 'error'; message: string } | null>(null);

  React.useEffect(() => {
    if (!theatreOptions.length) {
      setSelectedTheatre('');
      return;
    }
    if (!theatreOptions.some((option) => option.theatre === selectedTheatre)) {
      setSelectedTheatre(theatreOptions[0].theatre);
    }
  }, [selectedTheatre, theatreOptions]);

  const handlePurchase = async (item: ShopCatalogItem) => {
    setBusyItemCode(item.code);
    setFeedback(null);
    try {
      const result = await onPurchase(
        item.code,
        item.category === 'rep_theatre' ? selectedTheatre : null
      );
      if (result.ok) {
        const effectMessage =
          item.category === 'slot'
            ? `Slot extra ora disponibili: ${3 + result.extraSlotsAfter}`
            : item.category === 'rep_atcl'
              ? `Reputazione ATCL aggiornata a ${result.reputationAfter}/100`
              : `Pacchetto teatro applicato su ${result.theatre ?? selectedTheatre}`;
        setFeedback({
          type: 'ok',
          message: `Acquisto completato. ${effectMessage}`,
        });
        return;
      }
      setFeedback({
        type: 'error',
        message:
          result.rejectionReason === 'insufficient_cachet'
            ? 'Cachet insufficiente per completare l acquisto.'
            : result.rejectionReason === 'max_purchase_reached'
              ? 'Hai raggiunto il limite massimo per questo elemento.'
              : result.rejectionReason === 'theatre_not_eligible'
                ? 'Puoi acquistare questo pack solo su teatri già giocati.'
                : result.error,
      });
    } finally {
      setBusyItemCode(null);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
    >
      <div className="w-full app-content px-6 pt-6 pb-8 space-y-5">
        <header className="space-y-2">
          <h2 className="text-white">Shop</h2>
          <p className="text-[#b8b2b3]">Spendi cachet per potenziamenti strategici.</p>
        </header>

        <Card className="border border-[#2d2728] bg-gradient-to-br from-[#1a1617] to-[#241f20]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#b8b2b3]">Saldo disponibile</p>
              <p className="text-2xl text-white font-semibold mt-1">{cachet} Cachet</p>
              <p className="text-sm text-[#7a7577] mt-2">Slot attività totali: {3 + extraActivitySlots}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#241f20] border border-[#3d3a3b] flex items-center justify-center">
              <ShoppingBag className="text-[#f4bf4f]" size={22} />
            </div>
          </div>
        </Card>

        {feedback ? (
          <Card
            className={
              feedback.type === 'ok'
                ? 'border border-[#52c41a]/40 bg-[#1d2a1d]'
                : 'border border-[#a82847]/50 bg-[#2a1a1f]'
            }
          >
            <p className={feedback.type === 'ok' ? 'text-[#9be274]' : 'text-[#ff9aac]'}>{feedback.message}</p>
          </Card>
        ) : null}

        {loading ? (
          <Card>
            <p className="text-[#b8b2b3] text-sm">Caricamento catalogo shop...</p>
          </Card>
        ) : null}

        {items.map((item) => {
          const maxReached =
            item.category === 'slot' &&
            item.maxPurchasesPerUser != null &&
            extraActivitySlots >= item.maxPurchasesPerUser;
          const insufficientCachet = cachet < item.costCachet;
          const theatreRequiredMissing =
            item.category === 'rep_theatre' && (!theatreOptions.length || !selectedTheatre);
          const disabled =
            busyItemCode != null || maxReached || insufficientCachet || theatreRequiredMissing;

          return (
            <Card
              key={item.code}
              className="border border-white/5 bg-gradient-to-br from-[#1a1617] via-[#1d1819] to-[#221d1e]"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-white text-lg">{item.title}</h3>
                    <p className="text-sm text-[#b8b2b3] mt-1">{item.description}</p>
                  </div>
                  <Badge variant="outline" size="sm">
                    {formatCategory(item.category)}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white/90">
                    <Coins size={12} className="text-[#f4bf4f]" />
                    {item.costCachet} cachet
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white/90">
                    <Sparkles size={12} className="text-[#f4bf4f]" />
                    +{item.effectValue}
                  </span>
                  {item.category === 'slot' && item.maxPurchasesPerUser != null ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white/90">
                      max +{item.maxPurchasesPerUser} slot
                    </span>
                  ) : null}
                </div>

                {item.category === 'rep_theatre' ? (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-[#b8b2b3]">Teatro target</p>
                    {theatreOptions.length ? (
                      <select
                        value={selectedTheatre}
                        onChange={(event) => setSelectedTheatre(event.target.value)}
                        className="w-full rounded-xl border border-[#3d3a3b] bg-[#241f20] px-3 py-2 text-white outline-none focus:border-[#f4bf4f]"
                      >
                        {theatreOptions.map((option) => (
                          <option key={option.theatre} value={option.theatre}>
                            {option.theatre} ({option.reputation}/100)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="rounded-xl border border-[#a82847]/40 bg-[#2a1a1f] p-3 text-sm text-[#ff9aac]">
                        Nessun teatro idoneo: devi registrare almeno un turno.
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-[#7a7577]">
                    {maxReached
                      ? 'Limite acquisti raggiunto'
                      : insufficientCachet
                        ? 'Saldo insufficiente'
                        : theatreRequiredMissing
                          ? 'Seleziona un teatro valido'
                          : 'Disponibile'}
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={disabled}
                    onClick={() => void handlePurchase(item)}
                  >
                    Acquista
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}

        {!items.length && !loading ? (
          <Card className="border border-[#3d3a3b] bg-[#1a1617]">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-[#f4bf4f] flex-shrink-0" size={18} />
              <p className="text-sm text-[#b8b2b3]">Catalogo shop non disponibile al momento.</p>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

