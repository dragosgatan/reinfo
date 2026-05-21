# Referință API – ReInfo

Documentație interactivă: `http://localhost:8000/api/docs` (Swagger) sau `/api/redoc`.

Toate endpoint-urile sunt prefixate cu `/api`. Autentificarea se face prin cookie HTTP-only setat la login.

---

## Autentificare

| Endpoint | Metodă | Descriere |
|---|---|---|
| `/api/auth/register` | POST | Înregistrare cont nou (rate limit: 5/min) |
| `/api/auth/login` | POST | Login, setează cookie sesiune |
| `/api/auth/logout` | POST | Invalidează sesiunea |
| `/api/auth/me` | GET | Utilizatorul autentificat curent |
| `/api/auth/users/{username}` | GET | Profil public utilizator |

**Login body:** `{ username, password }` → setează `Set-Cookie: session=...; HttpOnly; SameSite=Strict`

**Me response:**
```json
{
  "id": "uuid", "username": "string", "email": "string",
  "role": "user | teacher | admin", "language": "ro | en | hu",
  "duel_rating": 1200, "created_at": "ISO8601"
}
```

---

## Probleme

| Endpoint | Metodă | Auth | Descriere |
|---|---|---|---|
| `/api/problems` | GET | — | Listare cu filtrare și paginare |
| `/api/problems/{slug}` | GET | — | Detalii problemă cu enunț |
| `/api/problems` | POST | Da | Creare problemă nouă |
| `/api/problems/{slug}` | PATCH | Autor/admin | Actualizare |
| `/api/problems/{slug}` | DELETE | Autor/admin | Ștergere |
| `/api/problems/{slug}/test-cases` | GET/POST | Autor/admin | Cazuri de test |
| `/api/problems/{slug}/test-cases/{ordinal}` | DELETE | Autor/admin | Ștergere test |

**Query params GET /api/problems:** `page`, `per_page`, `difficulty_min`, `difficulty_max`, `tags`, `search`, `sort`, `order`

**POST /api/problems body:**
```json
{
  "title": "string", "statement_md": "string", "difficulty": 5,
  "tags": ["dp"], "visibility": "draft | public | private | contest",
  "time_limit_ms": 1000, "memory_limit_kb": 65536,
  "score_total": 100, "comparison_mode": "exact | whitespace_insensitive | float_epsilon"
}
```

---

## Submisii

| Endpoint | Metodă | Auth | Descriere |
|---|---|---|---|
| `/api/submissions` | POST | Da | Trimite soluție |
| `/api/submissions` | GET | Da | Istoric submisii |
| `/api/submissions/{id}` | GET | Da | Detalii cu rezultate per test |

**POST body:** `{ problem_id, code, language }` — limbaje: `c | cpp | python | java | rust | go | javascript | kotlin | pypy`

**GET /{id} response:**
```json
{
  "id": "uuid", "verdict": "AC | WA | CE | TLE | MLE | RE | pending",
  "score": 100, "results": [{ "test_case_ordinal": 1, "verdict": "AC", "time_ms": 45, "memory_kb": 2048 }]
}
```

---

## Concursuri

| Endpoint | Metodă | Auth | Descriere |
|---|---|---|---|
| `/api/contests` | GET | — | Listare (`status=upcoming|running|finished`) |
| `/api/contests/{slug}` | GET | — | Detalii cu probleme |
| `/api/contests` | POST | Teacher/admin | Creare concurs |
| `/api/contests/{slug}/join` | POST | Da | Înscriere |
| `/api/contests/{slug}/leaderboard` | GET | — | Clasament snapshot |
| `WS /api/contests/{slug}/leaderboard` | WS | — | Clasament live |

**WS leaderboard message:**
```json
{ "type": "leaderboard_update", "entries": [{ "rank": 1, "username": "string", "total_score": 300 }] }
```

---

## Dueluri

| Endpoint | Metodă | Auth | Descriere |
|---|---|---|---|
| `/api/duels/requests` | POST | Da | Trimite invitație |
| `/api/duels/requests/pending` | GET | Da | Invitații primite |
| `/api/duels/requests/{id}/accept` | POST | Da | Acceptă invitație |
| `/api/duels/queue/join` | POST | Da | Intră în coadă matchmaking |
| `/api/duels/queue/leave` | DELETE | Da | Ieși din coadă |
| `/api/duels/{duel_id}` | GET | Da | Detalii duel |
| `/api/duels/{duel_id}/submit` | POST | Da | Trimite cod în duel |
| `/api/duels/{duel_id}/resign` | POST | Da | Abandonează |
| `WS /api/duels/{duel_id}/ws` | WS | Da | Evenimente live |

**WS duel events:**
```json
{ "type": "submission_result", "user_id": "uuid", "verdict": "AC", "score": 100 }
{ "type": "duel_finished", "winner_id": "uuid", "elo_change": 15 }
{ "type": "draw_offered", "from_user_id": "uuid" }
{ "type": "resign", "user_id": "uuid" }
```

---

## Lecții

| Endpoint | Metodă | Auth | Descriere |
|---|---|---|---|
| `/api/lessons` | GET | — | Listare (`difficulty`, `tags`) |
| `/api/lessons/{slug}` | GET | — | Conținut complet |
| `/api/lessons/{slug}/complete` | POST | Da | Marchează ca finalizat |

---

## Clase

| Endpoint | Metodă | Auth | Descriere |
|---|---|---|---|
| `/api/classrooms` | POST | Teacher/admin | Creare clasă |
| `/api/classrooms/join` | POST | Da | Alăturare cu cod |
| `/api/classrooms/{id}` | GET | Membru | Detalii, anunțuri, teme |
| `/api/classrooms/{id}/regenerate-code` | POST | Teacher | Cod nou de acces |

---

## Social

| Endpoint | Metodă | Auth | Descriere |
|---|---|---|---|
| `/api/social/friend-requests` | POST | Da | Cerere de prietenie |
| `/api/social/friend-requests/{id}/accept` | POST | Da | Acceptă |
| `/api/social/friends` | GET | Da | Lista prietenilor |
| `/api/social/notifications` | GET | Da | Notificări necitite |
| `/api/social/notifications/{id}/read` | POST | Da | Marchează ca citit |
| `WS /api/social/notifications/ws` | WS | Da | Notificări live |

---

## Sistem

**GET /api/health** → `{ "status": "ok", "database": "connected", "piston": "reachable" }`

---

## Coduri de eroare

Toate erorile: `{ "detail": "mesaj" }`

| Cod | Semnificație |
|---|---|
| 400 | Date invalide |
| 401 | Sesiune lipsă sau expirată |
| 403 | Permisiuni insuficiente |
| 404 | Resursa nu există |
| 409 | Conflict (username/email existent) |
| 422 | Eroare validare Pydantic |
| 429 | Rate limit depășit |
| 500 | Eroare server neașteptată |
