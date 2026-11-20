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
  return (
    <label>
      Selected date
      <input
        type="date"
        value={date}
        min="0001-01-01"
        max={today}
        onChange={(e) => {
          const { validity, value } = e.currentTarget;
          if (validity.valid && value && value <= today) onChange(value);
        }}
      />
    </label>
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
