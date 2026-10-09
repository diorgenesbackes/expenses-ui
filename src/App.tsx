import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthError, errorMessage, identity } from './features/identity/api'
import type { Session } from './features/identity/api'
import { AuthForm } from './features/identity/AuthForm'
import './App.css'

export default function App() {
  const [register, setRegister] = useState(location.pathname === '/cadastro')
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [notice, setNotice] = useState('')
  const [email, setEmail] = useState('')
  const [leaving, setLeaving] = useState(false)
  const version = useRef(0)
  const checkingRef = useRef(false)
  const channel = useRef<BroadcastChannel | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const navigate = useCallback((signup: boolean) => {
    history.pushState(null, '', signup ? '/cadastro' : '/login')
    setRegister(signup)
    setNotice('')
    requestAnimationFrame(() => heading.current?.focus())
  }, [])
  const check = useCallback(async () => {
    if (checkingRef.current) return
    checkingRef.current = true
    const requestVersion = version.current
    try {
      const result = await identity.current()
      if (version.current === requestVersion) {
        setSession(result)
        setNotice('')
      }
    } catch (error) {
      if (version.current !== requestVersion) return
      if (error instanceof AuthError && error.status === 409)
        setNotice(errorMessage(error))
      else {
        setSession(null)
        setNotice(
          error instanceof AuthError && error.status === 401
            ? ''
            : errorMessage(error),
        )
      }
    } finally {
      checkingRef.current = false
      if (version.current === requestVersion) setChecking(false)
    }
  }, [])
  useEffect(() => {
    // Restore the server-owned session when the application mounts.
    // oxlint-disable-next-line react/set-state-in-effect
    void check()
    const pop = () => {
      setRegister(location.pathname === '/cadastro')
      setNotice('')
    }
    const focus = () => {
      if (document.visibilityState === 'visible') void check()
    }
    window.addEventListener('popstate', pop)
    document.addEventListener('visibilitychange', focus)
    window.addEventListener('focus', focus)
    if ('BroadcastChannel' in window) {
      const bus = new BroadcastChannel('expenses-session')
      channel.current = bus
      bus.onmessage = (event) => {
        if (event.data === 'logout') {
          version.current++
          setSession(null)
          setChecking(false)
          setNotice('Sua sessão foi encerrada.')
          navigate(false)
        } else if (event.data === 'login') void check()
      }
    }
    return () => {
      window.removeEventListener('popstate', pop)
      window.removeEventListener('focus', focus)
      document.removeEventListener('visibilitychange', focus)
      channel.current?.close()
    }
  }, [check, navigate])
  useEffect(() => {
    if (!session) return
    const timer = window.setTimeout(
      () => void check(),
      Math.max(1, session.expiresIn + 1) * 1000,
    )
    return () => clearTimeout(timer)
  }, [session, check])
  function loggedIn(result: Session) {
    version.current++
    setSession(result)
    setChecking(false)
    navigate(false)
    history.replaceState(null, '', '/')
    channel.current?.postMessage('login')
  }
  async function logout() {
    if (leaving) return
    version.current++
    setLeaving(true)
    setNotice('')
    try {
      await identity.logout()
      setSession(null)
      navigate(false)
      setNotice('Você saiu da sua conta.')
      channel.current?.postMessage('logout')
    } catch {
      setSession(null)
      navigate(false)
      setNotice(
        'Não foi possível confirmar a revogação da sessão. Entre novamente e tente sair quando o serviço voltar.',
      )
      channel.current?.postMessage('logout')
    } finally {
      setLeaving(false)
    }
  }
  return (
    <main className="auth-layout">
      <section className="brand-panel" aria-label="Contas da Casa">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault()
            if (!session) navigate(false)
          }}
        >
          <span className="brand-icon" aria-hidden="true">
            ⌂
          </span>
          contas da casa<span className="brand-dot">.</span>
        </a>
        <div className="brand-story">
          <span className="eyebrow">MAIS CLAREZA. MAIS TRANQUILIDADE.</span>
          <h1>
            Uma casa.
            <br />
            Planos em comum.
            <br />
            <em>Contas em dia.</em>
          </h1>
          <p>
            Um lugar para organizar as finanças da casa e cuidar do que importa,
            juntos.
          </p>
          <div className="house-art" aria-hidden="true">
            <div className="roof" />
            <div className="house">
              <span />
              <span />
              <i />
            </div>
            <div className="ground" />
            <div className="plant">✳</div>
          </div>
        </div>
        <p className="brand-footer">O cuidado com a sua casa começa aqui.</p>
      </section>
      <section className="form-panel" aria-label="Acesso à conta">
        <div className="form-card">
          <span className="section-label">
            {session
              ? 'SUA CONTA'
              : register
                ? 'VAMOS COMEÇAR'
                : 'BEM-VINDO DE VOLTA'}
          </span>
          <h2 ref={heading} tabIndex={-1}>
            {checking
              ? 'Só um instante'
              : session
                ? 'Você está em casa.'
                : register
                  ? 'Crie sua conta'
                  : 'Entre na sua conta'}
          </h2>
          <p className="intro">
            {checking
              ? 'Estamos verificando sua sessão.'
              : session
                ? 'Seu acesso está pronto.'
                : register
                  ? 'O primeiro passo para cuidar das contas juntos.'
                  : 'Acesse com seu e-mail e senha para continuar.'}
          </p>
          {notice && (
            <div className="alert" role="status">
              {notice}
            </div>
          )}
          {checking ? (
            <div className="loading" role="status">
              Verificando acesso…
            </div>
          ) : session ? (
            <div className="signed-in">
              <div className="account-avatar" aria-hidden="true">
                ✓
              </div>
              <p>
                Conectado como<strong>{session.user.email}</strong>
              </p>
              <button
                className="primary"
                disabled={leaving}
                onClick={() => void logout()}
              >
                {leaving ? 'Saindo…' : 'Sair da conta'}
              </button>
            </div>
          ) : (
            <>
              <AuthForm
                key={register ? 'register' : 'login'}
                register={register}
                initialEmail={email || undefined}
                onLogin={loggedIn}
                onRegistered={(value) => {
                  setEmail(value)
                  navigate(false)
                  setNotice('Conta criada! Entre com seu e-mail e senha.')
                }}
              />
              <p className="switch-form">
                {register ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}{' '}
                <a
                  href={register ? '/login' : '/cadastro'}
                  onClick={(event) => {
                    event.preventDefault()
                    navigate(!register)
                  }}
                >
                  {register ? 'Entrar' : 'Criar conta'}
                </a>
              </p>
            </>
          )}
          <p className="privacy-note">
            <span aria-hidden="true">◇</span> Seu acesso é pessoal. Sua senha
            não é salva neste navegador pelo aplicativo.
          </p>
        </div>
        <footer>
          Contas da Casa <span>•</span> Cada conta, um cuidado.
        </footer>
      </section>
    </main>
  )
}
