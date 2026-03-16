import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Calendar, CalendarPlus, Clock, MapPin, Navigation } from 'lucide-react';
import { EventPlanning, GameEvent, Role, RoleId } from '../../state/store';

type EventDetailsProps = {
  event?: GameEvent;
  roles: Role[];
  currentRoleId: RoleId;
  planning: EventPlanning | null;
  onBack: () => void;
  onNavigate: () => void;
  onSavePlanning: (eventId: string, roleId: RoleId) => Promise<void>;
  onClearPlanning: (eventId: string) => Promise<void>;
};

export function EventDetails({
  event,
  roles,
  currentRoleId,
  planning,
  onBack,
  onNavigate,
  onSavePlanning,
  onClearPlanning,
}: EventDetailsProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<RoleId>(planning?.roleId ?? currentRoleId);
  const [isSavingPlanning, setIsSavingPlanning] = useState(false);
  const [isClearingPlanning, setIsClearingPlanning] = useState(false);

  useEffect(() => {
    setSelectedRoleId(planning?.roleId ?? currentRoleId);
  }, [currentRoleId, planning?.roleId, event?.id]);

  const selectedRoleName = useMemo(
    () => roles.find((role) => role.id === selectedRoleId)?.name ?? selectedRoleId,
    [roles, selectedRoleId]
  );
  const savedRoleName = useMemo(() => {
    if (!planning) return null;
    return roles.find((role) => role.id === planning.roleId)?.name ?? planning.roleId;
  }, [planning, roles]);

  if (!event) {
    return (
      <div className="min-h-screen">
        <div className="app-content px-6 space-y-6 pt-6">
          <div>
            <h2 className="text-white mb-2">Dettagli evento</h2>
            <p className="text-[#b8b2b3]">Nessun evento disponibile.</p>
          </div>
          <Button variant="ghost" size="lg" fullWidth onClick={onBack}>
            Torna indietro
          </Button>
        </div>
      </div>
    );
  }

  const handleAddToCalendar = () => {
    if (typeof window === 'undefined') return;
    const startDate = parseEventDateTime(event.date, event.time);
    if (!startDate) {
      window.alert('Impossibile generare il calendario per questo evento.');
      return;
    }
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    const formatDate = (value: Date) =>
      value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Turni di Palco//Event//IT',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${event.id}@turni-di-palco`,
      `SUMMARY:${sanitizeIcsText(event.name)}`,
      `LOCATION:${sanitizeIcsText(event.theatre)}`,
      `DTSTART:${formatDate(startDate)}`,
      `DTEND:${formatDate(endDate)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ];
    const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${event.name.replace(/[\\/:*?"<>|]+/g, '')}.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleSavePlanning = async () => {
    setIsSavingPlanning(true);
    try {
      await onSavePlanning(event.id, selectedRoleId);
    } finally {
      setIsSavingPlanning(false);
    }
  };

  const handleClearPlanning = async () => {
    setIsClearingPlanning(true);
    try {
      await onClearPlanning(event.id);
    } finally {
      setIsClearingPlanning(false);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="app-content px-6 space-y-6 pt-6">
        <div>
          <h2 className="text-white mb-2">Dettagli evento</h2>
          <p className="text-[#b8b2b3]">Informazioni sull'evento selezionato</p>
        </div>

        <Card>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-white text-lg leading-tight">{event.name}</h3>
              {event.genre ? <Badge variant="default" size="sm">{event.genre}</Badge> : null}
            </div>
            <div className="flex items-center gap-3 text-[#b8b2b3]">
              <MapPin size={18} className="text-[#f4bf4f]" />
              <span>{event.theatre}</span>
            </div>
            <div className="flex items-center gap-3 text-[#b8b2b3]">
              <Calendar size={18} className="text-[#f4bf4f]" />
              <span>{event.date}</span>
            </div>
            <div className="flex items-center gap-3 text-[#b8b2b3]">
              <Clock size={18} className="text-[#f4bf4f]" />
              <span>{event.time}</span>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20]">
          <h4 className="text-[#f4bf4f] mb-4">Ricompense base</h4>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-white text-lg">+{event.baseRewards.xp}</p>
              <p className="text-xs text-[#b8b2b3]">XP</p>
            </div>
            <div>
              <p className="text-white text-lg">+{event.baseRewards.reputation}</p>
              <p className="text-xs text-[#b8b2b3]">Reputazione</p>
            </div>
            <div>
              <p className="text-white text-lg">+{event.baseRewards.cachet}</p>
              <p className="text-xs text-[#b8b2b3]">Cachet</p>
            </div>
          </div>
        </Card>

        <Card className="border border-[#f4bf4f]/10 bg-[#151112]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-white">Pianificazione partecipazione</h4>
              <p className="text-sm text-[#b8b2b3] mt-1">
                Salva il ruolo che intendi coprire per questo evento e mantieni lo stato visibile nella lista.
              </p>
            </div>
            <span
              className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-medium ${
                planning
                  ? 'border-[#f4bf4f]/40 bg-[#f4bf4f]/10 text-[#f4bf4f]'
                  : 'border-white/10 bg-white/5 text-[#b8b2b3]'
              }`}
            >
              {planning ? 'Pianificato' : 'Da pianificare'}
            </span>
          </div>

          <div className="mt-5 space-y-3">
            <label className="block text-sm text-[#b8b2b3]" htmlFor="event-role-select">
              Ruolo previsto
            </label>
            <Select
              value={selectedRoleId}
              onValueChange={(value) => setSelectedRoleId(value as RoleId)}
            >
              <SelectTrigger
                id="event-role-select"
                className="w-full border-[#2d2728] bg-[#241f20] text-white"
              >
                <SelectValue placeholder="Scegli un ruolo" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-[#b8b2b3]">
              {planning
                ? `Stato attuale: pianificato come ${savedRoleName}.`
                : 'Nessuna pianificazione salvata per questo evento.'}
            </p>
            {planning && planning.roleId !== selectedRoleId ? (
              <p className="text-sm text-[#f4bf4f]">
                Modifica pronta da salvare: {selectedRoleName}.
              </p>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => void handleSavePlanning()}
              disabled={isSavingPlanning}
            >
              {planning ? 'Aggiorna pianificazione' : 'Salva pianificazione'}
            </Button>
            {planning ? (
              <Button
                variant="ghost"
                size="md"
                onClick={() => void handleClearPlanning()}
                disabled={isClearingPlanning}
              >
                Cancella pianificazione
              </Button>
            ) : null}
          </div>
        </Card>

        <div className="space-y-3">
          <Button variant="primary" size="lg" fullWidth onClick={handleAddToCalendar}>
            <CalendarPlus size={16} />
            Aggiungi al calendario
          </Button>
          <Button variant="secondary" size="lg" fullWidth onClick={onNavigate}>
            <Navigation size={16} className="text-white" />
            Naviga
          </Button>
          <Button variant="ghost" size="lg" fullWidth onClick={onBack}>
            Torna indietro
          </Button>
        </div>
      </div>
    </div>
  );
}

function parseEventDateTime(dateValue: string, timeValue: string) {
  if (!dateValue) return null;
  const timeMatch =
    timeValue?.match(/(\d{1,2}):(\d{2})/) ?? dateValue.match(/(\d{1,2}):(\d{2})/);
  const safeHours = timeMatch ? Number(timeMatch[1]) : 0;
  const safeMinutes = timeMatch ? Number(timeMatch[2]) : 0;

  const isoCandidate = timeValue ? `${dateValue}T${timeValue}` : dateValue;
  let parsed = new Date(isoCandidate);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const normalized = dateValue
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const matchIso = normalized.match(/(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (matchIso) {
    return new Date(
      Number(matchIso[1]),
      Number(matchIso[2]) - 1,
      Number(matchIso[3]),
      safeHours,
      safeMinutes,
      0,
      0
    );
  }

  const matchNumeric = normalized.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (matchNumeric) {
    return new Date(
      Number(matchNumeric[3]),
      Number(matchNumeric[2]) - 1,
      Number(matchNumeric[1]),
      safeHours,
      safeMinutes,
      0,
      0
    );
  }

  const matchName = normalized.match(/(\d{1,2})\s+([a-z]{3,})\s+(\d{4})/);
  if (!matchName) return null;

  const day = Number(matchName[1]);
  const monthToken = matchName[2];
  const year = Number(matchName[3]);
  const month = MONTHS[monthToken] ?? null;
  if (month == null) return null;

  return new Date(year, month, day, safeHours, safeMinutes, 0, 0);
}

function sanitizeIcsText(value: string) {
  return value.replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');
}

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  gen: 0,
  gennaio: 0,
  feb: 1,
  february: 1,
  febbraio: 1,
  mar: 2,
  march: 2,
  marzo: 2,
  apr: 3,
  april: 3,
  aprile: 3,
  may: 4,
  mag: 4,
  maggio: 4,
  jun: 5,
  june: 5,
  giu: 5,
  giugno: 5,
  jul: 6,
  july: 6,
  lug: 6,
  luglio: 6,
  aug: 7,
  august: 7,
  ago: 7,
  agosto: 7,
  sep: 8,
  sept: 8,
  september: 8,
  set: 8,
  sett: 8,
  settembre: 8,
  oct: 9,
  october: 9,
  ott: 9,
  ottobre: 9,
  nov: 10,
  november: 10,
  novembre: 10,
  dec: 11,
  december: 11,
  dic: 11,
  dicembre: 11,
};
