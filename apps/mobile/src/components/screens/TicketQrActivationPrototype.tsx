import React, { useMemo, useState } from 'react';
import { ArrowLeft, Database, QrCode } from 'lucide-react';
import { Screen } from '../ui/Screen';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  activateTicketHash,
  generateTicketQr,
  listLocalTicketRecords,
  parseTicketQrValue,
  type GeneratedTicket,
} from '../../services/ticket-activation';

interface TicketQrActivationPrototypeProps {
  userId: string;
  onBack: () => void;
}

export function TicketQrActivationPrototype({ userId, onBack }: TicketQrActivationPrototypeProps) {
  const [circuit, setCircuit] = useState('TicketOne');
  const [eventName, setEventName] = useState('Esempio');
  const [eventID, setEventID] = useState('1234567890');
  const [ticketNumber, setTicketNumber] = useState('1234567890');
  const [date, setDate] = useState('2026-02-11T11:54:00+01:00');
  const [generated, setGenerated] = useState<GeneratedTicket | null>(null);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const records = useMemo(() => listLocalTicketRecords(), [generated, scanMessage]);

  const handleGenerate = async () => {
    setBusy(true);
    setGenerateMessage(null);

    try {
      const result = await generateTicketQr({
        circuit,
        eventName,
        eventID,
        ticketNumber,
        date,
      });
      setGenerated(result);
      setScanInput(result.qrValue);
      setGenerateMessage(
        result.persistedRemotely
          ? 'QR registrato su Supabase e cache locale.'
          : 'QR generato in locale (fallback prototipo).'
      );
    } catch (error) {
      setGenerateMessage(error instanceof Error ? error.message : 'Errore durante la generazione.');
    } finally {
      setBusy(false);
    }
  };

  const handleActivate = async () => {
    const hash = parseTicketQrValue(scanInput);
    if (!hash) {
      setScanMessage('Payload QR non valido. Formato atteso: hash SHA-256 (64 caratteri).');
      return;
    }

    const shouldProceed = window.confirm('Confermi l\'attivazione del ticket per questo account?');
    if (!shouldProceed) return;

    setBusy(true);
    const result = await activateTicketHash(hash, userId);
    setScanMessage(result.ok ? 'Ticket attivato correttamente.' : result.error);
    setBusy(false);
  };

  return (
    <Screen
      withBottomNavPadding={false}
      className="app-gradient justify-start"
      contentClassName="max-w-3xl space-y-6"
    >
      <div className="flex items-center justify-between rounded-2xl border border-[#2d2728] bg-[#1a1617] px-4 py-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-[#f4bf4f] hover:text-[#e6a23c]"
        >
          <ArrowLeft size={18} />
          Indietro
        </button>
        <p className="text-xs text-[#b8b2b3]">Prototipo mobile ticket office + attivazione</p>
      </div>

      <section className="rounded-2xl border border-[#2d2728] bg-[#1a1617] p-4 space-y-4">
        <div className="flex items-center gap-2 text-white">
          <QrCode size={18} className="text-[#f4bf4f]" />
          <h3 className="text-base !m-0">1) Generazione payload e hash QR</h3>
        </div>
        <p className="text-sm text-[#b8b2b3]">
          Struttura JSON richiesta: circuit, eventName, eventID, ticketNumber, date.
        </p>
        <div className="grid grid-cols-1 gap-3">
          <Input value={circuit} onChange={(event) => setCircuit(event.target.value)} placeholder="Circuito (es. TicketOne)" />
          <Input value={eventName} onChange={(event) => setEventName(event.target.value)} placeholder="Nome evento" />
          <Input value={eventID} onChange={(event) => setEventID(event.target.value)} placeholder="ID evento" />
          <Input value={ticketNumber} onChange={(event) => setTicketNumber(event.target.value)} placeholder="Numero biglietto" />
          <Input value={date} onChange={(event) => setDate(event.target.value)} placeholder="Data ISO (es. 2026-02-11T11:54:00+01:00)" />
        </div>

        <Button variant="primary" onClick={handleGenerate} disabled={busy}>
          Genera QR ticket
        </Button>

        {generateMessage ? <p className="text-sm text-[#b8b2b3]">{generateMessage}</p> : null}

        {generated ? (
          <div className="rounded-xl border border-[#2d2728] bg-[#0f0d0e] p-3 text-xs text-[#d9d4d5] space-y-2">
            <p className="!m-0"><strong>QR value (hash):</strong> {generated.qrValue}</p>
            <p className="!m-0 break-all"><strong>Hash SHA-256:</strong> {generated.hash}</p>
            <p className="!m-0 break-all"><strong>JSON:</strong> {generated.json}</p>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[#2d2728] bg-[#1a1617] p-4 space-y-4">
        <h3 className="text-base text-white !m-0">2) Scansione e attivazione one-shot</h3>
          <Input
            value={scanInput}
            onChange={(event) => setScanInput(event.target.value)}
            placeholder="Incolla hash o valore QR"
          />
        <Button variant="secondary" onClick={handleActivate} disabled={busy}>
          Verifica e attiva
        </Button>
        {scanMessage ? <p className="text-sm text-[#b8b2b3]">{scanMessage}</p> : null}
      </section>

      <section className="rounded-2xl border border-[#2d2728] bg-[#1a1617] p-4 space-y-3">
        <div className="flex items-center gap-2 text-white">
          <Database size={18} className="text-[#f4bf4f]" />
          <h3 className="text-base !m-0">Stato archivio locale prototipo</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-[#d9d4d5]">
            <thead>
              <tr className="text-[#b8b2b3]">
                <th className="pb-2">Hash</th>
                <th className="pb-2">Ticket</th>
                <th className="pb-2">Stato</th>
                <th className="pb-2">Utente</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-2 text-[#7f797a]">Nessun ticket generato.</td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.hash} className="border-t border-[#2d2728]">
                    <td className="py-2 pr-2">{record.hash.slice(0, 12)}…</td>
                    <td className="py-2 pr-2">{record.ticketNumber}</td>
                    <td className="py-2 pr-2">{record.status}</td>
                    <td className="py-2">{record.activatedBy ?? '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </Screen>
  );
}
