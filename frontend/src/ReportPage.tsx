import { useEffect, useRef, useState } from "react";
import { api, ApiError, message } from "./api";
import { slots } from "./slots";
import MonthlyChart, { type Sample } from "./MonthlyChart";

type Report = {
  readings?: { slot: string; value_mg_dl: number }[];
  series?: Sample[];
  range: { start: string; end: string };
  summary: {
    count: number;
    highest: number | null;
    lowest: number | null;
    average: number | null;
  };
};
const rangeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
export default function ReportPage({
  date,
  period,
  onExpired,
}: {
  date: string;
  period: string;
  onExpired: () => void;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [attempt, retry] = useState(0);
  const expired = useRef(onExpired);
  useEffect(() => {
    expired.current = onExpired;
  }, [onExpired]);
  useEffect(() => {
    let active = true;
    api<Report>("reports?period=" + period + "&date=" + date)
      .then((result) => {
        if (active) setReport(result);
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401) expired.current();
        else setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [date, period, attempt]);
  if (error)
    return (
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
    );
  if (!report) return <p role="status">Loading report…</p>;
  const { summary, range, readings: rows } = report;
  return (
    <article aria-label="Glucose report" className="report-page">
      <header className="report-dateline">
        <h2>
          {rangeFormat.formatRange(
            new Date(range.start + "T00:00:00Z"),
            new Date(range.end + "T00:00:00Z"),
          )}
        </h2>
        <span>
          {summary.count} {summary.count === 1 ? "reading" : "readings"}
        </span>
      </header>
      {summary.count === 0 ? (
        <section className="empty-report">
          <h3>No readings for this period</h3>
          <p>Choose another period or open your logbook to add a reading.</p>
          <a href="#logbook">Open logbook →</a>
        </section>
      ) : (
        <div className="report-layout">
          <section className="report-summary">
            <h3>Average glucose</h3>
            <p className="mean">
              {summary.average?.toFixed(1)} <small>mg/dl</small>
            </p>
            <dl className="extremes">
              {(
                [
                  ["Lowest", summary.lowest],
                  ["Highest", summary.highest],
                ] as const
              ).map(([name, value]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>
                    {value?.toFixed(1)} <small>mg/dl</small>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <div className="report-figure">
            {" "}
            {report.series && (
              <MonthlyChart
                samples={report.series}
                end={range.end}
                slots={slots}
              />
            )}
            {rows && (
              <section className="daily-profile">
                <h3>
                  Readings by time of day <small>mg/dl</small>
                </h3>
                <dl>
                  {slots.map(([key, name]) => {
                    const reading = rows.find((row) => row.slot === key);
                    return (
                      <div key={key} className="profile-row">
                        <dt>{name}</dt>
                        <dd>
                          <span className="profile-track" aria-hidden="true">
                            {reading && (
                              <span
                                style={{
                                  width:
                                    (reading.value_mg_dl /
                                      Math.max(summary.highest ?? 0, 1)) *
                                      100 +
                                    "%",
                                }}
                              />
                            )}
                          </span>
                          {reading ? (
                            reading.value_mg_dl
                          ) : (
                            <abbr title="No reading" aria-label="No reading">
                              —
                            </abbr>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
