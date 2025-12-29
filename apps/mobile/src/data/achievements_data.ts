import { Award, MapPin, Theater } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type Achievement = {
  id: string;
  title: string;
  icon: LucideIcon;
  isNew?: boolean;
};

export const achievements: Achievement[] = [
  { id: '1', title: 'Ha lavorato in 3 teatri diversi', icon: MapPin, isNew: true },
  { id: '2', title: 'Prima stagione completata', icon: Award, isNew: false },
  { id: '3', title: '10 turni registrati', icon: Theater, isNew: false },
];
