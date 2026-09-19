# Desencadenado Training

Aplicación personal, monousuario y mobile-first para consultar los ejercicios de _Desencadenado_ y, en las siguientes entregas, evaluar capacidades y planificar y ejecutar entrenamientos.

La Entrega 0 y la Entrega 1 incluyen login, SQLite, tokens API y un catálogo navegable con 71 variantes, 145 imágenes, 19 vídeos y 25 definiciones de nivel.

## Arranque local

Requiere Node.js 22.12 o superior (CI y Docker usan Node 24) y pnpm 12.

```bash
pnpm install
Copy-Item .env.example .env
pnpm dev
```

La aplicación estará en `http://localhost:3000`. Ajusta `APP_PASSWORD` y `SESSION_SECRET` en `.env`; el fichero no se versiona. La configuración local incluida usa la contraseña `desencadenado` exclusivamente para desarrollo.

Al arrancar por primera vez se crea `data/training.sqlite`, se ejecutan las migraciones y se carga el seed idempotente. Las imágenes se sirven desde la carpeta plana original `Desencadenado-Entrenos con peso corporal/files`.

## Comandos

```bash
pnpm catalog:generate   # regenera seed/catalog.json desde exercises.md
pnpm catalog:validate   # valida conteos y todos los medios referenciados
pnpm typecheck
pnpm test
pnpm build
pnpm validate           # formato, lint, tipos, pruebas y build
```

## API

Desde **Ajustes** se generan y revocan Bearer tokens. La documentación protegida está en `/api/docs`; el contrato OpenAPI autenticado, en `/api/v1/openapi.json`.

Rutas de lectura disponibles:

- `GET /api/v1/exercise-variants`
- `GET /api/v1/exercise-variants/{variantId}`
- `GET /api/v1/exercise-catalog-options`
- `GET /api/v1/capability-level-definitions`
- `GET /api/v1/media-assets/{mediaId}/content`

Las colecciones devuelven `{ data, meta }` y los errores usan Problem Details. Los filtros del listado son `q`, `exerciseType` repetible, `difficultyMin`, `difficultyMax`, `cursor` y `limit`.

## Contenedor local

El despliegue remoto se hará al final; el contenedor sirve ahora para validar el artefacto de producción localmente.

```bash
docker compose up --build
```

El volumen `training-data` conserva `/app/data/training.sqlite` entre reinicios. `/healthz` verifica que SQLite abre, migra y responde.

## Datos fuente

- El contenido editorial normalizado vive en `exercises.md` y `seed/catalog.json`.
- Los IDs del seed son estables y el runtime no depende de analizar Markdown.
- `plan.md` contiene las decisiones de producto y la secuencia de entregas.
- Railway y S3 quedan expresamente fuera hasta la Entrega 6.
