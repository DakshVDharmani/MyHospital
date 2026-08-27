import { DashboardLayout } from '../../components/DashboardLayout';
import { SecureChatView, type ChatThread } from '../../components/SecureChatView';
import { useProfile } from '../../lib/useProfile';
import { doctorNav } from './nav';

const THREADS: ChatThread[] = [
  {
    id: 't1', name: 'Ravi Kumar', role: 'Patient · Chest pain follow-up', last: 'The pain has gotten worse.', time: '4m', unread: 2,
    messages: [
      { id: 1, from: 'them', text: 'Doctor, the chest tightness came back this morning.', time: '8:41 AM' },
      { id: 2, from: 'them', text: 'The pain has gotten worse since I messaged earlier.', time: '9:02 AM' },
      { id: 3, from: 'me', text: 'Thank you for letting me know. Please come to the clinic now — I am flagging you as priority.', time: '9:04 AM' },
    ],
  },
  {
    id: 't2', name: 'Fatima Sheikh', role: 'Patient · Fever, dehydration', last: 'Temperature is down to 99.', time: '25m',
    messages: [
      { id: 1, from: 'them', text: 'Temperature is down to 99 after the fluids.', time: '8:30 AM' },
      { id: 2, from: 'me', text: 'Good. Keep hydrating and send me a reading tonight.', time: '8:36 AM' },
    ],
  },
  {
    id: 't3', name: 'Care Coordinator', role: 'HealthForGood NGO', last: 'Lab results ready for Fatima.', time: '1h',
    messages: [
      { id: 1, from: 'them', text: 'Lab results are ready for Fatima Sheikh — uploaded to her record.', time: '7:55 AM' },
    ],
  },
  {
    id: 't4', name: 'Dr. Meera Nair', role: 'Colleague · Dermatology', last: 'Can you take a referral?', time: '3h',
    messages: [
      { id: 1, from: 'them', text: 'Can you take a referral for a rash-with-fever case this afternoon?', time: '6:20 AM' },
    ],
  },
];

export default function DoctorSecureChat() {
  const { name, loading } = useProfile();
  return (
    <DashboardLayout
      roleLabel="Doctor"
      name={loading ? '…' : `Dr. ${name}`}
      eyebrow="Clinician Portal"
      pageTitle="Secure Chat"
      navItems={doctorNav('Secure Chat')}
    >
      <SecureChatView threads={THREADS} />
    </DashboardLayout>
  );
}
