import { DashboardLayout } from '../../components/DashboardLayout';
import { SecureChatView, type ChatThread } from '../../components/SecureChatView';
import { useProfile } from '../../lib/useProfile';
import { patientNav } from './nav';

const THREADS: ChatThread[] = [
  {
    id: 't1', name: 'Dr. Anjali Rao', role: 'General Physician', last: 'Keep taking the prescribed dose.', time: '2h', unread: 1,
    messages: [
      { id: 1, from: 'them', text: 'Hi! Your latest blood work came back and everything looks stable.', time: '9:12 AM' },
      { id: 2, from: 'me', text: 'That is a relief. Should I continue the same medication?', time: '9:20 AM' },
      { id: 3, from: 'them', text: 'Yes — keep taking the prescribed dose and we will review again in a month.', time: '9:24 AM' },
    ],
  },
  {
    id: 't2', name: 'Care Coordinator', role: 'HealthForGood NGO', last: 'Fasting required before Friday.', time: '1d',
    messages: [
      { id: 1, from: 'them', text: 'Reminder: please fast for 10 hours before Friday’s blood test.', time: 'Yesterday' },
      { id: 2, from: 'me', text: 'Noted, thank you.', time: 'Yesterday' },
    ],
  },
  {
    id: 't3', name: 'Dr. Sam Okafor', role: 'Cardiology', last: 'See you at the follow-up.', time: '3d',
    messages: [
      { id: 1, from: 'them', text: 'Your ECG looked good. Let’s meet for the follow-up as planned.', time: 'Mon' },
    ],
  },
];

export default function PatientSecureChat() {
  const { name, loading } = useProfile();
  return (
    <DashboardLayout
      roleLabel="Patient"
      name={loading ? '…' : name}
      eyebrow="Patient Portal"
      pageTitle="Secure Chat"
      navItems={patientNav('Secure Chat')}
    >
      <SecureChatView threads={THREADS} />
    </DashboardLayout>
  );
}
