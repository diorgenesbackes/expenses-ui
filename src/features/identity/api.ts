export type Session = { user: { id: string; email: string }; expiresIn: number }
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
export class AuthError extends Error {
  status: number
  code: string
  remaining?: number
  retryAfter?: number
  constructor(
    status: number,
    code: string,
    remaining?: number,
    retryAfter?: number,
  ) {
    super(code)
    this.status = status
    this.code = code
    this.remaining = remaining
    this.retryAfter = retryAfter
  }
}

async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  headers?: Record<string, string>,
): Promise<unknown> {
  const response = await fetch(`/api/v1/identity/${path}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000),
  })
  if (response.status === 204) return null
  const value: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new AuthError(
      response.status,
      record(value) && typeof value.code === 'string'
        ? value.code
        : 'INVALID_RESPONSE',
      record(value) && typeof value.remainingAttempts === 'number'
        ? value.remainingAttempts
        : undefined,
      Number(response.headers.get('Retry-After')) || undefined,
    )
  }
  if (!record(value)) throw new AuthError(0, 'INVALID_RESPONSE')
  return value
}
function parseSession(value: unknown): Session {
  if (
    !record(value) ||
    !record(value.user) ||
    typeof value.user.id !== 'string' ||
    typeof value.user.email !== 'string' ||
    !record(value.session) ||
    value.session.authenticated !== true ||
    typeof value.session.accessTokenExpiresInSeconds !== 'number' ||
    !Number.isFinite(value.session.accessTokenExpiresInSeconds)
  ) {
    throw new AuthError(0, 'INVALID_RESPONSE')
  }
  return {
    user: { id: value.user.id, email: value.user.email },
    expiresIn: value.session.accessTokenExpiresInSeconds,
  }
}
// A single in-flight bootstrap prevents StrictMode and simultaneous consumers from racing CSRF cookies.
let csrf: Promise<string> | undefined
function csrfToken() {
  csrf ??= request('csrf')
    .then((value) => {
      if (!record(value) || typeof value.token !== 'string')
        throw new AuthError(0, 'INVALID_RESPONSE')
      return value.token
    })
    .catch((error) => {
      csrf = undefined
      throw error
    })
  return csrf
}
async function sessionRequest(path: string, method = 'GET', body?: unknown) {
  try {
    return await request(path, method, body, {
      'X-CSRF-Token': await csrfToken(),
    })
  } catch (error) {
    if (error instanceof AuthError && error.status === 403) csrf = undefined
    throw error // Never automatically repeat a write or a refresh.
  }
}
export const identity = {
  async current() {
    return parseSession(await sessionRequest('session/current'))
  },
  async login(email: string, password: string) {
    return parseSession(
      await sessionRequest('sessions', 'POST', { email, password }),
    )
  },
  async logout() {
    await sessionRequest('sessions/current', 'DELETE')
  },
  async register(email: string, password: string, key: string) {
    const value = await request(
      'users',
      'POST',
      { email, password },
      { 'Idempotency-Key': key },
    )
    if (
      !record(value) ||
      !record(value.user) ||
      typeof value.user.id !== 'string' ||
      typeof value.user.email !== 'string'
    ) {
      throw new AuthError(0, 'INVALID_RESPONSE')
    }
  },
}
export function errorMessage(error: unknown): string {
  if (!(error instanceof AuthError))
    return 'Não foi possível conectar. Confira sua conexão e tente novamente.'
  switch (error.code) {
    case 'IDENTITY_INVALID_CREDENTIALS':
      return (
        'E-mail ou senha incorretos.' +
        (error.remaining
          ? ` Restam ${error.remaining} tentativas antes do bloqueio temporário.`
          : '')
      )
    case 'IDENTITY_LOGIN_BLOCKED':
      return `Acesso temporariamente bloqueado para este e-mail. Tente novamente em ${Math.ceil((error.retryAfter ?? 900) / 60)} minutos.`
    case 'IDENTITY_USER_EXISTS':
      return 'Este e-mail já possui uma conta. Entre com sua senha.'
    case 'IDENTITY_PASSWORD_POLICY_VIOLATION':
      return 'A senha precisa ter de 8 a 256 caracteres, com letra e número, sem espaços.'
    case 'REQUEST_VALIDATION_FAILED':
      return 'Confira o e-mail e a senha informados.'
    case 'IDENTITY_OPERATION_IN_PROGRESS':
    case 'IDEMPOTENCY_REQUEST_IN_PROGRESS':
      return 'Uma solicitação ainda está em andamento. Aguarde um momento antes de tentar novamente.'
    case 'IDENTITY_RECONCILIATION_REQUIRED':
      return 'Não foi possível confirmar sua conta. Procure o suporte antes de fazer um novo cadastro.'
    case 'IDEMPOTENCY_KEY_EXPIRED':
    case 'IDEMPOTENCY_KEY_REUSED':
      return 'Não foi possível repetir este cadastro. Tente entrar ou procure o suporte.'
    case 'IDENTITY_CSRF_INVALID':
      return 'Não foi possível validar seu acesso seguro. Tente novamente ou recarregue a página.'
    default:
      return 'O serviço está indisponível no momento. Tente novamente mais tarde.'
  }
}
