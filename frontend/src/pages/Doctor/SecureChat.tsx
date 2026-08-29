import { DashboardLayout } from '../../components/DashboardLayout';
import { SecureChatView } from '../../components/SecureChatView';
import { useProfile } from '../../lib/useProfile';
import { doctorNav } from './nav';

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
      <SecureChatView />
    </DashboardLayout>
  );
}
