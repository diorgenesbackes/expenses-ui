import { useEffect, useRef, useState } from 'react'
import { errorMessage, identity } from './api'
import type { Session } from './api'
import {
  rememberedEmail,
  rememberEmail,
  validEmail,
  validPassword,
} from './preferences'

type Props = {
  register: boolean
  onLogin: (session: Session) => void
  onRegistered: (email: string) => void
  initialEmail?: string
}
export function AuthForm({
  register,
  onLogin,
  onRegistered,
  initialEmail,
}: Props) {
  const [email, setEmail] = useState(initialEmail ?? rememberedEmail)
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(() => !!rememberedEmail())
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const busy = useRef(false)
  const operation = useRef<{ email: string; key: string } | null>(null)
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const errorPanel = useRef<HTMLDivElement>(null)
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current) return
    const normalized = email.trim().toLowerCase()
    if (!validEmail(normalized)) {
      setError('Informe um e-mail válido, com até 128 caracteres.')
      emailInput.current?.focus()
      return
    }
    if (!password || (register && !validPassword(password))) {
      setError(
        register
          ? 'Use de 8 a 256 caracteres, com letra e número, sem espaços.'
          : 'Informe sua senha.',
      )
      passwordInput.current?.focus()
      return
    }
    busy.current = true
    setPending(true)
    setError('')
    try {
      if (register) {
        if (operation.current?.email !== normalized)
          operation.current = { email: normalized, key: crypto.randomUUID() }
        await identity.register(normalized, password, operation.current.key)
        setPassword('')
        if (mounted.current) onRegistered(normalized)
      } else {
        const session = await identity.login(normalized, password)
        rememberEmail(normalized, remember)
        setPassword('')
        if (mounted.current) onLogin(session)
      }
    } catch (failure) {
      setError(errorMessage(failure))
      setPassword('')
      requestAnimationFrame(() => errorPanel.current?.focus())
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  return (
    <form onSubmit={submit} noValidate aria-busy={pending}>
      {error && (
        <div
          className="alert error"
          role="alert"
          tabIndex={-1}
          ref={errorPanel}
          id="form-error"
        >
          {error}
        </div>
      )}
      <fieldset disabled={pending}>
        <label htmlFor="email">E-mail</label>
        <input
          ref={emailInput}
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          maxLength={128}
          required
          value={email}
          placeholder="voce@exemplo.com"
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={error ? 'form-error' : undefined}
        />
        <label htmlFor="password">Senha</label>
        <div className="password-field">
          <input
            ref={passwordInput}
            id="password"
            name="password"
            type={visible ? 'text' : 'password'}
            autoComplete={register ? 'new-password' : 'current-password'}
            maxLength={256}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={
              register ? 'password-help' : error ? 'form-error' : undefined
            }
          />
          <button
            className="reveal"
            type="button"
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        {register ? (
          <p className="hint" id="password-help">
            De 8 a 256 caracteres, com letra e número, sem espaços.
          </p>
        ) : (
          <label className="check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => {
                setRemember(event.target.checked)
                if (!event.target.checked) rememberEmail('', false)
              }}
            />
            Lembrar meu e-mail
          </label>
        )}
        <button className="primary" type="submit">
          {pending ? 'Aguarde…' : register ? 'Criar minha conta' : 'Entrar'}
        </button>
      </fieldset>
    </form>
  )
}
