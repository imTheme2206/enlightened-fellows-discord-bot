import { Elysia } from "elysia";
import { JobLogService } from "./service";

export const jobLogsRoutes = new Elysia().get("/job-logs", () =>
  JobLogService.getRecent(50),
);
