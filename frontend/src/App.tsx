import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import HealthcareAuthPage from "./pages/Healthcare/AuthPage";
import { VoiceWidget } from "./voice-widget/VoiceWidget";

function App() {
  return (
    <BrowserRouter>
      <VoiceWidget backendUrl={import.meta.env.VITE_VOICE_BACKEND_URL} />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<HealthcareAuthPage />} />
        <Route path="/signup" element={<HealthcareAuthPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
