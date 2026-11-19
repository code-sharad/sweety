import { useState } from "react";
import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";

export type Sample = { date: string; slot: string; value_mg_dl: number };

export default function MonthlyChart({
  samples,
  end,
  slots,
}: {
  samples: Sample[];
  end: string;
  slots: readonly (readonly [string, string, number])[];
}) {
  const [choice, setChoice] = useState("");
  const slot =
    choice || slots.find(([key]) => samples.some((s) => s.slot === key))?.[0];
  const readings = samples.filter((s) => s.slot === slot);
  const lastDay = Number(end.slice(-2));
  const byDay = new Map(readings.map((s) => [Number(s.date.slice(-2)), s]));
  const days = Array.from({ length: lastDay }, (_, i) => i + 1);
  const x = scaleLinear({ domain: [1, lastDay], range: [45, 550] });
  const values = readings.map((s) => s.value_mg_dl);
  const low = Math.floor(Math.min(...values) / 10) * 10;
  const high = Math.max(low + 10, Math.ceil(Math.max(...values) / 10) * 10);
  const y = scaleLinear({ domain: [low, high], range: [152, 18], nice: true });
  return (
    <section className="monthly-chart">
      <div className="chart-heading">
        <h3>
          Glucose over time <small>mg/dl</small>
        </h3>
        <label>
          Time slot
          <select value={slot} onChange={(e) => setChoice(e.target.value)}>
            {slots.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {readings.length === 0 ? (
        <p>No readings for this time slot.</p>
      ) : (
        <>
          <svg
            viewBox="0 0 575 198"
            role="img"
            aria-label={`Glucose readings in mg/dl by day for ${slots.find(([key]) => key === slot)?.[1]}`}
          >
            {y.ticks(4).map((v) => (
              <g key={v}>
                <line
                  x1={45}
                  x2={550}
                  y1={y(v)}
                  y2={y(v)}
                  stroke="var(--rule)"
                />
                <text x={37} y={y(v) + 4} textAnchor="end">
                  {v}
                </text>
              </g>
            ))}
            {days
              .filter(
                (d) =>
                  d === 1 || d === lastDay || (d % 5 === 0 && lastDay - d > 1),
              )
              .map((d) => (
                <text key={d} x={x(d)} y={171} textAnchor="middle">
                  {d}
                </text>
              ))}
            <text x={298} y={193} textAnchor="middle">
              Day of month
            </text>
            <LinePath
              data={days}
              defined={(d) => byDay.has(d)}
              x={(d) => x(d)}
              y={(d) => y(byDay.get(d)!.value_mg_dl)}
              stroke="var(--accent)"
              strokeWidth={2}
            />
            {readings.map((s) => (
              <circle
                key={s.date}
                cx={x(Number(s.date.slice(-2)))}
                cy={y(s.value_mg_dl)}
                r={3.5}
                fill="var(--accent)"
              >
                <title>
                  {s.date} · {s.value_mg_dl} mg/dl
                </title>
              </circle>
            ))}
          </svg>
          <details>
            <summary>View readings in mg/dl</summary>
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Glucose (mg/dl)</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((s) => (
                  <tr key={s.date}>
                    <td>{s.date}</td>
                    <td>{s.value_mg_dl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}
