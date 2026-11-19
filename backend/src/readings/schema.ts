import { z } from "zod";

export const slotLabels = {
  morning_fasting: "Morning (fasting)",
  after_breakfast: "After breakfast",
  after_lunch: "After lunch",
  after_dinner: "After dinner",
} as const;

const patientDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const rangeMessage = "Enter a whole number between 40 and 600 mg/dl.";

export const readingSchema = z.object({
  reading_date: z.iso
    .date("Enter a valid date in YYYY-MM-DD format.")
    .refine((date) => !date.startsWith("0000"), "Enter a valid calendar year.")
    .refine(
      (date) => date <= patientDate.format(new Date()),
      "Date cannot be in the future.",
    ),
  slot: z.enum(
    Object.keys(slotLabels) as (keyof typeof slotLabels)[],
    "Select a valid time slot.",
  ),
  value_mg_dl: z
    .number({
      error: (issue) =>
        issue.input == null || issue.input === ""
          ? "Please enter a glucose value."
          : rangeMessage,
    })
    .int(rangeMessage)
    .min(40, rangeMessage)
    .max(600, rangeMessage),
});
