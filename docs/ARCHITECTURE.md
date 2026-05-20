# Arhitectura ReInfo

## Cuprins

- [Prezentare generală](#prezentare-generală)
- [Diagrama serviciilor](#diagrama-serviciilor)
- [Flux de cereri HTTP](#flux-de-cereri-http)
- [Pipeline de judecată](#pipeline-de-judecată)
- [Arhitectura WebSocket](#arhitectura-websocket)
- [Schema bazei de date](#schema-bazei-de-date)
- [Stiva tehnologică – justificări](#stiva-tehnologică--justificări)
- [Structura codului](#structura-codului)

---

## Prezentare generală

ReInfo este un monorepo cu trei componente principale care comunică prin HTTP și WebSocket:

- **Frontend** – Next.js 14 (App Router), servit pe portul 3000
- **Backend** – FastAPI (Python 3.11+), servit pe portul 8000
- **Worker** – proces Python separat care procesează coada de judecată
- **Piston** – motor sandbox de execuție cod (Docker), portul 2000
- **PostgreSQL 16** – baza de date principală, portul 5432

---

## Diagrama serviciilor

```mermaid
graph TB
    Browser["🌐 Browser\n(utilizator)"]
    FE["Frontend\nNext.js :3000"]
    BE["Backend\nFastAPI :8000"]
    WK["Worker\n(judecator)"]
    PS["Piston\n(sandbox) :2000"]
    DB["PostgreSQL\n:5432"]
    FS["Disc local\n(data/)"]

    Browser <-->|"HTTP / WebSocket"| FE
    FE <-->|"REST API\n/api/*"| BE
    FE <-->|"WebSocket\n/ws/*"| BE
    BE <-->|"SQLAlchemy\nasync"| DB
    BE <-->|"Fișiere\n.in/.out"| FS
    WK <-->|"SQLAlchemy\nasync"| DB
    WK <-->|"Fișiere\n.in/.out"| FS
    WK <-->|"HTTP POST\n/api/execute"| PS
    BE <-.->|"NOTIFY/LISTEN\n(PostgreSQL)"| WK
```

---

## Flux de cereri HTTP

Cerere tipică de la browser la baza de date:

```mermaid
sequenceDiagram
    participant B as Browser
    participant FE as Next.js
    participant BE as FastAPI
    participant DB as PostgreSQL

    B->>FE: GET /ro/probleme/suma-a-b
    FE->>BE: GET /api/problems/suma-a-b
    BE->>DB: SELECT * FROM problems WHERE slug='suma-a-b'
    DB-->>BE: Problem row
    BE-->>FE: ProblemDetail JSON
    FE-->>B: Server Component HTML + hydration

    B->>FE: POST /submit (cod sursă)
    FE->>BE: POST /api/submissions
    BE->>DB: INSERT INTO submissions
    BE->>DB: INSERT INTO judging_jobs (status=queued)
    BE-->>FE: {submission_id, status: "queued"}
    FE-->>B: Toast "Soluție trimisă"
```

---

## Pipeline de judecată

Fluxul complet de la trimiterea codului la afișarea verdictului:

```mermaid
sequenceDiagram
    participant U as Utilizator
    participant BE as Backend
    participant DB as PostgreSQL
    participant WK as Worker
    participant PS as Piston

    U->>BE: POST /api/submissions\n{code, language, problem_id}
    BE->>DB: INSERT submission (verdict=pending)
    BE->>DB: INSERT judging_job (status=queued)
    BE-->>U: {id, verdict: "pending"}

    loop Polling la 0.5s
        WK->>DB: SELECT FOR UPDATE SKIP LOCKED\n(jobs WHERE status=queued)
        DB-->>WK: JudgingJob
    end

    WK->>DB: UPDATE job (status=running)

    loop Pentru fiecare test case
        WK->>DB: SELECT test_case (.in file path)
        WK->>PS: POST /api/execute\n{language, code, stdin}
        PS-->>WK: {stdout, stderr, time_ms, memory_kb}
        WK->>WK: Compară stdout vs .out\n(exact / whitespace / float_epsilon)
        WK->>DB: INSERT submission_result\n(verdict, time_ms, memory_kb)
    end

    WK->>DB: UPDATE submission (verdict, score)
    WK->>DB: UPDATE job (status=done)
    WK->>DB: NOTIFY reinfo_submission {submission_id}

    BE->>DB: LISTEN reinfo_submission
    DB-->>BE: Notificare
    BE-->>U: WebSocket push\n{verdict, score, results}
```

### Tipuri de verdicte

| Verdict | Cod | Condiție |
|---|---|---|
| Accepted | `AC` | Toate testele trecute |
| Wrong Answer | `WA` | Output diferit de cel corect |
| Compile Error | `CE` | Piston raportează eroare de compilare |
| Time Limit Exceeded | `TLE` | Timp de execuție > limita problemei |
| Memory Limit Exceeded | `MLE` | Memorie folosită > limita problemei |
| Runtime Error | `RE` | Segfault, excepție, exit code != 0 |

### Moduri de comparare output

| Mod | Comportament |
|---|---|
| `exact` | Comparare byte cu byte |
| `whitespace_insensitive` | Ignoră spații extra și newline-uri |
| `float_epsilon` | Parsează numerele float, toleranță ±10⁻⁶ |

---

## Arhitectura WebSocket

ReInfo folosește WebSocket-uri pentru actualizări în timp real. Sincronizarea între procese se face prin PostgreSQL `NOTIFY/LISTEN` — fără Redis sau alt broker.

```mermaid
graph LR
    subgraph "Proces FastAPI"
        LH["LeaderboardHub\n(abonați concurs)"]
        DH["DuelHub\n(room duel)"]
        NH["NotificationHub\n(per utilizator)"]
        CH["ClassChatHub\n(per clasă)"]
        PL["PostgreSQL\nLISTEN loop"]
    end

    subgraph "Proces Worker"
        WK["Worker\n(judecator)"]
    end

    B1["Browser 1\n(spectator concurs)"]
    B2["Browser 2\n(participant duel)"]
    B3["Browser 3\n(notificări)"]

    WK -->|"NOTIFY reinfo_leaderboard"| DB[(PostgreSQL)]
    WK -->|"NOTIFY reinfo_duel"| DB
    PL <-->|"LISTEN"| DB
    PL --> LH
    PL --> DH
    PL --> NH

    B1 <-->|"WS /api/contests/{slug}/leaderboard"| LH
    B2 <-->|"WS /api/duels/{id}/ws"| DH
    B3 <-->|"WS /api/social/notifications/ws"| NH
```

### Canale NOTIFY

| Canal | Emis de | Primit de | Conținut |
|---|---|---|---|
| `reinfo_submission` | Worker | Backend | `{submission_id, verdict}` |
| `reinfo_leaderboard` | Backend | LeaderboardHub | `{contest_id, user_id, score}` |
| `reinfo_duel` | Backend/Worker | DuelHub | `{duel_id, event, payload}` |
| `reinfo_notifications` | Backend | NotificationHub | `{user_id, notification}` |
| `reinfo_class_chat` | Backend | ClassChatHub | `{class_id, message}` |

---

## Schema bazei de date

```mermaid
erDiagram
    users {
        uuid id PK
        string username UK
        string email UK
        string password_hash
        string display_name
        string language
        int duel_rating
        enum role
        timestamp created_at
    }

    problems {
        uuid id PK
        string slug UK
        string title
        text statement_md
        text statement_md_en
        int difficulty
        string tags
        enum visibility
        int time_limit_ms
        int memory_limit_kb
        enum comparison_mode
        uuid author_id FK
    }

    submissions {
        uuid id PK
        uuid user_id FK
        uuid problem_id FK
        text code
        string language
        enum verdict
        int score
        timestamp judged_at
    }

    submission_results {
        uuid id PK
        uuid submission_id FK
        uuid test_case_id FK
        enum verdict
        int time_ms
        int memory_kb
        string output_snippet
    }

    contests {
        uuid id PK
        string slug UK
        string title
        timestamp start_at
        timestamp end_at
        enum type
        uuid created_by FK
        bool is_public
    }

    duels {
        uuid id PK
        uuid user1_id FK
        uuid user2_id FK
        uuid problem_id FK
        enum status
        uuid winner_id FK
        int user1_score
        int user2_score
    }

    lessons {
        uuid id PK
        string slug UK
        string title
        text content_md
        text content_md_en
        int difficulty
        uuid author_id FK
    }

    classes {
        uuid id PK
        string name
        string code UK
        uuid teacher_id FK
    }

    users ||--o{ submissions : "trimite"
    problems ||--o{ submissions : "primeşte"
    submissions ||--o{ submission_results : "are"
    users ||--o{ duels : "participă"
    problems ||--o{ duels : "folosit în"
    users ||--o{ lessons : "creează"
    users ||--o{ classes : "predă"
```

---

## Stiva tehnologică – justificări

### Backend: FastAPI (Python 3.11+)

- **Async-first** – `asyncpg` + `aiofiles` pentru I/O concurent fără blocare; esențial pentru WebSocket-uri și polling-ul workerului
- **OpenAPI automat** – fiecare endpoint este documentat fără efort suplimentar; folosit de evaluatorii InfoEducație pentru verificarea API-ului
- **Pydantic v2** – validare la runtime + generare de scheme JSON automate; tipuri partajate cu frontend-ul prin Zod

### ORM: SQLAlchemy 2.0 + Alembic

- **API declarativ async** – sesiuni async cu `AsyncSession`, query-uri type-safe
- **Alembic** – migrații versionate, history reproducibil; critică pentru un proiect cu schema în continuă evoluție
- Alternativa (`SQLModel`) nu suporta complet async la momentul alegerii

### Baza de date: PostgreSQL 16

- **ACID** – esențial pentru scoring corect la concursuri
- **`NOTIFY/LISTEN`** – sincronizare cross-proces fără Redis; simplifică infrastructura
- **`SELECT FOR UPDATE SKIP LOCKED`** – job queue robustă fără un broker extern
- **jsonb** – stocare flexibilă pentru metadata (tags, opțiuni quiz)

### Frontend: Next.js 14 (App Router)

- **Server Components** – pagini publice (probleme, concursuri) indexabile SEO fără JS suplimentar în browser
- **Client Components** – editor Monaco, WebSocket-uri, formulare interactive unde e nevoie
- **File-based routing** – corespunde direct URL-urilor platformei; ușor de navigat
- **Built-in i18n support** – `next-intl` integrat nativ cu App Router

### Styling: Tailwind CSS + shadcn/ui

- **Tailwind** – design tokens consistente, zero runtime CSS; bundle mic
- **shadcn/ui** – componente accesibile (Radix UI) fără o dependință suplimentară de runtime; codul componentelor e în repo și poate fi modificat
- **Nu**: Bootstrap, MUI, Chakra — prea opinionated pentru designul editorial dorit

### Editor: Monaco Editor

- Același engine ca VS Code — utilizatorii cunosc deja interfața
- Suportă 50+ limbaje out-of-the-box
- `@monaco-editor/react` — integrare simplă în React

### Auth: itsdangerous + HTTP-only cookies

- **Fără JWT** — token-urile JWT în `localStorage` sunt vulnerabile la XSS; cookie-urile HTTP-only nu sunt accesibile din JavaScript
- **`SameSite=Strict`** — protecție CSRF fără un token separat
- **itsdangerous** — semnare + verificare rapidă, fără dependință externă

### Execuție cod: Piston

- **Sandbox Docker** — fiecare execuție rulează izolat, fără acces la sistemul host
- **Multi-limbaj** — C, C++, Python, Java, Rust, Go, JavaScript, Kotlin, PyPy
- **REST API simplu** — `POST /api/execute` cu `{code, language, stdin}` → `{stdout, stderr, time_ms}`
- Self-hosted — nu există costuri per-execuție și datele nu ies din infrastractura proprie

---

## Structura codului

```
reinfo/
├── backend/
│   ├── app/
│   │   ├── main.py          # Inițializare FastAPI, înregistrare routere, lifespan
│   │   ├── config.py        # Pydantic Settings (variabile de mediu)
│   │   ├── db.py            # Engine async + factory sesiuni
│   │   ├── security.py      # bcrypt, generare token sesiune
│   │   ├── dependencies.py  # get_current_user, get_db (DI FastAPI)
│   │   ├── judging.py       # Logică de comparare output, calcul scor
│   │   ├── worker.py        # Job processor (polling, Piston, Elo)
│   │   ├── realtime.py      # WebSocket hubs, NOTIFY listener
│   │   ├── piston.py        # Client HTTP Piston
│   │   ├── storage.py       # Scriere/citire fișiere .in/.out
│   │   ├── models/          # SQLAlchemy ORM (11 entități)
│   │   ├── routers/         # Handlere HTTP (8 routere, 80+ endpoint-uri)
│   │   └── schemas/         # Pydantic request/response (validare + serializare)
│   └── tests/               # pytest (11 fișiere, 300+ teste)
├── frontend/
│   └── src/
│       ├── app/[locale]/    # Pagini Next.js (App Router, i18n)
│       ├── components/      # Componente UI reutilizabile (shadcn + custom)
│       ├── lib/
│       │   ├── api.ts       # Fetch wrapper cu validare Zod
│       │   ├── types.ts     # Scheme Zod pentru toate tipurile API
│       │   └── use-*.ts     # React hooks (WebSocket, query, auth)
│       └── messages/        # Fișiere traduceri (ro.json, en.json)
├── data/                    # .in/.out, avatare (gitignored)
├── docs/                    # Documentație
└── .github/workflows/ci.yml # CI: pytest + ruff + ESLint + tsc + build
```
