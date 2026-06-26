import { Elysia } from 'elysia'
import { runScraper } from '../../domains/set-search/scraper'

export const fetchArmorsRoutes = new Elysia({ tags: ['admin'] }).post('/fetch-armors', () => runScraper({ source: 'manual' }))
