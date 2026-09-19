# Project invariants

- This is a single-user application. Do not add tenants, organisations, user registration or horizontal-scaling machinery.
- Code, database identifiers and HTTP contracts use English. Product copy is Spanish.
- `training.sqlite` is the sole application database. Keep SQLite migrations and seeds deterministic and idempotent.
- The public API is intentionally narrower than the UI. Assessments and live training sessions remain UI-only; workout planning may be exposed later as explicitly designed.
- Do not add speculative workout methodologies. The MVP supports normal sets, pyramids and supersets only; a superset is completed with one action for the whole group.
- Preserve `plan.md`, `exercises.md`, source books and the flat `files` media directory.
- Run the relevant catalog validation, typecheck, tests and production build before handing off material changes.
- Railway and S3 belong to the final production delivery, not local feature work.
