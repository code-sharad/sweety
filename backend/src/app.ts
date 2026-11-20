import "dotenv/config";
import express from "express";
import { authRouter } from "./auth/routes";
import { doctorRouter } from "./doctor/routes";
import { readingsRouter } from "./readings/routes";
import { reportSharingRouter } from "./reports/sharing";
import { reportsRouter } from "./reports/routes";

export const app = express();

app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/doctor", doctorRouter);
app.use("/api/readings", readingsRouter);
app.use("/api/report-sharing", reportSharingRouter);
app.use("/api/reports", reportsRouter);

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

if (process.env.STATIC_DIR) {
  app.use(express.static(process.env.STATIC_DIR));
}

export default app;
