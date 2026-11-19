import { z } from "zod";

export const registrationSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  password: z
    .string()
    .min(1, "Enter a password.")
    .refine(
      (password) => Buffer.byteLength(password) <= 72,
      "Use a password of 72 bytes or fewer.",
    ),
});

export const loginSchema = registrationSchema.pick({
  email: true,
  password: true,
});
