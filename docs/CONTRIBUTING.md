# Ghid de contribuție – ReInfo

Mulțumim că ești interesat să contribui la ReInfo! Acest document explică cum să configurezi mediul de dezvoltare, standardele de cod și procesul de trimitere a modificărilor.

## Cuprins

- [Configurare mediu de dezvoltare](#configurare-mediu-de-dezvoltare)
- [Structura proiectului](#structura-proiectului)
- [Standarde de cod](#standarde-de-cod)
- [Scrierea testelor](#scrierea-testelor)
- [Workflow Git](#workflow-git)
- [Trimiterea unui Pull Request](#trimiterea-unui-pull-request)
- [CI/CD](#cicd)

---

## Configurare mediu de dezvoltare

### Clonare și pornire servicii

```bash
git clone https://github.com/dragosgatan/reinfo.git
cd reinfo
docker compose up --build
```

Sau urmează ghidul de instalare manuală din [INSTALL.md](INSTALL.md).

### Pre-commit hooks

```bash
pip install pre-commit
pre-commit install
```

Hook-urile rulează automat înainte de fiecare commit: `ruff check`, `ruff format`, `eslint --fix`.

---

## Structura proiectului

```
backend/app/
├── routers/     # Handlere HTTP – un fișier per resursă
├── models/      # SQLAlchemy ORM – un fișier per entitate
├── schemas/     # Pydantic schemas – request/response
├── judging.py   # Logica de comparare output + calcul scor
├── worker.py    # Procesator coadă de judecată
└── realtime.py  # WebSocket hubs + NOTIFY listener

frontend/src/
├── app/[locale]/      # Pagini Next.js (App Router)
├── components/        # Componente UI
└── lib/               # API client, tipuri Zod, hook-uri React
```

---

## Standarde de cod

### Python (backend)

- **Formatter + linter:** `ruff` — rulează întotdeauna după modificări:
  ```bash
  cd backend
  ruff check . --fix && ruff format .
  ```
- **Type hints:** Obligatorii pentru toate funcțiile publice și semnăturile de endpoint.
- **Docstrings:** Google-style pentru funcții cu logică non-trivială. Evită docstring-uri care repetă numele funcției.
- **PEP 8:** Aplicat automat de `ruff`.
- **Comentarii:** Adaugă doar dacă _de ce_ nu este evident. Nu adăuga separatori decorativi (`# ---...---`).
- **Structura unui router nou:**
  ```python
  router = APIRouter(prefix="/api/resource", tags=["resource"])

  @router.get("/")
  async def list_resource(
      db: AsyncSession = Depends(get_db),
      current_user: User = Depends(get_current_user),
  ) -> list[ResourceSchema]:
      """Returnează lista de resurse ale utilizatorului curent."""
      ...
  ```

### TypeScript (frontend)

- **Strict mode:** `tsconfig.json` are `strict: true` — niciun `any` fără justificare.
- **Lint:** ESLint rulează automat în CI. Local:
  ```bash
  cd frontend
  npm run lint
  npm run typecheck
  ```
- **Componente React:** Funcționale + hooks. Nu clase.
- **API calls:** Folosește `lib/api.ts` cu validare Zod, nu `fetch` direct.
- **State server:** TanStack Query pentru orice date din API.
- **Comentarii:** Identic cu Python — doar dacă _de ce_ nu reiese din cod.

### Design frontend

Urmează principiile din `CLAUDE.md`:

- Editorial/utilitarian — nu SaaS landing page
- Muted base colors + un singur accent
- shadcn/ui customizat, nu defaults
- Motion subtil — fără animații bounce sau scroll-triggered pe tabele
- Whitespace > decorațiuni

---

## Scrierea testelor

### Backend

Fiecare endpoint nou trebuie să aibă cel puțin:
- Un test „happy path" (cazul de succes)
- Un test de autentificare lipsă (401)
- Un test de date invalide (422)

**Structura unui test:**

```python
async def test_create_problem(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/problems",
        json={
            "title": "Test Problem",
            "statement_md": "## Cerință\nCalculează suma.",
            "difficulty": 3,
            "tags": ["math"],
            "visibility": "public",
            "time_limit_ms": 1000,
            "memory_limit_kb": 65536,
            "score_total": 100,
            "comparison_mode": "whitespace_insensitive",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Test Problem"
    assert data["slug"]  # generat automat
```

**Rulare teste:**

```bash
cd backend
pytest -v                          # toate testele
pytest tests/test_problems.py -v   # un singur fișier
pytest -k "test_create" -v         # filtrare după nume
pytest --cov=app -v                # cu coverage
```

### Baze de date în teste

Fixture-ul `client` din `conftest.py` folosește o bază de date separată (`reinfo_test`). Schema se recreează o dată per sesiune; datele sunt șterse între teste.

Nu folosi mock-uri pentru baza de date — testele trebuie să atingă un PostgreSQL real (identic cu CI).

---

## Workflow Git

### Branch-uri

| Prefix | Utilizare |
|---|---|
| `feat/` | Funcționalitate nouă |
| `fix/` | Bugfix |
| `refactor/` | Refactorizare fără schimbare de comportament |
| `docs/` | Documentație |
| `test/` | Adăugare/modificare teste |
| `chore/` | Dependințe, CI, configurare |

Exemple: `feat/contest-editorial`, `fix/submission-verdict-wa`.

### Mesaje de commit

Format [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <descriere scurtă în română sau engleză>

[corp opțional — de ce, nu ce]
```

Exemple:
```
feat(duels): add Elo rating recalculation on resign
fix(submissions): correct TLE verdict when Piston returns timeout
docs(api): add WebSocket message schema for leaderboard
```

### Înainte de push

```bash
# Backend
cd backend && ruff check . --fix && ruff format . && pytest -v

# Frontend
cd frontend && npm run lint && npm run typecheck && npm run build
```

---

## Trimiterea unui Pull Request

1. **Fork** repo-ul și creează un branch din `main`.
2. Implementează modificările cu teste corespunzătoare.
3. Asigură-te că CI trece local (comenzile de mai sus).
4. Deschide un PR cu:
   - Titlu clar și concis
   - Descriere: ce schimbă, de ce, cum se testează
   - Referință la issue dacă există (`Closes #123`)
5. Așteptați review. Nu forța push pe `main`.

### Checklist PR

- [ ] Teste adăugate/actualizate
- [ ] `ruff check . --fix && ruff format .` rulat
- [ ] `npm run lint && npm run typecheck` trecut
- [ ] Migrație Alembic adăugată dacă schema s-a schimbat
- [ ] Documentație actualizată dacă API s-a schimbat

---

## CI/CD

GitHub Actions rulează la fiecare PR și push pe `main`:

| Job | Pași |
|---|---|
| `backend-tests` | `ruff check` → `ruff format --check` → `pytest -v` |
| `frontend-checks` | `npm run lint` → `npm run typecheck` → `npm run build` |

PR-urile nu pot fi merge-uite dacă CI nu trece.

Configurare completă: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
