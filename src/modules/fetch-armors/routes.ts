import { Elysia } from "elysia";
import { runScraper } from "../../services/scraper-service";

export const fetchArmorsRoutes = new Elysia().post("/fetch-armors", () =>
  runScraper({ source: "manual" }),
);
