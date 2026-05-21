# Contribuție – ReInfo

## Setup

```bash
git clone https://github.com/dragosgatan/reinfo.git
cd reinfo
docker compose up --build
```

### Pre-commit hooks

```bash
pip install pre-commit && pre-commit install
```

Rulează automat `ruff check`, `ruff format`, `eslint --fix` înainte de fiecare commit.

---

## Standarde de cod

### Python

```bash
cd backend && ruff check . --fix && ruff format .
```

- Type hints obligatorii pentru funcții publice și endpoint-uri
- Docstrings Google-style doar dacă logica e non-trivială
- Fără separatori decorativi (`# ---...---`)

### TypeScript

```bash
cd frontend && npm run lint && npm run typecheck
```

- `strict: true` în tsconfig — fără `any` nejustificat
- Componente funcționale + hooks
- API calls prin `lib/api.ts` cu validare Zod
- State server prin TanStack Query

---

## Teste

Fiecare endpoint nou necesită minim:
- happy path (201/200)
- autentificare lipsă (401)
- date invalide (422)

```python
async def test_create_problem(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/problems", json={...}, headers=auth_headers)
    assert resp.status_code == 201
```

```bash
cd backend
pytest -v
pytest tests/test_problems.py -v
pytest --cov=app -v
```

Nu folosi mock-uri pentru baza de date — testele trebuie să atingă un PostgreSQL real.

---

## Git workflow

**Branch-uri:** `feat/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`

**Commit format** ([Conventional Commits](https://www.conventionalcommits.org/)):
```
feat(duels): add Elo recalculation on resign
fix(submissions): correct TLE verdict for Piston timeout
```

**Înainte de push:**
```bash
cd backend && ruff check . --fix && ruff format . && pytest -v
cd frontend && npm run lint && npm run typecheck && npm run build
```

---

## Pull Request

1. Fork + branch din `main`
2. Implementează cu teste
3. CI trece local
4. PR cu titlu clar, descriere, `Closes #issue`

**Checklist:**
- [ ] Teste adăugate/actualizate
- [ ] `ruff` și `eslint` trecute
- [ ] Migrație Alembic adăugată dacă schema s-a schimbat
- [ ] API.md actualizat dacă endpoint-urile s-au schimbat

---

## CI

| Job | Pași |
|---|---|
| `backend-tests` | `ruff check` → `ruff format --check` → `pytest -v` |
| `frontend-checks` | `npm run lint` → `npm run typecheck` → `npm run build` |
