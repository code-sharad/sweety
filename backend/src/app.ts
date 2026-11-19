import express from "express";
import { signup } from "./signup";

export const app = express();

app.use(express.json());
app.use("/api/auth", signup);

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});
