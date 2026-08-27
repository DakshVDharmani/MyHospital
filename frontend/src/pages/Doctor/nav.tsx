import {
  Home,
  ShieldCheck,
  Users,
  Stethoscope,
  CalendarDays,
} from 'lucide-react';
import type { NavItem } from '../../components/DashboardLayout';

/** Single source of truth for the doctor sidebar. Pass the label of the
 * current page so exactly one item renders active. */
export function doctorNav(active: string): NavItem[] {
  return [
    { label: 'Home', icon: <Home size={16} />, to: '/doctor/home' },
    { label: 'Secure Chat', icon: <ShieldCheck size={16} />, to: '/doctor/chat' },
    { label: 'Managing Patients', icon: <Users size={16} />, to: '/doctor/patients' },
    { label: 'Consultation', icon: <Stethoscope size={16} />, to: '/doctor/consultation' },
    { label: 'Appointments', icon: <CalendarDays size={16} />, to: '/doctor/appointments' },
  ].map((i) => ({ ...i, active: i.label === active }));
}
