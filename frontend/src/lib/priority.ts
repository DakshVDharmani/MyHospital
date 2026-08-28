import { AlertOctagon, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { createElement, type ReactElement } from 'react';

// Fixed status palette — never themed, kept distinct from the app's teal/navy
// categorical colors so a priority badge never impersonates a brand color.
export type PriorityLevel = 'critical' | 'urgent' | 'moderate' | 'stable';

export const PRIORITY_META: Record<PriorityLevel, { label: string; color: string; bg: string; icon: (size?: number) => ReactElement }> = {
  critical: { label: 'Critical', color: '#d03b3b', bg: 'rgba(208, 59, 59, 0.12)', icon: (size = 12) => createElement(AlertOctagon, { size }) },
  urgent: { label: 'Urgent', color: '#ec835a', bg: 'rgba(236, 131, 90, 0.14)', icon: (size = 12) => createElement(AlertTriangle, { size }) },
  moderate: { label: 'Moderate', color: '#b8860b', bg: 'rgba(250, 178, 25, 0.18)', icon: (size = 12) => createElement(Clock, { size }) },
  stable: { label: 'Stable', color: '#0ca30c', bg: 'rgba(12, 163, 12, 0.12)', icon: (size = 12) => createElement(CheckCircle2, { size }) },
};

export const PRIORITY_ORDER: PriorityLevel[] = ['critical', 'urgent', 'moderate', 'stable'];
