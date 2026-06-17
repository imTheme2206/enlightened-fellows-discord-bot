import { Elysia, t } from 'elysia'
import { GenshinCodeService } from '../../domains/genshin-codes/service'

export const genshinCodesRoutes = new Elysia()
  .get('/genshin-codes', () => GenshinCodeService.getAll(100))
  .post(
    '/genshin-codes',
    async ({ body }) => {
      await GenshinCodeService.save(body.code, false, false, body.rewards ?? undefined)
      return { ok: true }
    },
    { body: t.Object({ code: t.String(), rewards: t.Optional(t.String()) }) }
  )
