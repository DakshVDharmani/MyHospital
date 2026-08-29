/** Normalizes a doctor's display name to exactly one "Dr." prefix, regardless
 * of whether the stored name already includes one (avoids "Dr. Dr. Jane"). */
export function displayDoctorName(rawName: string): string {
  const stripped = rawName.replace(/^dr\.?\s+/i, '').trim();
  return stripped ? `Dr. ${stripped}` : 'Dr.';
}

/** First name only, with any leading "Dr." prefix stripped first. */
export function firstNameOf(rawName: string): string {
  return rawName.replace(/^dr\.?\s+/i, '').trim().split(' ')[0] || '';
}
