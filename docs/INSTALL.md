# Ghid de instalare – ReInfo

## Cuprins

- [Cerințe](#cerințe)
- [Pornire rapidă cu Docker](#pornire-rapidă-cu-docker)
- [Instalare manuală](#instalare-manuală)
  - [Backend](#backend)
  - [Frontend](#frontend)
- [Variabile de mediu](#variabile-de-mediu)
- [Migrații bază de date](#migrații-bază-de-date)
- [Configurare Piston](#configurare-piston)
- [Rularea testelor](#rularea-testelor)
- [Deployment în producție](#deployment-în-producție)

---

## Cerințe

### Cu Docker (recomandat)

| Dependință | Versiune minimă |
|---|---|
| Docker Engine | 24+ |
| Docker Compose | v2.20+ |
| Git | orice versiune recentă |

### Fără Docker

| Dependință | Versiune minimă |
|---|---|
| Python | 3.11+ |
| Node.js | 20+ |
| PostgreSQL | 16+ |
| `uv` (package manager Python) | 0.2+ |
| npm | 10+ |

---

## Pornire rapidă cu Docker

Acesta este modul recomandat de instalare pentru dezvoltare locală. Pornește toate serviciile (bază de date, backend, worker, Piston, frontend) cu un singur comandă.

```bash
git clone https://github.com/dragosgatan/reinfo.git
cd reinfo

# Pornește toate serviciile
docker compose up --build
```

Serviciile vor fi disponibile la:

| Serviciu | URL |
|---|---|
| Frontend (UI) | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Documentație API (Swagger) | http://localhost:8000/api/docs |
| Documentație API (ReDoc) | http://localhost:8000/api/redoc |
| Piston (executor cod) | http://localhost:2000 |

La prima pornire, Docker va descărca imaginile necesare și va construi containerele. Piston poate dura câteva minute pentru a se inițializa.

### Aplicarea migrațiilor (prima pornire)

Migrațiile sunt aplicate automat la pornirea containerului `backend`. Dacă trebuie aplicate manual:

```bash
docker compose exec backend alembic upgrade head
```

### Oprit serviciile

```bash
docker compose down

# Șterge și datele persistente (baza de date)
docker compose down -v
```

---

## Instalare manuală

### Backend

```bash
cd backend

# Instalează uv (dacă nu e deja instalat)
pip install uv

# Creează un mediu virtual și instalează dependințele
uv venv
source .venv/bin/activate      # Linux/macOS
# .venv\Scripts\activate       # Windows

uv pip install -e ".[dev]"

# Copiază fișierul de configurare
cp .env.example .env
# Editează .env cu valorile tale

# Aplică migrațiile
alembic upgrade head

# Pornește serverul de dezvoltare
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Worker (judecător de soluții)

Workerul procesează cozile de judecată în fundal. Rulează-l într-un terminal separat:

```bash
cd backend
source .venv/bin/activate
python -m app.worker
```

### Frontend

```bash
cd frontend

npm install

# Creează fișierul de configurare
cp .env.local.example .env.local   # sau creează manual
# Editează .env.local

npm run dev
```

---

## Variabile de mediu

### Backend (`.env`)

| Variabilă | Implicit | Obligatorie | Descriere |
|---|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://reinfo:reinfo@localhost:5432/reinfo` | Da | URL de conexiune PostgreSQL (async) |
| `SECRET_KEY` | — | Da (prod) | Cheie secretă pentru semnarea sesiunilor; generează cu `openssl rand -hex 32` |
| `ALLOWED_ORIGINS` | `["http://localhost:3000"]` | Nu | Lista de origini CORS permise (JSON array) |
| `DATA_DIR` | `../data` | Nu | Director pentru fișierele `.in`/`.out` și avatare |
| `ENVIRONMENT` | `development` | Nu | `development` sau `production`; activează HTTPS cookies în producție |
| `PISTON_URL` | `http://localhost:2000` | Nu | URL instanță Piston pentru execuția codului |

### Frontend (`.env.local`)

| Variabilă | Implicit | Descriere |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | URL-ul API-ului backend, accesibil din browser |
| `OPENROUTER_API_KEY` | — | Cheie API pentru funcționalitățile AI (chatbot lecții, traducere) |

---

## Migrații bază de date

Proiectul folosește Alembic pentru gestionarea schemei bazei de date.

```bash
cd backend

# Aplică toate migrațiile noi
alembic upgrade head

# Aplică o singură migrație
alembic upgrade +1

# Revino la o versiune anterioară
alembic downgrade -1

# Verifică starea curentă
alembic current

# Generează o nouă migrație după modificarea modelelor
alembic revision --autogenerate -m "descriere_modificare"
```

---

## Configurare Piston

[Piston](https://github.com/engineer-man/piston) este motorul de execuție sandbox pentru cod. În modul Docker, containerul se pornește automat.

Limbajele suportate trebuie instalate manual în Piston după prima pornire:

```bash
# Instalează runtime-urile necesare (rulează o singură dată)
docker compose exec piston ppman install python=3.10.0
docker compose exec piston ppman install c++=10.2.0
docker compose exec piston ppman install c=10.2.0
docker compose exec piston ppman install java=15.0.2
docker compose exec piston ppman install rust=1.50.0
docker compose exec piston ppman install go=1.16.2
docker compose exec piston ppman install javascript=16.3.0

# Verifică runtime-urile instalate
docker compose exec piston ppman list
```

---

## Rularea testelor

### Backend

```bash
cd backend

# Asigură-te că există o bază de date de test PostgreSQL
# (se creează automat dacă rulezi pytest cu configurația de CI)

# Rulează toate testele
pytest -v

# Rulează un singur fișier de test
pytest tests/test_problems.py -v

# Rulează cu raport de acoperire
pytest --cov=app --cov-report=html
```

Variabile de mediu necesare pentru teste:

```bash
export DATABASE_URL=postgresql+asyncpg://reinfo:reinfo@localhost:5432/reinfo_test
export SECRET_KEY=test-secret-key
```

### Frontend

```bash
cd frontend

# Verificare lint
npm run lint

# Verificare tipuri TypeScript
npm run typecheck

# Build de producție (verificare completă)
npm run build
```

---

## Deployment în producție

### Considerații de securitate

1. **`SECRET_KEY`**: Generează o cheie aleatoare puternică:
   ```bash
   openssl rand -hex 32
   ```
2. **`ENVIRONMENT=production`**: Activează cookie-uri Secure și SameSite=Strict.
3. **`ALLOWED_ORIGINS`**: Limitează la domeniul tău exact.
4. **PostgreSQL**: Schimbă credențialele implicite `reinfo/reinfo`.
5. **Piston**: Nu expune portul Piston (2000) extern — accesează-l doar intern.

### Reverse proxy (nginx/Caddy)

Configurează un reverse proxy care:
- Servește frontendurile pe HTTPS (port 443)
- Proxiază `/api/*` și `/ws/*` către backend (port 8000)
- Setează headere de securitate (`X-Frame-Options`, `Content-Security-Policy`)

### `DATA_DIR`

Montează un volum persistent pentru `DATA_DIR` care conține fișierele `.in`/`.out` și avatarele utilizatorilor. Această locație trebuie accesibilă atât de container-ul `backend`, cât și de `worker`.
