# Instalare – ReInfo

## Pornire rapidă (Docker)

**Cerințe:** Docker Engine 24+, Docker Compose v2.

```bash
git clone https://github.com/dragosgatan/reinfo.git
cd reinfo
docker compose up --build
```

| Serviciu | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| Swagger | http://localhost:8000/api/docs |
| Piston | http://localhost:2000 |

La prima pornire aplică migrațiile (dacă nu rulează automat):

```bash
docker compose exec backend alembic upgrade head
```

---

## Variabile de mediu

### Backend (`.env`)

| Variabilă | Implicit | Descriere |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://reinfo:reinfo@localhost:5432/reinfo` | Conexiune PostgreSQL async |
| `SECRET_KEY` | — | Cheie pentru semnarea sesiunilor; `openssl rand -hex 32` |
| `ALLOWED_ORIGINS` | `["http://localhost:3000"]` | Origini CORS permise |
| `DATA_DIR` | `../data` | Director pentru fișiere `.in`/`.out` și avatare |
| `ENVIRONMENT` | `development` | `development` sau `production` |
| `PISTON_URL` | `http://localhost:2000` | URL instanță Piston |

### Frontend (`.env.local`)

| Variabilă | Implicit | Descriere |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | URL API backend |
| `OPENROUTER_API_KEY` | — | Cheie API pentru chatbot AI |

---

## Piston – instalare runtime-uri

Rulează o singură dată după prima pornire:

```bash
docker compose exec piston ppman install python=3.10.0
docker compose exec piston ppman install c++=10.2.0
docker compose exec piston ppman install c=10.2.0
docker compose exec piston ppman install java=15.0.2
docker compose exec piston ppman install rust=1.50.0
docker compose exec piston ppman install go=1.16.2
docker compose exec piston ppman install javascript=16.3.0
```

Verifică runtime-urile instalate:

```bash
docker compose exec piston ppman list
```

---

## Migrații

```bash
alembic upgrade head      # aplică toate migrațiile
alembic downgrade -1      # revenire
alembic current           # stare curentă
alembic revision --autogenerate -m "descriere"   # generare după modificări model
```

---

## Teste

```bash
# Backend
cd backend
export DATABASE_URL=postgresql+asyncpg://reinfo:reinfo@localhost:5432/reinfo_test
export SECRET_KEY=test-secret-key
pytest -v

# Frontend
cd frontend
npm run lint && npm run typecheck
```

---

## Deployment producție

- `SECRET_KEY` generat aleatoriu (`openssl rand -hex 32`)
- `ENVIRONMENT=production` activează cookie-uri Secure
- `ALLOWED_ORIGINS` limitat la domeniul de producție
- Credențiale PostgreSQL schimbate față de defaults
- Portul Piston (2000) **nu** expus extern
- `DATA_DIR` montat pe volum persistent cu backup
- Reverse proxy (nginx/Caddy) cu HTTPS, proxiază `/api/*` și `/ws/*` la portul 8000
