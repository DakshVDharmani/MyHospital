// Pulls the actual number(s) out of a spoken/typed sentence, e.g.
// "My blood pressure is 144 over 82 today" -> { systolic: 144, diastolic: 82 }.
// Pure regex/local — no API call, no cost, instant. Each extractor only
// needs to handle the vital it was asked about (the check-in flow asks one
// question at a time), so there's no cross-vital ambiguity to resolve.

export type VitalKey = "bloodPressure" | "heartRate" | "temperature" | "spo2" | "glucose";

function numbersIn(text: string): number[] {
  return Array.from(text.matchAll(/\d+(?:\.\d+)?/g)).map((m) => parseFloat(m[0]));
}

function inRange(n: number, min: number, max: number): boolean {
  return n >= min && n <= max;
}

export function extractBloodPressure(text: string): { systolic: number; diastolic: number } | null {
  const paired = text.match(/(\d{2,3})\s*(?:\/|over|by|-)\s*(\d{2,3})/i);
  if (paired) {
    const systolic = parseInt(paired[1], 10);
    const diastolic = parseInt(paired[2], 10);
    if (inRange(systolic, 60, 260) && inRange(diastolic, 30, 160)) return { systolic, diastolic };
  }
  // Fallback: exactly two numbers said in the right ranges, in either order.
  const nums = numbersIn(text);
  if (nums.length === 2) {
    const [a, b] = nums;
    if (inRange(a, 60, 260) && inRange(b, 30, 160)) return { systolic: a, diastolic: b };
    if (inRange(b, 60, 260) && inRange(a, 30, 160)) return { systolic: b, diastolic: a };
  }
  return null;
}

export function extractHeartRate(text: string): number | null {
  const contextual = text.match(/(?:heart\s*rate|pulse|hr)\D{0,12}(\d{2,3})/i) || text.match(/(\d{2,3})\s*(?:bpm|beats?(?:\s*per\s*minute)?)/i);
  if (contextual) {
    const n = parseFloat(contextual[1]);
    if (inRange(n, 30, 240)) return n;
  }
  const nums = numbersIn(text).filter((n) => inRange(n, 30, 240));
  return nums.length === 1 ? nums[0] : null;
}

// Stored as Celsius; converts Fahrenheit answers automatically.
export function extractTemperature(text: string): number | null {
  const withUnit = text.match(/(\d{2,3}(?:\.\d+)?)\s*(?:°|degrees?)?\s*(f|fahrenheit|c|celsius)\b/i);
  if (withUnit) {
    const n = parseFloat(withUnit[1]);
    const isF = /f/i.test(withUnit[2]);
    const celsius = isF ? ((n - 32) * 5) / 9 : n;
    if (inRange(celsius, 30, 45)) return Math.round(celsius * 10) / 10;
  }
  const nums = numbersIn(text);
  if (nums.length === 1) {
    const n = nums[0];
    if (inRange(n, 34, 43)) return Math.round(n * 10) / 10; // already Celsius-range
    if (inRange(n, 93, 108)) return Math.round((((n - 32) * 5) / 9) * 10) / 10; // Fahrenheit-range
  }
  return null;
}

export function extractSpo2(text: string): number | null {
  const contextual = text.match(/(?:spo2|oxygen|saturation)\D{0,10}(\d{2,3})/i) || text.match(/(\d{2,3})\s*%/);
  if (contextual) {
    const n = parseFloat(contextual[1]);
    if (inRange(n, 50, 100)) return n;
  }
  const nums = numbersIn(text).filter((n) => inRange(n, 50, 100));
  return nums.length === 1 ? nums[0] : null;
}

export function extractGlucose(text: string): number | null {
  const contextual = text.match(/(?:sugar|glucose|glycemic)\D{0,10}(\d{2,3})/i) || text.match(/(\d{2,3})\s*(?:mg\s*\/?\s*dl)/i);
  if (contextual) {
    const n = parseFloat(contextual[1]);
    if (inRange(n, 30, 500)) return n;
  }
  const nums = numbersIn(text).filter((n) => inRange(n, 30, 500));
  return nums.length === 1 ? nums[0] : null;
}

export function extractVitalAnswer(key: VitalKey, text: string): number | { systolic: number; diastolic: number } | null {
  switch (key) {
    case "bloodPressure":
      return extractBloodPressure(text);
    case "heartRate":
      return extractHeartRate(text);
    case "temperature":
      return extractTemperature(text);
    case "spo2":
      return extractSpo2(text);
    case "glucose":
      return extractGlucose(text);
  }
}
