import { writeFileSync } from "node:fs"
import openapiTS, { astToString } from "openapi-typescript"

// Stub required env vars before the config module loads (it runs safeParse at import time)
process.env.DISCORD_TOKEN ??= "x"
process.env.DISCORD_CLIENT_ID ??= "x"
process.env.DATABASE_URL ??= "postgresql://x"
process.env.DIRECT_URL ??= "postgresql://x"

const { createApp } = await import("../src/api/app")

const app = createApp()
const res = await app.handle(new Request("http://localhost/openapi/json"))
const spec = await res.json()

const ast = await openapiTS(spec)
writeFileSync("src/api/openapi.d.ts", astToString(ast))

console.log("Generated src/api/openapi.d.ts")
