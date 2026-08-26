import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import HealthcareAuthPage from "./pages/Healthcare/AuthPage";

function App() {
  return (
    <BrowserRouter>
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
