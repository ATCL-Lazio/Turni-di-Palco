export type ProgressMilestone = { id: string; label: string; target: number; flavor?: string };

export type ProgressState = {
  current: number;
  previousTarget: number;
  nextTarget: number;
  nextLabel: string;
  percent: number;
  remaining: number;
};

export const xpMilestones: ProgressMilestone[] = [
  { id: "debutto", label: "Debutto ATCL", target: 50, flavor: "Primi passi nel circuito" },
  { id: "tecnico-fidato", label: "Tecnico fidato", target: 150, flavor: "Reperibilita sul territorio" },
  { id: "caposquadra", label: "Caposquadra", target: 320, flavor: "Coordinamento troupe" },
  { id: "mentore", label: "Mentore", target: 520, flavor: "Supporto ai nuovi ingressi" },
];

export const repMilestones: ProgressMilestone[] = [
  { id: "voce-locale", label: "Voce locale", target: 8, flavor: "Riconoscimento dai teatri partner" },
  { id: "volto-circuito", label: "Volto del circuito", target: 18, flavor: "Referenze consolidate" },
  { id: "talent-scout", label: "Talent scout", target: 30, flavor: "Mentorship e passaparola" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getOrderedMilestones(milestones: ProgressMilestone[]) {
  return [...milestones].sort((a, b) => a.target - b.target);
}

export function getProgressState(current: number, milestones: ProgressMilestone[]): ProgressState {
  const ordered = getOrderedMilestones(milestones);
  const previous = ordered.filter((item) => current >= item.target).pop();
  const next = ordered.find((item) => current < item.target);
  const previousTarget = previous?.target ?? 0;
  const nextTarget = next?.target ?? previousTarget;
  const span = next ? nextTarget - previousTarget || 1 : current || 1;
  const progress = next ? current - previousTarget : span;
  const percent = next ? clamp(Math.round((progress / span) * 100), 0, 100) : 100;
  const remaining = next ? Math.max(0, nextTarget - current) : 0;
  return {
    current,
    previousTarget,
    nextTarget,
    nextLabel: next?.label ?? previous?.label ?? "Completato",
    percent,
    remaining,
  };
}

export function getEarnedMilestones(current: number, milestones: ProgressMilestone[]): ProgressMilestone[] {
  return getOrderedMilestones(milestones).filter((item) => current >= item.target);
}

export function buildProgressCopy(progress: ProgressState, unitLabel: string) {
  if (progress.remaining <= 0) {
    return `Hai sbloccato ${progress.nextLabel}.`;
  }
  return `Mancano ${progress.remaining} ${unitLabel} per ${progress.nextLabel}.`;
}
