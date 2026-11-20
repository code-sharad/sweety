import { useEffect, useRef, useState } from "react";
import { api, ApiError, message } from "./api";
import { slots } from "./slots";

type HistoryPage = {
  rows: {
    id: number;
    reading_date: string;
    slot: string;
    value_mg_dl: number;
  }[];
  hasNext: boolean;
};
const formatDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default function ReadingHistory({
  onExpired,
}: {
  onExpired: () => void;
}) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HistoryPage | null>(null);
  const [error, setError] = useState("");
  const [attempt, retry] = useState(0);
  const expired = useRef(onExpired);
  useEffect(() => {
    expired.current = onExpired;
  }, [onExpired]);
  useEffect(() => {
    let active = true;
    api<HistoryPage>(`readings?page=${page}&limit=20`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401) expired.current();
        else setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [page, attempt]);
  function changePage(next: number) {
    setData(null);
    setError("");
    setPage(next);
  }
  return (
    <section className="history">
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
      ) : !data ? (
        <p role="status">Loading readings…</p>
      ) : data.rows.length ? (
        <table>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Time of day</th>
              <th scope="col">
                Glucose <small>(mg/dl)</small>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <time dateTime={row.reading_date}>
                    {formatDate.format(
                      new Date(row.reading_date + "T00:00:00Z"),
                    )}
                  </time>
                </td>
                <td>{slots.find(([key]) => key === row.slot)?.[1]}</td>
                <td>{row.value_mg_dl}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="empty-report">
          <h2>{page === 1 ? "No readings yet" : "No more readings"}</h2>
          {page === 1 && <a href="#logbook">Add your first reading →</a>}
        </div>
      )}
      {(page > 1 || data?.hasNext) && (
        <nav aria-label="Reading history pages">
          <button disabled={page === 1} onClick={() => changePage(page - 1)}>
            Previous
          </button>
          <span aria-live="polite">Page {page}</span>
          <button
            disabled={!data?.hasNext}
            onClick={() => changePage(page + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
