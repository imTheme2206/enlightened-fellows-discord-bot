import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { staticPlugin } from "@elysiajs/static";
import path from "path";
import fs from "fs";
import { config } from "./config";
import logger from "./config/logger";
import { jobLogsRoutes } from "./modules/job-logs/routes";
import { genshinCodesRoutes } from "./modules/genshin-codes/routes";
import { channelsRoutes } from "./modules/channels/routes";

function authGuard({
  request,
  set,
}: {
  request: Request;
  set: { status?: number | string };
}) {
  const { WEB_ADMIN_TOKEN } = config;
  if (!WEB_ADMIN_TOKEN) return;

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (token !== WEB_ADMIN_TOKEN) {
    set.status = 401;
    return { error: "Unauthorized" };
  }
}

export async function startServer(): Promise<void> {
  const dashboardDist = path.join(process.cwd(), "dashboard", "dist");
  const indexPath = path.join(dashboardDist, "index.html");

  const app = new Elysia({ adapter: node() })
    .use(
      fs.existsSync(dashboardDist)
        ? staticPlugin({ assets: dashboardDist, prefix: "/" })
        : new Elysia()
    )
    .group("/api", (app) =>
      app
        .onBeforeHandle(authGuard)
        .get("/health", () => ({ ok: true }))
        .use(jobLogsRoutes)
        .use(genshinCodesRoutes)
        .use(channelsRoutes)
    )
    .get("/*", ({ set }) => {
      if (fs.existsSync(indexPath)) {
        set.headers = { "content-type": "text/html; charset=utf-8" };
        return fs.readFileSync(indexPath, "utf-8");
      }
      set.status = 404;
      return { error: "Dashboard not built" };
    });

  app.listen(config.WEB_PORT);
  logger.info(`Web server listening on port ${config.WEB_PORT}`);
}
