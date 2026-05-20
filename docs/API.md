# Referință API – ReInfo

Documentația completă interactivă (Swagger UI) este disponibilă la `http://localhost:8000/api/docs` când serverul rulează.

Toate endpoint-urile sunt prefixate cu `/api`. Autentificarea se face prin cookie HTTP-only setat la `/api/auth/login`.

## Cuprins

- [Autentificare](#autentificare)
- [Probleme](#probleme)
- [Submisii](#submisii)
- [Concursuri](#concursuri)
- [Dueluri](#dueluri)
- [Lecții](#lecții)
- [Clase](#clase)
- [Social](#social)
- [Sistem](#sistem)
- [Coduri de eroare](#coduri-de-eroare)

---

## Autentificare

Sesiunile sunt gestionate prin cookie-uri HTTP-only. Niciun token nu este expus JavaScript-ului.

### `POST /api/auth/register`

Creează un cont nou.

**Body:**
```json
{
  "username": "string (3-30 chars, alfanumeric + _ -)",
  "email": "string (email valid)",
  "password": "string (min 8 chars)",
  "display_name": "string (opțional)"
}
```

**Răspuns `201`:**
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "display_name": "string",
  "role": "user",
  "created_at": "ISO8601"
}
```

**Rate limit:** 5 cereri / minut per IP.

---

### `POST /api/auth/login`

Autentifică utilizatorul și setează cookie-ul de sesiune.

**Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Răspuns `200`:** Setează `Set-Cookie: session=...; HttpOnly; SameSite=Strict`.
```json
{
  "id": "uuid",
  "username": "string",
  "role": "user | teacher | admin"
}
```

---

### `POST /api/auth/logout`

Invalidează sesiunea curentă.

**Răspuns `204`:** Șterge cookie-ul de sesiune.

---

### `GET /api/auth/me`

Returnează utilizatorul autentificat curent.

**Autentificare:** Obligatorie.

**Răspuns `200`:**
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "display_name": "string",
  "role": "user | teacher | admin",
  "language": "ro | en",
  "duel_rating": 1200,
  "created_at": "ISO8601"
}
```

---

### `GET /api/auth/users/{username}`

Profilul public al unui utilizator.

**Răspuns `200`:**
```json
{
  "id": "uuid",
  "username": "string",
  "display_name": "string",
  "role": "string",
  "duel_rating": 1200,
  "problems_solved": 42,
  "created_at": "ISO8601"
}
```

---

## Probleme

### `GET /api/problems`

Listează problemele cu paginare și filtrare.

**Query params:**

| Parametru | Tip | Implicit | Descriere |
|---|---|---|---|
| `page` | int | 1 | Pagina curentă |
| `per_page` | int | 20 | Rezultate per pagină (max 100) |
| `difficulty_min` | int | — | Dificultate minimă (1-10) |
| `difficulty_max` | int | — | Dificultate maximă (1-10) |
| `tags` | string | — | Filtrare după tag (separat prin virgulă) |
| `search` | string | — | Căutare în titlu și enunț |
| `sort` | string | `created_at` | `created_at`, `difficulty`, `title` |
| `order` | string | `desc` | `asc` sau `desc` |

**Răspuns `200`:**
```json
{
  "items": [
    {
      "id": "uuid",
      "slug": "string",
      "title": "string",
      "difficulty": 3,
      "tags": ["array", "dp"],
      "visibility": "public",
      "score_total": 100,
      "author": { "username": "string" }
    }
  ],
  "total": 150,
  "page": 1,
  "per_page": 20
}
```

---

### `GET /api/problems/{slug}`

Detalii complete ale problemei, inclusiv enunț și cazuri de test publice.

**Răspuns `200`:**
```json
{
  "id": "uuid",
  "slug": "string",
  "title": "string",
  "statement_md": "string (Markdown + LaTeX)",
  "statement_md_en": "string (opțional)",
  "difficulty": 5,
  "tags": ["graph", "bfs"],
  "visibility": "public",
  "time_limit_ms": 1000,
  "memory_limit_kb": 65536,
  "score_total": 100,
  "comparison_mode": "whitespace_insensitive",
  "sample_test_cases": [
    {
      "ordinal": 1,
      "is_sample": true,
      "input_preview": "3 5\n1 2 3",
      "output_preview": "6"
    }
  ],
  "author": { "username": "string" }
}
```

---

### `POST /api/problems`

Creează o problemă nouă. **Autentificare:** Obligatorie.

**Body:**
```json
{
  "title": "string",
  "statement_md": "string",
  "difficulty": 5,
  "tags": ["dp", "greedy"],
  "visibility": "draft | public | private | contest",
  "time_limit_ms": 1000,
  "memory_limit_kb": 65536,
  "score_total": 100,
  "comparison_mode": "exact | whitespace_insensitive | float_epsilon"
}
```

**Răspuns `201`:** Obiect problemă complet.

---

### `PATCH /api/problems/{slug}`

Actualizează o problemă existentă. **Autentificare:** Autor sau admin.

**Body:** Orice câmpuri din `POST /api/problems` (parțial).

---

### `DELETE /api/problems/{slug}`

Șterge problema. **Autentificare:** Autor sau admin.

**Răspuns `204`.**

---

### `GET /api/problems/{slug}/test-cases`

Listează cazurile de test ale problemei. **Autentificare:** Autor sau admin.

---

### `POST /api/problems/{slug}/test-cases`

Adaugă un caz de test (upload fișiere `.in` și `.out`). **Autentificare:** Autor sau admin.

**Body:** `multipart/form-data` cu câmpurile `input_file` și `output_file`.

---

### `DELETE /api/problems/{slug}/test-cases/{ordinal}`

Șterge un caz de test. **Autentificare:** Autor sau admin.

---

### `GET /api/problems/{slug}/input/{ordinal}`

Descarcă fișierul `.in` pentru un caz de test public.

---

### `PUT /api/problems/{slug}/quiz-options`

Setează opțiunile quiz (întrebări cu răspuns multiplu). **Autentificare:** Autor sau admin.

---

### `POST /api/problems/{slug}/quiz-attempt`

Trimite un răspuns la quiz. **Autentificare:** Obligatorie.

**Răspuns `200`:**
```json
{
  "correct": true,
  "explanation": "string (opțional)"
}
```

---

## Submisii

### `POST /api/submissions`

Trimite o soluție pentru judecată. **Autentificare:** Obligatorie.

**Body:**
```json
{
  "problem_id": "uuid",
  "code": "string (cod sursă)",
  "language": "c | cpp | python | java | rust | go | javascript | kotlin | pypy"
}
```

**Răspuns `201`:**
```json
{
  "id": "uuid",
  "verdict": "pending",
  "score": 0,
  "created_at": "ISO8601"
}
```

---

### `GET /api/submissions`

Istoricul submisiilor utilizatorului curent. **Autentificare:** Obligatorie.

**Query params:** `problem_id`, `verdict`, `page`, `per_page`.

---

### `GET /api/submissions/{id}`

Detalii submisie cu rezultatele per test. **Autentificare:** Obligatorie.

**Răspuns `200`:**
```json
{
  "id": "uuid",
  "problem": { "slug": "string", "title": "string" },
  "code": "string",
  "language": "string",
  "verdict": "AC | WA | CE | TLE | MLE | RE | pending",
  "score": 100,
  "judged_at": "ISO8601",
  "results": [
    {
      "test_case_ordinal": 1,
      "verdict": "AC",
      "time_ms": 45,
      "memory_kb": 2048,
      "output_snippet": "6\n"
    }
  ]
}
```

---

## Concursuri

### `GET /api/contests`

Listează concursurile publice.

**Query params:** `status` (`upcoming | running | finished`), `page`, `per_page`.

---

### `GET /api/contests/{slug}`

Detalii concurs cu problemele incluse.

---

### `POST /api/contests`

Creează un concurs nou. **Autentificare:** Teacher sau admin.

**Body:**
```json
{
  "title": "string",
  "description": "string",
  "start_at": "ISO8601",
  "end_at": "ISO8601",
  "type": "contest | homework | qualifier",
  "is_public": true
}
```

---

### `POST /api/contests/{slug}/join`

Înscrie utilizatorul curent în concurs. **Autentificare:** Obligatorie.

---

### `GET /api/contests/{slug}/leaderboard`

Clasamentul concursului (snapshot).

---

### `WebSocket /api/contests/{slug}/leaderboard`

Clasament în timp real. Primești mesaje JSON la fiecare actualizare de scor:
```json
{
  "type": "leaderboard_update",
  "entries": [
    {
      "rank": 1,
      "username": "string",
      "total_score": 300,
      "penalty": 1200
    }
  ]
}
```

---

## Dueluri

### `POST /api/duels/requests`

Trimite o invitație de duel. **Autentificare:** Obligatorie.

**Body:**
```json
{
  "to_username": "string"
}
```

---

### `GET /api/duels/requests/pending`

Invitații primite și netratate. **Autentificare:** Obligatorie.

---

### `POST /api/duels/requests/{request_id}/accept`

Acceptă invitația și creează duelul. **Autentificare:** Obligatorie.

---

### `POST /api/duels/queue/join`

Intră în coada de matchmaking. **Autentificare:** Obligatorie.

---

### `DELETE /api/duels/queue/leave`

Ieși din coadă. **Autentificare:** Obligatorie.

---

### `GET /api/duels/{duel_id}`

Detalii duel curent.

---

### `POST /api/duels/{duel_id}/submit`

Trimite cod în contextul unui duel. **Autentificare:** Obligatorie.

---

### `POST /api/duels/{duel_id}/resign`

Abandonează duelul. **Autentificare:** Obligatorie.

---

### `WebSocket /api/duels/{duel_id}/ws`

Actualizări în timp real pentru duel. Evenimente posibile:

```json
{ "type": "submission_result", "user_id": "uuid", "verdict": "AC", "score": 100 }
{ "type": "draw_offered", "from_user_id": "uuid" }
{ "type": "draw_accepted" }
{ "type": "resign", "user_id": "uuid" }
{ "type": "duel_finished", "winner_id": "uuid", "elo_change": 15 }
```

---

## Lecții

### `GET /api/lessons`

Listează materialele didactice.

**Query params:** `difficulty`, `tags`, `page`, `per_page`.

---

### `GET /api/lessons/{slug}`

Conținut complet al lecției.

---

### `POST /api/lessons/{slug}/complete`

Marchează lecția ca finalizată. **Autentificare:** Obligatorie.

**Răspuns `200`:**
```json
{
  "completed_at": "ISO8601"
}
```

---

## Clase

### `POST /api/classrooms`

Creează o clasă nouă. **Autentificare:** Teacher sau admin.

**Body:**
```json
{
  "name": "string"
}
```

**Răspuns `201`:**
```json
{
  "id": "uuid",
  "name": "string",
  "code": "ABCD12",
  "teacher": { "username": "string" }
}
```

---

### `POST /api/classrooms/join`

Înscrie-te într-o clasă cu codul de acces. **Autentificare:** Obligatorie.

**Body:**
```json
{
  "code": "ABCD12"
}
```

---

### `GET /api/classrooms/{class_id}`

Detalii clasă (anunțuri, teme, membri). **Autentificare:** Membru sau teacher.

---

### `POST /api/classrooms/{class_id}/regenerate-code`

Generează un cod de acces nou. **Autentificare:** Teacher.

---

## Social

### `POST /api/social/friend-requests`

Trimite cerere de prietenie. **Autentificare:** Obligatorie.

**Body:**
```json
{
  "to_username": "string"
}
```

---

### `POST /api/social/friend-requests/{id}/accept`

Acceptă cererea de prietenie. **Autentificare:** Obligatorie.

---

### `GET /api/social/friends`

Lista prietenilor. **Autentificare:** Obligatorie.

---

### `GET /api/social/notifications`

Notificări necitite. **Autentificare:** Obligatorie.

---

### `POST /api/social/notifications/{id}/read`

Marchează notificarea ca citită. **Autentificare:** Obligatorie.

---

## Sistem

### `GET /api/health`

Starea serverului.

**Răspuns `200`:**
```json
{
  "status": "ok",
  "database": "connected",
  "piston": "reachable"
}
```

---

## Coduri de eroare

Toate erorile urmează formatul standard:

```json
{
  "detail": "Mesaj de eroare descriptiv"
}
```

| Cod HTTP | Semnificație |
|---|---|
| `400 Bad Request` | Date invalide în request |
| `401 Unauthorized` | Sesiune lipsă sau expirată |
| `403 Forbidden` | Permisiuni insuficiente |
| `404 Not Found` | Resursa nu există |
| `409 Conflict` | Conflict (username/email deja existent) |
| `422 Unprocessable Entity` | Eroare validare Pydantic |
| `429 Too Many Requests` | Rate limit depășit |
| `500 Internal Server Error` | Eroare server neașteptată |
