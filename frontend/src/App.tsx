import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/Landing/LandingPage";
import HealthcareAuthPage from "./pages/Healthcare/AuthPage";
import PatientHome from "./pages/Patient/PatientHome";
import PatientSecureChat from "./pages/Patient/SecureChat";
import PatientAppointments from "./pages/Patient/Appointments";
import PatientVitals from "./pages/Patient/Vitals";
import PatientMedicalRecords from "./pages/Patient/MedicalRecords";
import PatientXaiHelp from "./pages/Patient/XaiHelp";
import DoctorHome from "./pages/Doctor/DoctorHome";
import DoctorSecureChat from "./pages/Doctor/SecureChat";
import DoctorManagingPatients from "./pages/Doctor/ManagingPatients";
import DoctorAppointments from "./pages/Doctor/Appointments";
import VideoCall from "./pages/shared/VideoCall";
import ConsultationRecordPage from "./pages/shared/ConsultationRecord";
import { VoiceWidget } from "./voice-widget/VoiceWidget";
import { RouteTransition } from "./components/RouteTransition";

function App() {
  return (
    <BrowserRouter>
      <RouteTransition>
      <VoiceWidget backendUrl={import.meta.env.VITE_VOICE_BACKEND_URL} />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<HealthcareAuthPage />} />
        <Route path="/signup" element={<HealthcareAuthPage />} />

        <Route path="/patient/home" element={<PatientHome />} />
        <Route path="/patient/chat" element={<PatientSecureChat />} />
        <Route path="/patient/appointments" element={<PatientAppointments />} />
        <Route path="/patient/vitals" element={<PatientVitals />} />
        <Route path="/patient/call/:appointmentId" element={<VideoCall />} />
        <Route path="/patient/records" element={<PatientMedicalRecords />} />
        <Route path="/patient/xai" element={<PatientXaiHelp />} />

        <Route path="/doctor/home" element={<DoctorHome />} />
        <Route path="/doctor/chat" element={<DoctorSecureChat />} />
        <Route path="/doctor/patients" element={<DoctorManagingPatients />} />
        <Route path="/doctor/appointments" element={<DoctorAppointments />} />
        <Route path="/doctor/call/:appointmentId" element={<VideoCall />} />

        <Route path="/consultation/:recordId" element={<ConsultationRecordPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </RouteTransition>
    </BrowserRouter>
  );
}

export default App;
