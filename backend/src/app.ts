import express from "express";
import { signup } from "./signup";
import { sessions } from "./session";

export const app = express();

app.use(express.json());
app.use("/api/auth", signup, sessions);

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});
