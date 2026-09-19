import { useState } from 'react'
import { Check, Copy, KeyRound, Plus, Trash2 } from 'lucide-react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  createApiTokenFn,
  listApiTokensFn,
  revokeApiTokenFn,
} from '../server/functions/tokens'

export const Route = createFileRoute('/_authenticated/settings')({
  loader: () => listApiTokensFn(),
  component: SettingsPage,
})

function SettingsPage() {
  const tokens = Route.useLoaderData()
  const router = useRouter()
  const createToken = useServerFn(createApiTokenFn)
  const revokeToken = useServerFn(revokeApiTokenFn)
  const [name, setName] = useState('Agente personal')
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, setPending] = useState(false)

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    try {
      const result = await createToken({
        data: { name, canRead: true, canWriteWorkouts: true },
      })
      setNewToken(result.token)
      await router.invalidate()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="settings-page">
      <header className="page-header">
        <p className="eyebrow">Administración local</p>
        <h1>Ajustes y acceso API</h1>
        <p>
          Los tokens permiten consultar el catálogo y, más adelante, gestionar
          entrenamientos desde agentes.
        </p>
      </header>

      <section className="settings-card">
        <div className="settings-card-heading">
          <KeyRound />
          <div>
            <h2>Tokens personales</h2>
            <p>Cada secreto solo se muestra una vez.</p>
          </div>
        </div>
        <form className="token-form" onSubmit={handleCreate}>
          <label>
            Nombre del token
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
            />
          </label>
          <button className="primary-button" disabled={pending} type="submit">
            <Plus size={18} />
            {pending ? 'Creando…' : 'Crear token'}
          </button>
        </form>
        {newToken ? (
          <div className="token-reveal" role="status">
            <strong>Guárdalo ahora; no volverá a mostrarse.</strong>
            <code>{newToken}</code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(newToken)
                setCopied(true)
              }}
            >
              {copied ? <Check size={17} /> : <Copy size={17} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        ) : null}
        <div className="token-list">
          {tokens.length ? (
            tokens.map((token) => (
              <div
                className="token-row"
                key={token.id}
                data-revoked={Boolean(token.revokedAt)}
              >
                <div>
                  <strong>{token.name}</strong>
                  <code>trn_{token.prefix}_…</code>
                </div>
                <div className="token-dates">
                  <span>
                    Creado {new Date(token.createdAt).toLocaleDateString('es')}
                  </span>
                  {token.lastUsedAt ? (
                    <span>
                      Usado{' '}
                      {new Date(token.lastUsedAt).toLocaleDateString('es')}
                    </span>
                  ) : null}
                </div>
                {token.revokedAt ? (
                  <span className="revoked-label">Revocado</span>
                ) : (
                  <button
                    className="danger-button"
                    type="button"
                    onClick={async () => {
                      await revokeToken({ data: { id: token.id } })
                      await router.invalidate()
                    }}
                  >
                    <Trash2 size={16} /> Revocar
                  </button>
                )}
              </div>
            ))
          ) : (
            <p className="muted-copy">Todavía no has creado ningún token.</p>
          )}
        </div>
      </section>
      <section className="settings-card compact-card">
        <h2>Documentación</h2>
        <p>
          Consulta el contrato HTTP y prueba los endpoints desde la
          documentación de la API.
        </p>
        <Link className="secondary-button" to="/api/docs">
          Abrir documentación
        </Link>
      </section>
    </div>
  )
}
