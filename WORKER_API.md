# API worker guide

This file is for future coding agents or local worker scripts that need to create and inspect workouts through the public API.

## Credentials

Read local credentials from `.env.worker`; it is deliberately ignored by Git.

```dotenv
TRAINING_API_BASE_URL=http://localhost:3000/api/v1
TRAINING_API_TOKEN=...
```

Never copy the token into source code, Markdown, commits or client-side bundles. Send it only as:

```http
Authorization: Bearer <TRAINING_API_TOKEN>
```

## Useful API workflow

1. Read `GET /current-capability-levels` when planning around the current assessment.
2. Locate named variants with `GET /exercise-variants?q=<name>&limit=20`.
3. Use `POST /workouts` to append a planned workout. It requires both `Authorization` and a unique `Idempotency-Key` (maximum 128 characters).
4. Verify it with `GET /workout-queue` or the returned body. The response returns `{ data: workout }`.

Only the pending-workout API can create plans. Assessments and active training sessions stay UI-only.

## Workout payload rules

Identifiers and HTTP payload keys are English; copy visible product names into Spanish.

- Methods supported by the MVP: `NORMAL_SETS`, `PYRAMID`, `SUPERSET`.
- A `SUPERSET` contains exactly two items and is completed as one work unit.
- Select a dynamic progression with:

```json
{
  "kind": "CAPABILITY_RELATIVE",
  "capability": "PUSH_UP",
  "levelOffset": -1
}
```

- Select a catalog variant by ID with:

```json
{
  "kind": "EXPLICIT_VARIANT",
  "exerciseVariantId": "<uuid from exercise-variants>"
}
```

For a seven-minute book pyramid, use `pyramidDurationMs: 420000`, `pyramidInitialReps: 1`, and `pyramidRestMsPerRep: 1000`. Set `afterBlockRestMs: 60000` between pyramids and `0` for the final one. The book's exercise extra is optional and should normally be omitted from the four base blocks.

## Example request shape

```json
{
  "name": "Semana 1 · Día 1 · Tirar / Empujar",
  "notes": "Semanas 1 y 2 — Resistencia / masa muscular.",
  "blocks": [
    {
      "method": "PYRAMID",
      "name": null,
      "instructions": "Pirámide de 1 repetición y 1 segundo de descanso, subiendo y bajando.",
      "afterBlockRestMs": 60000,
      "pyramidDurationMs": 420000,
      "pyramidInitialReps": 1,
      "pyramidRestMsPerRep": 1000,
      "items": [
        {
          "selection": {
            "kind": "CAPABILITY_RELATIVE",
            "capability": "PUSH_UP",
            "levelOffset": -1
          },
          "targets": []
        }
      ]
    }
  ]
}
```

## Week 1 reference from the book

The printed page 97 table (PDF page 98) prescribes four base pyramids of seven minutes:

- Day 1, pull/push: Flexiones, Dominadas, Flexiones hindús, Semi-dominada horizontal. Extra: Fondos en paralelas.
- Day 2, legs/core: Desplantes, Abdominales, Sentadillas, Levantamiento de caderas. Extra: Sentadilla búlgara.

The book says to use maximum assessment level minus one for these pyramids. Use capability-relative selection where the movement belongs to the main progression; retain explicit selection when the named book movement itself is the important choice.
