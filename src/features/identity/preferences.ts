const key = 'expenses.remembered-email'
export function rememberedEmail(): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}
export function rememberEmail(email: string, remember: boolean) {
  try {
    if (remember) localStorage.setItem(key, email.trim().toLowerCase())
    else localStorage.removeItem(key)
  } catch {
    /* Storage may be disabled. Authentication still works. */
  }
}
export function validEmail(email: string) {
  return (
    email.length <= 128 &&
    /^[\x21-\x7e]+@[\x21-\x7e]+\.[\x21-\x7e]+$/.test(email) &&
    !/[<>(),;:"\\]/.test(email)
  )
}
export function validPassword(password: string) {
  // Control characters are explicitly forbidden by the registration contract.
  return (
    password.length >= 8 &&
    password.length <= 256 &&
    /\p{L}/u.test(password) &&
    /[0-9]/.test(password) &&
    !/[\s\p{Cc}]/u.test(password)
  )
}
