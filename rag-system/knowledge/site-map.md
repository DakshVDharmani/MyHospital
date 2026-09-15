# MyHospital website knowledge 

MyHospital is a hospital collaboration website with separate patient and doctor experiences. The floating voice widget is available throughout the React application and can answer questions by voice.

## Public pages

- `/` is the animated landing page introducing MyHospital.
- `/login` and `/signup` open the healthcare authentication experience.

## Patient pages

- `/patient/home` is the patient's dashboard and overview.
- `/patient/appointments` lets a patient view and manage appointments.
- `/patient/chat` is secure messaging with healthcare staff.
- `/patient/vitals` records and displays health measurements and supports a guided voice check-in.
- `/patient/records` shows medical records.
- `/patient/xai` explains model decisions and confidence in patient-friendly terms.
- `/patient/call/:appointmentId` opens the video consultation for an appointment.

## Doctor pages

- `/doctor/home` is the doctor's dashboard.
- `/doctor/appointments` shows the doctor's appointment schedule.
- `/doctor/patients` lets a doctor manage patients and consultation information.
- `/doctor/chat` is secure messaging with patients.
- `/doctor/call/:appointmentId` opens the appointment's video consultation.

## Voice assistant flow

The frontend records speech and sends audio to speech-to-text. The question goes to `/api/chat`, which retrieves MyHospital knowledge from Pinecone and gives that context to Sarvam. The answer is converted to voice through `/api/tts`. The assistant explains navigation and behavior; it must not invent features, claim it completed actions, expose secrets, or treat documentation as medical advice.
