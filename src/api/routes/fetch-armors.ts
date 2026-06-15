import { Elysia } from 'elysia'
import { runScraper } from '../../domains/set-search/scraper'

export const fetchArmorsRoutes = new Elysia().post('/fetch-armors', () => runScraper({ source: 'manual' }))
