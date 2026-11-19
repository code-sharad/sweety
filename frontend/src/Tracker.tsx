import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError, message } from "./api";

import MonthlyChart, { type Sample } from "./MonthlyChart";

const slots = [
  ["morning_fasting", "Morning (fasting)", 0],
  ["after_breakfast", "After breakfast", 8],
  ["after_lunch", "After lunch", 12],
  ["after_dinner", "After dinner", 19],
] as const;
const periods = [
  ["daily", "Daily"],
  ["month_to_date", "Month-to-date"],
  ["previous_month", "Monthly"],
] as const;
const zone = "Asia/Kolkata";
const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: zone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const hourFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: zone,
  hour: "2-digit",
  hourCycle: "h23",
});
type Reading = { id: number; slot: string; value_mg_dl: number };
type Report = {
  series?: Sample[];
  range: { start: string; end: string };
  summary: {
    count: number;
    highest: number | null;
    lowest: number | null;
    average: number | null;
  };
};
export default function Tracker({ onExpired }: { onExpired: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const today = dayFormat.format(now);
  const [date, setDate] = useState(today);
  const [period, setPeriod] = useState(0);
  return (
    <>
      <div className="heading">
        <div>
          <span className="eyebrow">Blood glucose journal</span>
          <h1>Daily logbook</h1>
        </div>
        <label>
          Selected date
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => {
              if (e.target.value && e.target.value <= today)
                setDate(e.target.value);
            }}
          />
        </label>
      </div>
      <Day
        period={period}
        setPeriod={setPeriod}
        key={date}
        date={date}
        hour={date === today ? Number(hourFormat.format(now)) : 24}
        onExpired={onExpired}
      />
    </>
  );
}
function Day({
  period,
  setPeriod,
  date,
  hour,
  onExpired,
}: {
  date: string;
  hour: number;
  period: number;
  setPeriod: (period: number) => void;
  onExpired: () => void;
}) {
  const [data, setData] = useState<{
    rows: Reading[];
    reports: Report[];
  } | null>(null);
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
    Promise.all([
      api<Reading[]>("readings?date=" + date),
      Promise.all(
        periods.map(([p]) =>
          api<Report>("reports?period=" + p + "&date=" + date),
        ),
      ),
    ])
      .then(([rows, reports]) => {
        if (active) setData({ rows, reports });
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
      reload();
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
        <>
          <section className="sheet">
            <div className="sheethead">
              <h2>Readings</h2>
              <span>{data.rows.length} of 4 recorded</span>
            </div>
            {slots.map(([slot, label, opens]) => {
              const row = data.rows.find((r) => r.slot === slot);
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
                    <form
                      className="editor"
                      onSubmit={(e) => save(e, slot, row)}
                    >
                      <label>
                        Value (mg/dl)
                        <input
                          autoFocus
                          type="number"
                          step="any"
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
          <h2 className="reports-title">Glucose reports</h2>
          <div
            className="report-options"
            role="group"
            aria-label="Report period"
          >
            {periods.map(([key, label], i) => (
              <button
                key={key}
                aria-pressed={period === i}
                onClick={() => setPeriod(i)}
              >
                {label}
              </button>
            ))}
          </div>
          <ReportDetails
            report={data.reports[period]}
            label={periods[period][1]}
            rows={period === 0 ? data.rows : undefined}
          />
        </>
      )}
    </>
  );
}

const rangeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
function ReportDetails({
  report,
  label,
  rows,
}: {
  report: Report;
  label: string;
  rows?: Reading[];
}) {
  const { range, summary } = report;
  const start = new Date(range.start + "T00:00:00Z"),
    end = new Date(range.end + "T00:00:00Z");
  return (
    <article className="report-panel" aria-label={label + " report"}>
      <h3>{label} report</h3>
      <p>{rangeFormat.formatRange(start, end)}</p>
      {summary.count === 0 ? (
        <p className="empty-report">
          No readings recorded for this period. Select another date or add a
          reading to your logbook.
        </p>
      ) : (
        <>
          <dl className="report-stats">
            <div>
              <dt>Highest</dt>
              <dd>
                {summary.highest?.toFixed(1)} <small>mg/dl</small>
              </dd>
            </div>
            <div>
              <dt>Lowest</dt>
              <dd>
                {summary.lowest?.toFixed(1)} <small>mg/dl</small>
              </dd>
            </div>
            <div>
              <dt>Average</dt>
              <dd>
                {summary.average?.toFixed(1)} <small>mg/dl</small>
              </dd>
            </div>
            <div>
              <dt>Readings</dt>
              <dd>{summary.count}</dd>
            </div>
          </dl>
          {report.series && (
            <MonthlyChart
              samples={report.series}
              end={range.end}
              slots={slots}
            />
          )}
          {rows && (
            <ul aria-label="Daily readings">
              {rows.map((row) => (
                <li key={row.id}>
                  {slots.find(([key]) => key === row.slot)?.[1]} ·{" "}
                  {row.value_mg_dl} mg/dl
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </article>
  );
}
