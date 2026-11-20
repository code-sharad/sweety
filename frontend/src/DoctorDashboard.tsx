import { useEffect, useState } from "react";
import { api, ApiError, message, type User } from "./api";
import { patientDayFormat, usePatientClock } from "./patientTime";
import {
  ReportDateInput,
  ReportPeriodPicker,
  type ReportPeriod,
} from "./ReportFilters";
import ReportPage from "./ReportPage";

type AssignedPatient = Pick<User, "id" | "name" | "email">;

export default function DoctorDashboard({
  onExpired,
}: {
  onExpired: () => void;
}) {
  const today = patientDayFormat.format(usePatientClock());
  const [date, setDate] = useState(today);
  const [period, setPeriod] = useState<ReportPeriod>("month_to_date");
  const [patients, setPatients] = useState<AssignedPatient[] | null>(null);
  const [selectedId, setSelectedId] = useState<number>();
  const [error, setError] = useState("");
  const [attempt, retry] = useState(0);

  useEffect(() => {
    let active = true;
    api<AssignedPatient[]>("doctor/patients")
      .then((result) => {
        if (active) setPatients(result);
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401) onExpired();
        else setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [attempt, onExpired]);

  const patient =
    patients?.find(({ id }) => id === selectedId) ?? patients?.[0];
  return (
    <>
      <div className="heading">
        <h1>Patient reports</h1>
        {patient && (
          <ReportDateInput date={date} today={today} onChange={setDate} />
        )}
      </div>
      {error ? (
        <div role="alert">
          {error}{" "}
          <button
            onClick={() => {
              setError("");
              retry((n) => n + 1);
            }}
          >
            Retry
          </button>
        </div>
      ) : !patients ? (
        <p role="status">Loading assigned patients…</p>
      ) : patient ? (
        <>
          <label className="patient-picker">
            Assigned patient
            <select
              value={patient.id}
              onChange={(e) => setSelectedId(Number(e.currentTarget.value))}
            >
              {patients.map(({ id, name, email }) => (
                <option key={id} value={id}>
                  {name} ({email})
                </option>
              ))}
            </select>
          </label>
          <ReportPeriodPicker period={period} onChange={setPeriod} />
          <ReportPage
            key={`${patient.id}:${date}:${period}`}
            patientId={patient.id}
            date={date}
            period={period}
            onExpired={onExpired}
          />
        </>
      ) : (
        <p>No patients are assigned to your account.</p>
      )}
    </>
  );
}
