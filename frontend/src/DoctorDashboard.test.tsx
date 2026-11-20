import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";

afterEach(() => vi.unstubAllGlobals());

it("shows doctors assigned patients and switches the read-only report", async () => {
  const patients = [
    { id: 1, name: "Alice", email: "alice@example.test" },
    { id: 2, name: "Bob", email: "bob@example.test" },
  ];
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path === "/api/auth/me") {
      return Response.json({
        id: 3,
        name: "Doctor",
        email: "doctor@example.test",
        role: "doctor",
      });
    }
    if (path === "/api/doctor/patients") return Response.json(patients);
    const match = path.match(
      /^\/api\/doctor\/patients\/([12])\/reports\?period=(month_to_date|daily)&date=(\d{4}-\d{2}-\d{2})$/,
    );
    if (!match) throw new Error(`Unexpected request ${path}`);

    const [, id, period, date] = match;
    const value = id === "1" ? 101 : period === "daily" ? 189 : 185;
    return Response.json({
      range: { start: date, end: date },
      summary: { count: 1, average: value, lowest: value, highest: value },
    });
  });
  vi.stubGlobal("fetch", fetchMock);

  const user = userEvent.setup();
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: "Patient reports" }),
  ).toBeVisible();
  const picker = await screen.findByRole("combobox", {
    name: "Assigned patient",
  });
  const report = () =>
    within(screen.getByRole("article", { name: "Glucose report" }));
  await screen.findByRole("article", { name: "Glucose report" });
  expect(report().getAllByText("101.0")).toHaveLength(3);
  expect(
    screen.queryByRole("link", { name: "Logbook" }),
  ).not.toBeInTheDocument();

  await user.selectOptions(picker, "2");
  await screen.findByRole("article", { name: "Glucose report" });
  expect(report().queryByText("101.0")).not.toBeInTheDocument();
  expect(report().getAllByText("185.0")).toHaveLength(3);
  await user.click(screen.getByRole("button", { name: "Daily" }));
  await screen.findByRole("article", { name: "Glucose report" });
  expect(report().getAllByText("189.0")).toHaveLength(3);
});
