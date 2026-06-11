import { Elysia } from 'elysia'
import { GenshinCodeService } from './service'

export const genshinCodesRoutes = new Elysia().get('/genshin-codes', () => GenshinCodeService.getAll(100))
