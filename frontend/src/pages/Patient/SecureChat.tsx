import { DashboardLayout } from '../../components/DashboardLayout';
import { SecureChatView } from '../../components/SecureChatView';
import { useProfile } from '../../lib/useProfile';
import { patientNav } from './nav';

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
      <SecureChatView />
    </DashboardLayout>
  );
}
