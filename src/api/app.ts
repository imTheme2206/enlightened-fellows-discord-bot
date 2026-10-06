import { Elysia } from "elysia"
import { authGuard } from "./middleware/auth-guard"
import { armorsRoutes } from "./routes/armors"
import { artianRulesRoutes } from "./routes/artian-rules"
import { buildsOwnerRoutes, buildsPublicRoutes } from "./routes/builds"
import { channelsRoutes } from "./routes/channels"
import { decorationsRoutes } from "./routes/decorations"
import { fetchArmorsRoutes } from "./routes/fetch-armors"
import { genshinCodesRoutes } from "./routes/genshin-codes"
import { jobLogsRoutes } from "./routes/job-logs"
import { monsterIconsRoutes } from "./routes/monster-icons"
import { monstersRoutes } from "./routes/monsters"
import { searchRoutes } from "./routes/search"
import { skillsRoutes } from "./routes/skills"
import { talismansRoutes } from "./routes/talismans"
import { weaponsRoutes } from "./routes/weapons"

export function createApp() {
  return (
    // NOTE: the @elysia/openapi plugin is temporarily removed. Its 2.0.0-beta.1
    // build is broken upstream (emits an unresolvable relative typebox import)
    // and 2.0.0-exp.1 sits on a different pre-release track to elysia itself.
    // Re-add once Elysia 2.0 and the plugin reach a matching stable release.
    // The per-route `tags` metadata below is retained for that future wiring.
    new Elysia()
      .get("/api/health", () => ({ ok: true }))
      .group("/api", (app) =>
        app
          .beforeHandle(authGuard)
          .use(jobLogsRoutes)
          .use(genshinCodesRoutes)
          .use(channelsRoutes)
          .use(fetchArmorsRoutes),
      )
      // Public MH Wilds catalog + search (no admin guard; talismans/builds self-authenticate).
      .group("/api/mh-wilds", (app) =>
        app
          .use(skillsRoutes)
          .use(armorsRoutes)
          .use(decorationsRoutes)
          .use(weaponsRoutes)
          .use(artianRulesRoutes)
          .use(monstersRoutes)
          .use(monsterIconsRoutes)
          .use(searchRoutes)
          .use(buildsPublicRoutes)
          .use(buildsOwnerRoutes),
      )
      .group("/api", (app) => app.use(talismansRoutes))
  )
}
