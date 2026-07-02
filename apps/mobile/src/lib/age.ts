// Age gate per la registrazione (GDPR Art. 8 + tutela minori).
//
// In Italia l'età del consenso digitale è 14 anni (D.Lgs. 101/2018): sotto i 14
// il trattamento richiede il consenso di chi esercita la responsabilità
// genitoriale. Turni di Palco è pensato per un pubblico 14+, quindi al signup
// verifichiamo l'età dichiarata e blocchiamo gli under-14.
//
// Scelta di minimizzazione dei dati: la data di nascita serve solo a calcolare
// l'età al momento della registrazione e NON viene persistita.

export const MIN_SIGNUP_AGE = 14;
export const ADULT_AGE = 18;

/**
 * Calcola l'età in anni compiuti a partire da una data di nascita `YYYY-MM-DD`.
 * Ritorna `null` se la data è vuota, non valida o nel futuro.
 * `now` è iniettabile per rendere il calcolo deterministico nei test.
 */
export function computeAge(birthDate: string, now: Date = new Date()): number | null {
  if (!birthDate) return null;
  // Parse esplicito di YYYY-MM-DD a mezzanotte locale per evitare shift di fuso.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dob = new Date(year, month - 1, day);
  // Rifiuta date "rimbalzate" (es. 31/02) e date non reali.
  if (
    dob.getFullYear() !== year ||
    dob.getMonth() !== month - 1 ||
    dob.getDate() !== day
  ) {
    return null;
  }
  if (dob.getTime() > now.getTime()) return null;

  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

/** True se la data di nascita corrisponde ad almeno `MIN_SIGNUP_AGE` anni compiuti. */
export function meetsMinAge(birthDate: string, now: Date = new Date()): boolean {
  const age = computeAge(birthDate, now);
  return age !== null && age >= MIN_SIGNUP_AGE;
}

/**
 * True se l'utente è minorenne (età < 18) in base alla data di nascita.
 * Usato per applicare tutele aggiuntive (es. classifica pubblica opt-in).
 * Una data non valida è prudenzialmente trattata come minorenne (true).
 */
export function isMinor(birthDate: string, now: Date = new Date()): boolean {
  const age = computeAge(birthDate, now);
  return age === null || age < ADULT_AGE;
}
