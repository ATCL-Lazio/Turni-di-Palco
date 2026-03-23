export const CIRCUIT_OPTIONS = [
  'TicketOne',
  'TICKETTANDO/18 MONTHS',
  'ciaotickets',
  'Liveticket',
  'archeoares (Tarquinia)',
  'easy Soft (Gaeta)',
  'ROCMA IT ADVISOR SRL. (Formia)',
] as const;

export type CircuitOption = typeof CIRCUIT_OPTIONS[number];

export const DEFAULT_CIRCUIT: CircuitOption = 'TicketOne';
