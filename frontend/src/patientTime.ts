import { useEffect, useState } from "react";

export const patientTimeZone = "Asia/Kolkata";

export const patientDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: patientTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function usePatientClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
