import { Award, Calendar, MapPin, Theater } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type Achievement = {
  id: string;
  title: string;
  icon: LucideIcon;
  isNew?: boolean;
};

export const achievements: Achievement[] = [
  { id: 'first_turn', title: 'Primo sipario', icon: Award, isNew: true },
  { id: 'turns_this_month_3', title: 'Ritmo di scena', icon: Calendar, isNew: true },
  { id: 'unique_theatres_3', title: 'Teatri in tour', icon: MapPin, isNew: true },
  { id: 'total_turns_10', title: 'Presenza costante', icon: Theater, isNew: false },
  { id: 'turns_this_month_6', title: 'Settimana piena', icon: Calendar, isNew: false },
  { id: 'unique_theatres_5', title: 'Compagnia itinerante', icon: MapPin, isNew: false },
  { id: 'total_turns_25', title: 'Veterano di palco', icon: Award, isNew: false },
  { id: 'unique_theatres_8', title: 'Mappa completa', icon: MapPin, isNew: false },
];
