import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import Tracker from "./Tracker";

afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

it("lets a patient confirm a doctor and revoke report access", async () => {
  window.history.replaceState(null, "", "/#share-reports");
  const doctor = { id: 3, name: "Demo Doctor", email: "doctor@example.test" };
  const sharingPath = "/api/report-sharing";
  const grantPath = `${sharingPath}/${doctor.id}`;
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === sharingPath && init?.method === "GET")
        return Response.json([]);
      if (path === `${sharingPath}/lookup` && init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toEqual({ email: doctor.email });
        return Response.json(doctor);
      }
      if (path === grantPath && init?.method === "PUT")
        return Response.json(doctor);
      if (path === grantPath && init?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request ${init?.method} ${path}`);
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<Tracker onExpired={vi.fn()} />);

  expect(screen.getByRole("link", { name: "Share reports" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await user.type(
    await screen.findByRole("textbox", { name: "Doctor’s email" }),
    doctor.email,
  );
  await user.click(screen.getByRole("button", { name: "Find doctor" }));
  const confirmation = within(
    await screen.findByRole("region", { name: "Confirm report sharing" }),
  );
  expect(confirmation.getByText(doctor.name)).toBeVisible();
  expect(confirmation.getByText(doctor.email)).toBeVisible();
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
    false,
  );

  await user.click(
    confirmation.getByRole("button", { name: "Confirm sharing" }),
  );
  const shared = within(screen.getByRole("region", { name: "Shared with" }));
  expect(await shared.findByText(doctor.name)).toBeVisible();
  await user.click(shared.getByRole("button", { name: /revoke access/i }));
  expect(
    await shared.findByText(
      "You haven’t shared your reports with any doctors.",
    ),
  ).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Report access revoked for Demo Doctor.",
  );
});
