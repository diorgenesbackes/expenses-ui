import { afterEach, beforeEach, expect, test, vi } from 'vitest'
const fetchMock = vi.fn()
beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})
afterEach(() => vi.unstubAllGlobals())
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
test('CSRF remains in memory and is attached to the session request with cookies', async () => {
  fetchMock
    .mockResolvedValueOnce(json({ token: 'synthetic-csrf' }))
    .mockResolvedValueOnce(
      json({
        user: { id: 'id', email: 'a@example.test' },
        session: { authenticated: true, accessTokenExpiresInSeconds: 10 },
      }),
    )
  const { identity } = await import('./api')
  const session = await identity.login('a@example.test', 'synthetic-password')
  expect(session.user.email).toBe('a@example.test')
  expect(fetchMock.mock.calls[1][1]).toMatchObject({
    credentials: 'same-origin',
    headers: { 'X-CSRF-Token': 'synthetic-csrf' },
  })
  expect(localStorage.length).toBe(0)
})
test('rejects successful responses with an invalid session shape', async () => {
  fetchMock
    .mockResolvedValueOnce(json({ token: 'synthetic-csrf' }))
    .mockResolvedValueOnce(json({ user: { email: 'a@example.test' } }))
  const { identity } = await import('./api')
  await expect(identity.current()).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})
test('does not automatically retry failed writes', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('offline'))
  const { identity } = await import('./api')
  await expect(
    identity.register('a@example.test', 'Password123!', 'key'),
  ).rejects.toThrow()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
test('accepts a bodyless logout and preserves retry-after for blocked login', async () => {
  fetchMock
    .mockResolvedValueOnce(json({ token: 'synthetic-csrf' }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
  const { identity, errorMessage } = await import('./api')
  await expect(identity.logout()).resolves.toBeUndefined()
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ code: 'IDENTITY_LOGIN_BLOCKED' }), {
      status: 423,
      headers: { 'Retry-After': '120' },
    }),
  )
  try {
    await identity.login('a@example.test', 'Password123!')
    expect.unreachable()
  } catch (error) {
    expect(errorMessage(error)).toContain('2 minutos')
  }
})
