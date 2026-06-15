import { config } from '../../infra/config'

/**
 * Bearer-token guard for `/api/*`. If `WEB_ADMIN_TOKEN` is unset the API is open.
 */
export function authGuard({ request, set }: { request: Request; set: { status?: number | string } }) {
  const { WEB_ADMIN_TOKEN } = config
  if (!WEB_ADMIN_TOKEN) return

  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (token !== WEB_ADMIN_TOKEN) {
    set.status = 401
    return { error: 'Unauthorized' }
  }
}
