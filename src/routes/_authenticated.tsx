import { Dumbbell, KeyRound, LogOut } from 'lucide-react'
import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { getAuthStateFn, logoutFn } from '../server/functions/auth'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const auth = await getAuthStateFn()
    if (!auth.authenticated) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const router = useRouter()
  const logout = useServerFn(logoutFn)

  const handleLogout = async () => {
    await logout()
    await router.invalidate()
    await router.navigate({ to: '/login', search: { redirect: '/' } })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Ir al catálogo">
          <span className="brand-mark" aria-hidden="true">
            <Dumbbell size={20} strokeWidth={2.4} />
          </span>
          <span>
            <strong>Desencadenado</strong>
            <small>entrenamiento personal</small>
          </span>
        </Link>
        <nav className="topbar-actions" aria-label="Navegación principal">
          <Link
            to="/settings"
            className="icon-link"
            activeProps={{ 'data-active': true }}
          >
            <KeyRound size={18} />
            <span>Ajustes</span>
          </Link>
          <button type="button" className="icon-link" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Salir</span>
          </button>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
