import { z } from "zod";

export const slotLabels = {
  morning_fasting: "Morning (fasting)",
  after_breakfast: "After breakfast",
  after_lunch: "After lunch",
  after_dinner: "After dinner",
} as const;

export const patientTimeZone = "Asia/Kolkata";
export const patientDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: patientTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const rangeMessage = "Enter a whole number between 40 and 600 mg/dl.";

export const calendarDate = z.iso
  .date("Enter a valid date in YYYY-MM-DD format.")
  .refine((date) => !date.startsWith("0000"), "Enter a valid calendar year.");

export const readingFilterSchema = z.object({ date: calendarDate.optional() });

export const readingSchema = z.object({
  reading_date: calendarDate.refine(
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

// Local opening hours in Asia/Kolkata. Slots stay open for late entries.
const openingHours = {
  morning_fasting: 0,
  after_breakfast: 8,
  after_lunch: 12,
  after_dinner: 19,
} satisfies Record<keyof typeof slotLabels, number>;

const patientHour = new Intl.DateTimeFormat("en-GB", {
  timeZone: patientTimeZone,
  hour: "2-digit",
  hourCycle: "h23",
});

export const scheduledReadingSchema = readingSchema.superRefine(
  (reading, ctx) => {
    const now = new Date();
    const opening = openingHours[reading.slot];
    if (
      reading.reading_date === patientDate.format(now) &&
      Number(patientHour.format(now)) < opening
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["slot"],
        message: `${slotLabels[reading.slot]} opens at ${String(opening).padStart(2, "0")}:00 IST.`,
      });
    }
  },
);

export const readingUpdateSchema = readingSchema
  .partial()
  .refine(
    (fields) => Object.keys(fields).length > 0,
    "Supply at least one reading field to update.",
  );

export const readingIdSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().positive().max(2147483647));
