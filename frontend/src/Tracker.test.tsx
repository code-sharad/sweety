import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { slots } from "./slots";
import Tracker from "./Tracker";

type Reading = { id: number; slot: string; value_mg_dl: number };
type Call = {
  method: string;
  path: string;
  body?: Record<string, unknown>;
};

const today = "2026-11-19";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function noContent() {
  return new Response(null, { status: 204 });
}

let calls: Call[];
let respond: (call: Call) => Response | Promise<Response>;

// A tiny in-memory version of the readings API so the form's refetches see
// the writes it just made.
function serve(readings: Reading[]) {
  respond = (call) => {
    if (call.method === "GET") return json(readings);
    if (call.method === "POST") {
      const reading = {
        id: 101,
        slot: call.body?.slot as string,
        value_mg_dl: call.body?.value_mg_dl as number,
      };
      readings.push(reading);
      return json(reading, 201);
    }
    const id = Number(call.path.split("/").pop());
    const index = readings.findIndex((reading) => reading.id === id);
    if (call.method === "PATCH") {
      const reading = { ...readings[index], ...call.body } as Reading;
      readings[index] = reading;
      return json(reading);
    }
    readings.splice(index, 1);
    return noContent();
  };
}

beforeEach(() => {
  calls = [];
  respond = () => json([]);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-19T10:00:00+05:30"));
  window.location.hash = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = {
        method: init?.method ?? "GET",
        path: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      };
      calls.push(call);
      return respond(call);
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderTracker() {
  const onExpired = vi.fn();
  const user = userEvent.setup();
  render(<Tracker onExpired={onExpired} />);
  return { user, onExpired };
}

describe("reading form", () => {
  it("adds a reading for an open slot and refreshes the day", async () => {
    serve([]);
    const { user } = renderTracker();
    await screen.findByRole("heading", { name: "Readings" });

    await user.click(
      screen.getAllByRole("button", { name: "+ Add reading" })[0],
    );

    const input = screen.getByLabelText("Value (mg/dl)");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("min", "40");
    expect(input).toHaveAttribute("max", "600");
    expect(input).toHaveAttribute("step", "1");

    await user.type(input, "95");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("1 of 4 recorded");
    expect(calls).toContainEqual({
      method: "POST",
      path: "/api/readings",
      body: {
        slot: "morning_fasting",
        reading_date: today,
        value_mg_dl: 95,
      },
    });
    expect(screen.getByText("95")).toBeInTheDocument();
    expect(screen.queryByLabelText("Value (mg/dl)")).not.toBeInTheDocument();
  });

  it("prefills and updates an existing reading with PATCH", async () => {
    serve([{ id: 7, slot: "morning_fasting", value_mg_dl: 130 }]);
    const { user } = renderTracker();
    await screen.findByText("1 of 4 recorded");

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByLabelText("Value (mg/dl)");
    expect(input).toHaveValue(130);

    await user.clear(input);
    await user.type(input, "145");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("145");
    expect(calls).toContainEqual({
      method: "PATCH",
      path: "/api/readings/7",
      body: {
        slot: "morning_fasting",
        reading_date: today,
        value_mg_dl: 145,
      },
    });
  });

  it("keeps the entered value and shows the API message when saving fails", async () => {
    serve([{ id: 7, slot: "morning_fasting", value_mg_dl: 130 }]);
    const { user } = renderTracker();
    await screen.findByText("1 of 4 recorded");

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByLabelText("Value (mg/dl)");
    await user.clear(input);
    await user.type(input, "150");

    respond = () =>
      json(
        {
          message:
            "A reading already exists for Morning (fasting) on 2026-11-19.",
        },
        409,
      );
    await user.click(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "A reading already exists for Morning (fasting) on 2026-11-19.",
    );
    expect(screen.getByLabelText("Value (mg/dl)")).toHaveValue(150);
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(calls.filter((call) => call.method === "PATCH")).toHaveLength(1);
  });

  it("does not save when the value is empty", async () => {
    serve([]);
    const { user } = renderTracker();
    await screen.findByRole("heading", { name: "Readings" });

    await user.click(
      screen.getAllByRole("button", { name: "+ Add reading" })[0],
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
    expect(screen.getByLabelText("Value (mg/dl)")).toBeInTheDocument();
  });

  it("closes the form without saving when cancelled", async () => {
    serve([]);
    const { user } = renderTracker();
    await screen.findByRole("heading", { name: "Readings" });

    await user.click(
      screen.getAllByRole("button", { name: "+ Add reading" })[0],
    );
    await user.type(screen.getByLabelText("Value (mg/dl)"), "95");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Value (mg/dl)")).not.toBeInTheDocument();
    expect(calls.filter((call) => call.method !== "GET")).toHaveLength(0);
  });

  it("deletes a reading only after confirmation", async () => {
    serve([{ id: 7, slot: "morning_fasting", value_mg_dl: 130 }]);
    const { user } = renderTracker();
    await screen.findByText("1 of 4 recorded");

    await user.click(screen.getByRole("button", { name: "Edit" }));

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(confirm).toHaveBeenCalledWith("Delete this reading?");
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
    expect(screen.getByLabelText("Value (mg/dl)")).toHaveValue(130);

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await screen.findByText("0 of 4 recorded");
    expect(calls).toContainEqual({
      method: "DELETE",
      path: "/api/readings/7",
      body: undefined,
    });
  });

  it("disables slots that have not opened yet today", async () => {
    serve([]);
    renderTracker();
    await screen.findByRole("heading", { name: "Readings" });

    const add = screen.getAllByRole("button", { name: "+ Add reading" });
    expect(add).toHaveLength(2);
    add.forEach((button) => expect(button).toBeEnabled());

    const upcoming = screen.getAllByRole("button", { name: "Upcoming" });
    expect(upcoming).toHaveLength(2);
    upcoming.forEach((button) => expect(button).toBeDisabled());

    expect(screen.getByText("Open since 00:00 IST")).toBeInTheDocument();
    expect(screen.getByText("Open since 08:00 IST")).toBeInTheDocument();
    expect(screen.getByText("Opens at 12:00 IST")).toBeInTheDocument();
    expect(screen.getByText("Opens at 19:00 IST")).toBeInTheDocument();
    expect(
      screen.queryByText(/empty reading slots today/),
    ).not.toBeInTheDocument();
  });

  it("reminds users after 9 p.m. IST until today's last slot is filled", async () => {
    vi.setSystemTime(new Date("2026-11-19T15:30:00Z"));
    serve(
      slots.slice(0, 3).map(([slot], i) => ({
        id: i + 1,
        slot,
        value_mg_dl: 100,
      })),
    );
    const { user } = renderTracker();
    const reminder = "You have 1 empty reading slot today.";
    expect(await screen.findByText(reminder)).toHaveAttribute("role", "status");

    const date = screen.getByLabelText("Selected date");
    fireEvent.change(date, { target: { value: "2026-11-18" } });
    await screen.findByText("3 of 4 recorded");
    expect(screen.queryByText(reminder)).not.toBeInTheDocument();

    fireEvent.change(date, { target: { value: today } });
    await screen.findByText(reminder);
    await user.click(screen.getByRole("button", { name: "+ Add reading" }));
    await user.type(screen.getByLabelText("Value (mg/dl)"), "110");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("4 of 4 recorded");
    expect(screen.queryByText(reminder)).not.toBeInTheDocument();
  });

  it("allows all four slots for a past date", async () => {
    serve([]);
    renderTracker();
    await screen.findByRole("heading", { name: "Readings" });

    fireEvent.change(screen.getByLabelText("Selected date"), {
      target: { value: "2026-11-18" },
    });

    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: "+ Add reading" }),
      ).toHaveLength(4),
    );
    expect(calls).toContainEqual({
      method: "GET",
      path: "/api/readings?date=2026-11-18",
      body: undefined,
    });
  });

  it("shows a load error and retries", async () => {
    let fail = true;
    respond = () =>
      fail ? json({ message: "Server exploded." }, 500) : json([]);
    const { user } = renderTracker();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Server exploded.")).toBeInTheDocument();

    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await screen.findByRole("heading", { name: "Readings" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(calls.filter((call) => call.method === "GET")).toHaveLength(2);
  });

  it("signals an expired session when the day cannot load", async () => {
    respond = () => json({ message: "Please sign in." }, 401);
    const { onExpired } = renderTracker();

    await waitFor(() => expect(onExpired).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
