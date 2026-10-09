import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { AuthError, identity } from './features/identity/api'
import { AuthForm } from './features/identity/AuthForm'
import { rememberEmail, validPassword } from './features/identity/preferences'
vi.mock('./features/identity/api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./features/identity/api')>()
  return {
    ...actual,
    identity: {
      current: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    },
  }
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  localStorage.clear()
})
beforeEach(() => {
  history.replaceState(null, '', '/')
  vi.mocked(identity.current).mockRejectedValue(
    new AuthError(401, 'IDENTITY_INVALID_CREDENTIALS'),
  )
})
const session = {
  user: { id: 'abc', email: 'test@example.com' },
  expiresIn: 900,
}
function fill(password = 'Password123!') {
  fireEvent.change(screen.getByLabelText('E-mail'), {
    target: { value: 'test@example.com' },
  })
  fireEvent.change(screen.getByLabelText('Senha'), {
    target: { value: password },
  })
}
test('validates input before calling the API and focuses the invalid field', () => {
  render(<AuthForm register={false} onLogin={vi.fn()} onRegistered={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  expect(document.activeElement).toBe(screen.getByLabelText('E-mail'))
  expect(identity.login).not.toHaveBeenCalled()
})
test('prevents double submission while authentication is pending', async () => {
  let resolve!: (value: typeof session) => void
  vi.mocked(identity.login).mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  const onLogin = vi.fn()
  render(<AuthForm register={false} onLogin={onLogin} onRegistered={vi.fn()} />)
  fill()
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  fireEvent.submit(document.querySelector('form')!)
  expect(identity.login).toHaveBeenCalledTimes(1)
  resolve(session)
  await waitFor(() => expect(onLogin).toHaveBeenCalledWith(session))
  expect(localStorage.length).toBe(0)
})
test('removes saved email immediately when the checkbox is cleared', () => {
  rememberEmail('old@example.com', true)
  render(<AuthForm register={false} onLogin={vi.fn()} onRegistered={vi.fn()} />)
  fireEvent.click(screen.getByRole('checkbox'))
  expect(localStorage.length).toBe(0)
})
test('reuses registration key after an uncertain response without automatic retry', async () => {
  vi.mocked(identity.register).mockRejectedValue(new TypeError('network'))
  render(<AuthForm register onLogin={vi.fn()} onRegistered={vi.fn()} />)
  fill()
  fireEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }))
  await screen.findByRole('alert')
  const key = vi.mocked(identity.register).mock.calls[0][2]
  fill()
  fireEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }))
  await waitFor(() => expect(identity.register).toHaveBeenCalledTimes(2))
  expect(vi.mocked(identity.register).mock.calls[1][2]).toBe(key)
})
test('shows remaining attempts, clears password and keeps email', async () => {
  vi.mocked(identity.login).mockRejectedValue(
    new AuthError(401, 'IDENTITY_INVALID_CREDENTIALS', 2),
  )
  render(<AuthForm register={false} onLogin={vi.fn()} onRegistered={vi.fn()} />)
  fill()
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Restam 2 tentativas',
  )
  expect((screen.getByLabelText('Senha') as HTMLInputElement).value).toBe('')
})
test('does not report confirmed logout when revocation fails', async () => {
  vi.mocked(identity.current).mockResolvedValue(session)
  vi.mocked(identity.logout).mockRejectedValue(new Error('unavailable'))
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Sair da conta' }))
  expect((await screen.findByRole('status')).textContent).toContain(
    'Não foi possível confirmar a revogação',
  )
  expect(screen.queryByText(session.user.email)).toBeNull()
})
test('password validation preserves spaces instead of silently trimming', () => {
  expect(validPassword('Password123!')).toBe(true)
  expect(validPassword(' Password123!')).toBe(false)
  expect(validPassword('abcdefgh')).toBe(false)
  expect(validPassword('12345678')).toBe(false)
})
