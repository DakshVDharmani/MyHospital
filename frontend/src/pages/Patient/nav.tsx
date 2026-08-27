import {
  Home,
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  FolderClock,
  Sparkles,
} from 'lucide-react';
import type { NavItem } from '../../components/DashboardLayout';

/** Single source of truth for the patient sidebar. Pass the label of the
 * current page so exactly one item renders active. */
export function patientNav(active: string): NavItem[] {
  return [
    { label: 'Home', icon: <Home size={16} />, to: '/patient/home' },
    { label: 'Secure Chat', icon: <ShieldCheck size={16} />, to: '/patient/chat' },
    { label: 'Consultation', icon: <Stethoscope size={16} />, to: '/patient/consultation' },
    { label: 'Vitals', icon: <HeartPulse size={16} />, to: '/patient/vitals' },
    { label: 'Medical Records', icon: <FolderClock size={16} />, to: '/patient/records' },
    { label: 'XAI Help', icon: <Sparkles size={16} />, to: '/patient/xai' },
  ].map((i) => ({ ...i, active: i.label === active }));
}
