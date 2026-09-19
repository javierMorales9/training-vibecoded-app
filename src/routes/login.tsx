import { useState } from 'react'
import type { FormEvent } from 'react'
import { LockKeyhole } from 'lucide-react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { getAuthStateFn, loginFn } from '../server/functions/auth'

interface LoginSearch {
  redirect: string
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect:
      typeof search.redirect === 'string' && search.redirect.startsWith('/')
        ? search.redirect
        : '/',
  }),
  beforeLoad: async ({ search }) => {
    const auth = await getAuthStateFn()
    if (auth.authenticated) throw redirect({ href: search.redirect })
  },
  component: LoginPage,
})

function LoginPage() {
  const { redirect: destination } = Route.useSearch()
  const router = useRouter()
  const login = useServerFn(loginFn)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setPending(true)
    const form = new FormData(event.currentTarget)
    try {
      const result = await login({
        data: { password: String(form.get('password') ?? '') },
      })
      if (!result.valid) {
        setError('La contraseña no es correcta.')
        return
      }
      await router.invalidate()
      await router.navigate({ href: destination })
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-emblem" aria-hidden="true">
          <LockKeyhole size={30} />
        </div>
        <p className="eyebrow">Tu gimnasio, a mano</p>
        <h1 id="login-title">Desencadenado</h1>
        <p className="login-copy">
          Entra para consultar el catálogo y preparar tu siguiente
          entrenamiento.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
          />
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  )
}
