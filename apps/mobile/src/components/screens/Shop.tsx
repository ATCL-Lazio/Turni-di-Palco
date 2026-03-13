import React, { useEffect, useState } from 'react';
import { AlertCircle, Coins, ShoppingBag, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Screen } from '../ui/Screen';
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
  canPurchase?: boolean;
  onPurchase: (itemCode: string, targetTheatre?: string | null) => Promise<ShopPurchaseResult>;
}

export function Shop({
  cachet, extraActivitySlots, items, theatreOptions,
  loading = false, canPurchase = true, onPurchase,
}: ShopProps) {
  const [selectedTheatre, setSelectedTheatre] = useState<string>(theatreOptions[0]?.theatre ?? '');
  const [busyItemCode, setBusyItemCode] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!theatreOptions.length) { setSelectedTheatre(''); return; }
    if (!theatreOptions.some(o => o.theatre === selectedTheatre)) {
      setSelectedTheatre(theatreOptions[0].theatre);
    }
  }, [selectedTheatre, theatreOptions]);

  const handlePurchase = async (item: ShopCatalogItem) => {
    setBusyItemCode(item.code);
    setFeedback(null);
    try {
      const result = await onPurchase(item.code, item.category === 'rep_theatre' ? selectedTheatre : null);
      if (result.ok) {
        setFeedback({ type: 'ok', message: `Acquisto completato. ${formatPurchaseEffect(item, result, selectedTheatre)}` });
      } else {
        setFeedback({ type: 'error', message: formatRejection(result) });
      }
    } finally {
      setBusyItemCode(null);
    }
  };

  return (
    <Screen contentClassName="px-6 pt-6 pb-8 space-y-5">
      <header className="space-y-2">
        <h2 className="text-white">Shop</h2>
        <p className="text-[#b8b2b3]">Spendi cachet per potenziamenti strategici.</p>
      </header>

      <BalanceCard cachet={cachet} />

      {feedback && <FeedbackCard feedback={feedback} />}

      {loading && (
        <Card><p className="text-[#b8b2b3] text-sm">Caricamento catalogo shop...</p></Card>
      )}

      {items.map(item => (
        <ShopItemCard
          key={item.code}
          item={item}
          cachet={cachet}
          extraActivitySlots={extraActivitySlots}
          canPurchase={canPurchase}
          busyItemCode={busyItemCode}
          selectedTheatre={selectedTheatre}
          theatreOptions={theatreOptions}
          onSelectTheatre={setSelectedTheatre}
          onPurchase={() => void handlePurchase(item)}
        />
      ))}

      {!items.length && !loading && (
        <Card className="border border-[#3d3a3b] bg-[#1a1617]">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-[#f4bf4f] flex-shrink-0" size={18} />
            <p className="text-sm text-[#b8b2b3]">Catalogo shop non disponibile al momento.</p>
          </div>
        </Card>
      )}
    </Screen>
  );
}

// === Sub-components ===

function BalanceCard({ cachet }: { cachet: number }) {
  return (
    <Card className="border border-[#2d2728] bg-gradient-to-br from-[#1a1617] to-[#241f20]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[#b8b2b3]">Saldo disponibile</p>
          <p className="text-2xl text-white font-semibold mt-1">{cachet} Cachet</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-[#241f20] border border-[#3d3a3b] flex items-center justify-center">
          <ShoppingBag className="text-[#f4bf4f]" size={22} />
        </div>
      </div>
    </Card>
  );
}

function FeedbackCard({ feedback }: { feedback: { type: 'ok' | 'error'; message: string } }) {
  return (
    <Card className={feedback.type === 'ok'
      ? 'border border-[#52c41a]/40 bg-[#1d2a1d]'
      : 'border border-[#a82847]/50 bg-[#2a1a1f]'
    }>
      <p className={feedback.type === 'ok' ? 'text-[#9be274]' : 'text-[#ff9aac]'}>{feedback.message}</p>
    </Card>
  );
}

function ShopItemCard({
  item, cachet, extraActivitySlots, canPurchase, busyItemCode,
  selectedTheatre, theatreOptions, onSelectTheatre, onPurchase,
}: {
  item: ShopCatalogItem;
  cachet: number;
  extraActivitySlots: number;
  canPurchase: boolean;
  busyItemCode: string | null;
  selectedTheatre: string;
  theatreOptions: TheatreOption[];
  onSelectTheatre: (theatre: string) => void;
  onPurchase: () => void;
}) {
  const categoryLabel = formatCategory(item.category);
  const maxReached = item.category === 'slot' && item.maxPurchasesPerUser != null && extraActivitySlots >= item.maxPurchasesPerUser;
  const insufficientCachet = cachet < item.costCachet;
  const theatreRequiredMissing = item.category === 'rep_theatre' && (!theatreOptions.length || !selectedTheatre);
  const disabled = !canPurchase || busyItemCode != null || maxReached || insufficientCachet || theatreRequiredMissing;

  return (
    <Card className="border border-white/5 bg-gradient-to-br from-[#1a1617] via-[#1d1819] to-[#221d1e]">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-white text-lg">{item.title}</h3>
            <p className="text-sm text-[#b8b2b3] mt-1">{item.description}</p>
          </div>
          {categoryLabel && <Badge variant="outline" size="sm">{categoryLabel}</Badge>}
        </div>

        <ItemMetaTags item={item} />

        {item.category === 'rep_theatre' && (
          <TheatreSelector
            theatreOptions={theatreOptions}
            selectedTheatre={selectedTheatre}
            onSelectTheatre={onSelectTheatre}
          />
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-[#7a7577]">
            {maxReached ? 'Limite acquisti raggiunto'
              : !canPurchase ? 'Acquisti temporaneamente disattivati'
              : insufficientCachet ? `Ti mancano ${item.costCachet - cachet} cachet`
              : theatreRequiredMissing ? 'Seleziona un teatro valido'
              : 'Disponibile'}
          </div>
          <Button variant="primary" size="sm" disabled={disabled} onClick={onPurchase}>
            Acquista
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ItemMetaTags({ item }: { item: ShopCatalogItem }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white/90">
        <Coins size={12} className="text-[#f4bf4f]" /> {item.costCachet} cachet
      </span>
      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white/90">
        <Sparkles size={12} className="text-[#f4bf4f]" /> +{item.effectValue}
      </span>
      {item.category === 'slot' && item.maxPurchasesPerUser != null && (
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white/90">
          max +{item.maxPurchasesPerUser} slot
        </span>
      )}
    </div>
  );
}

function TheatreSelector({
  theatreOptions, selectedTheatre, onSelectTheatre,
}: {
  theatreOptions: TheatreOption[];
  selectedTheatre: string;
  onSelectTheatre: (theatre: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-[#b8b2b3]">Teatro target</p>
      {theatreOptions.length ? (
        <select
          value={selectedTheatre}
          onChange={e => onSelectTheatre(e.target.value)}
          className="w-full rounded-xl border border-[#3d3a3b] bg-[#241f20] px-3 py-2 text-white outline-none focus:border-[#f4bf4f]"
        >
          {theatreOptions.map(o => (
            <option key={o.theatre} value={o.theatre}>{o.theatre} ({o.reputation}/100)</option>
          ))}
        </select>
      ) : (
        <div className="rounded-xl border border-[#a82847]/40 bg-[#2a1a1f] p-3 text-sm text-[#ff9aac]">
          Nessun teatro idoneo: devi registrare almeno un turno.
        </div>
      )}
    </div>
  );
}

// === Helpers ===

function formatCategory(category: ShopCatalogItem['category']) {
  if (category === 'rep_atcl') return 'Reputazione ATCL';
  if (category === 'rep_theatre') return 'Reputazione Teatro';
  return null;
}

function formatPurchaseEffect(item: ShopCatalogItem, result: ShopPurchaseResult, selectedTheatre: string) {
  if (item.category === 'slot') return `Slot extra ora disponibili: ${3 + result.extraSlotsAfter}`;
  if (item.category === 'rep_atcl') return `Reputazione ATCL aggiornata a ${result.reputationAfter}/100`;
  return `Pacchetto teatro applicato su ${result.theatre ?? selectedTheatre}`;
}

function formatRejection(result: ShopPurchaseResult) {
  if (result.rejectionReason === 'insufficient_cachet') return "Cachet insufficiente per completare l'acquisto.";
  if (result.rejectionReason === 'max_purchase_reached') return 'Hai raggiunto il limite massimo per questo elemento.';
  if (result.rejectionReason === 'theatre_not_eligible') return 'Puoi acquistare questo pack solo su teatri già giocati.';
  return result.error;
}
