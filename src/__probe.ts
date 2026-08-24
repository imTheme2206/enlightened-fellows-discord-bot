import { startServer } from './api'
startServer().then(() => process.exit(0)).catch((e) => { console.error('RAW:', e); process.exit(1) })
