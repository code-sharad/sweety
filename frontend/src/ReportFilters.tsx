import { useId, useState } from "react";

const periods = [
  ["daily", "Daily"],
  ["month_to_date", "Month-to-date"],
  ["previous_month", "Last month"],
] as const;

export type ReportPeriod = (typeof periods)[number][0];

export function ReportDateInput({
  date,
  today,
  onChange,
}: {
  date: string;
  today: string;
  onChange: (date: string) => void;
}) {
  const errorId = useId();
  const [futureDate, setFutureDate] = useState(false);
  return (
    <div className="date-filter">
      <label>
        Selected date
        <input
          type="date"
          value={date}
          min="0001-01-01"
          max={today}
          aria-invalid={futureDate || undefined}
          aria-describedby={futureDate ? errorId : undefined}
          onChange={(e) => {
            const { validity, value } = e.currentTarget;
            setFutureDate(validity.rangeOverflow);
            if (validity.valid && value) onChange(value);
          }}
        />
      </label>
      {futureDate && (
        <small id={errorId} role="alert">
          Date cannot be in the future.
        </small>
      )}
    </div>
  );
}

export function ReportPeriodPicker({
  period,
  onChange,
}: {
  period: ReportPeriod;
  onChange: (period: ReportPeriod) => void;
}) {
  return (
    <div className="report-options" role="group" aria-label="Report period">
      {periods.map(([value, label]) => (
        <button
          key={value}
          aria-pressed={period === value}
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
