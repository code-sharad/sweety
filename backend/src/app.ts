import express from "express";
import { authRouter } from "./auth/routes";
import { readingsRouter } from "./readings/routes";
import { reportsRouter } from "./reports/routes";

export const app = express();

app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/readings", readingsRouter);
app.use("/api/reports", reportsRouter);

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});
