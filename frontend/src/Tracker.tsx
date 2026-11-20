import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError, message } from "./api";

import ReadingHistory from "./ReadingHistory";
import {
  ReportDateInput,
  ReportPeriodPicker,
  type ReportPeriod,
} from "./ReportFilters";
import ReportPage from "./ReportPage";
import ReportSharing from "./ReportSharing";
import {
  patientDayFormat,
  patientTimeZone,
  usePatientClock,
} from "./patientTime";
import { slots } from "./slots";
const reminderHour = 21;
const hourFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: patientTimeZone,
  hour: "2-digit",
  hourCycle: "h23",
});
type Reading = { id: number; slot: string; value_mg_dl: number };
export default function Tracker({ onExpired }: { onExpired: () => void }) {
  const now = usePatientClock();
  const today = patientDayFormat.format(now);
  const [date, setDate] = useState(today);
  const isToday = date === today;
  const hour = isToday ? Number(hourFormat.format(now)) : 24;
  const [period, setPeriod] = useState<ReportPeriod>("month_to_date");
  const [hash, setHash] = useState(() => location.hash);
  const [page] = hash.split("?");
  const reports = page === "#reports";
  const history = page === "#history";
  const sharing = page === "#share-reports";
  const [revision, refresh] = useState(0);
  useEffect(() => {
    const navigate = () => setHash(location.hash);
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  return (
    <>
      <nav className="journal-nav" aria-label="Journal">
        <a
          href="#logbook"
          aria-current={!reports && !history && !sharing ? "page" : undefined}
        >
          Logbook
        </a>
        <a href="#history" aria-current={history ? "page" : undefined}>
          History
        </a>
        <a href="#reports" aria-current={reports ? "page" : undefined}>
          Reports
        </a>
        <a href="#share-reports" aria-current={sharing ? "page" : undefined}>
          Share reports
        </a>
      </nav>
      <div className="heading">
        <div>
          <h1>
            {sharing
              ? "Share reports"
              : reports
                ? "Glucose reports"
                : history
                  ? "Reading history"
                  : "Daily logbook"}
          </h1>
        </div>
        {!history && !sharing && (
          <ReportDateInput date={date} today={today} onChange={setDate} />
        )}
      </div>
      {sharing ? (
        <ReportSharing onExpired={onExpired} />
      ) : history ? (
        <ReadingHistory key={revision} onExpired={onExpired} />
      ) : reports ? (
        <>
          <ReportPeriodPicker period={period} onChange={setPeriod} />
          <ReportPage
            key={date + period + ":" + revision}
            date={date}
            period={period}
            onExpired={onExpired}
          />
        </>
      ) : (
        <Day
          onSaved={() => refresh((n) => n + 1)}
          key={date + hash + revision}
          date={date}
          hour={hour}
          showReminder={isToday && hour >= reminderHour}
          onExpired={onExpired}
        />
      )}
    </>
  );
}
function Day({
  onSaved,
  date,
  hour,
  showReminder,
  onExpired,
}: {
  date: string;
  hour: number;
  showReminder: boolean;
  onSaved: () => void;
  onExpired: () => void;
}) {
  const [data, setData] = useState<Reading[] | null>(null);
  const missingReadings = slots.length - (data?.length ?? 0);
  const [revision, refresh] = useState(0);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const expired = useRef(onExpired);
  useEffect(() => {
    expired.current = onExpired;
  }, [onExpired]);
  useEffect(() => {
    let active = true;
    api<Reading[]>("readings?date=" + date)
      .then((rows) => {
        if (active) setData(rows);
      })
      .catch((e) => {
        if (active) {
          if (e instanceof ApiError && e.status === 401) expired.current();
          else setError(message(e));
        }
      });
    return () => {
      active = false;
    };
  }, [date, revision]);
  function reload() {
    setData(null);
    setError("");
    refresh((n) => n + 1);
  }
  async function save(
    event: FormEvent,
    slot: string,
    row?: Reading,
    remove = false,
  ) {
    event.preventDefault();
    if (remove && !window.confirm("Delete this reading?")) return;
    setBusy(true);
    setError("");
    try {
      await api(
        row ? "readings/" + row.id : "readings",
        remove ? "DELETE" : row ? "PATCH" : "POST",
        remove
          ? undefined
          : {
              slot,
              reading_date: date,
              value_mg_dl: value.trim() === "" ? null : Number(value),
            },
      );
      setEdit("");
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) expired.current();
      else setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <div role="alert">
          {error} {!data && <button onClick={reload}>Retry</button>}
        </div>
      )}
      {!data ? (
        !error && <p role="status">Loading readings…</p>
      ) : (
        <section className="sheet">
          <div className="sheethead">
            <h2>Readings</h2>
            <span>
              {data.length} of {slots.length} recorded
            </span>
          </div>
          {showReminder && missingReadings > 0 && (
            <p className="reading-reminder" role="status">
              {missingReadings === 1
                ? "You have 1 empty reading slot today."
                : `You have ${missingReadings} empty reading slots today.`}
            </p>
          )}
          {slots.map(([slot, label, opens]) => {
            const row = data.find((r) => r.slot === slot);
            return (
              <div className="slot" key={slot}>
                <div>
                  <strong>{label}</strong>
                  <small>
                    {row
                      ? "Recorded"
                      : hour < opens
                        ? "Opens at"
                        : "Open since"}
                    {!row && " " + String(opens).padStart(2, "0") + ":00 IST"}
                  </small>
                </div>
                {edit === slot ? (
                  <form className="editor" onSubmit={(e) => save(e, slot, row)}>
                    <label>
                      Value (mg/dl)
                      <input
                        autoFocus
                        type="number"
                        required
                        min="40"
                        max="600"
                        step="1"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                      />
                    </label>
                    <button className="primary" disabled={busy}>
                      Save
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setEdit("");
                        setError("");
                      }}
                    >
                      Cancel
                    </button>
                    {row && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => save(e, slot, row, true)}
                      >
                        Delete
                      </button>
                    )}
                  </form>
                ) : (
                  <div className="actions">
                    {row && (
                      <b>
                        {row.value_mg_dl} <small>mg/dl</small>
                      </b>
                    )}
                    <button
                      disabled={busy || hour < opens}
                      onClick={() => {
                        setEdit(slot);
                        setValue(row ? String(row.value_mg_dl) : "");
                        setError("");
                      }}
                    >
                      {row
                        ? "Edit"
                        : hour < opens
                          ? "Upcoming"
                          : "+ Add reading"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
