# Documentație ReInfo

## Instalare

**Cerințe:** Docker Engine 24+, Docker Compose v2.

```bash
git clone https://github.com/dragosgatan/reinfo.git
cd reinfo
docker compose up --build
```

| Serviciu | URL |
|---|---|
| Platformă | http://localhost:3000 |
| API (Swagger) | http://localhost:8000/api/docs |

La prima pornire:

```bash
# Aplică migrațiile bazei de date
docker compose exec backend alembic upgrade head

# Instalează runtime-urile pentru execuția codului
docker compose exec piston ppman install python=3.10.0
docker compose exec piston ppman install c++=10.2.0
docker compose exec piston ppman install c=10.2.0
docker compose exec piston ppman install java=15.0.2
docker compose exec piston ppman install rust=1.50.0
docker compose exec piston ppman install go=1.16.2
docker compose exec piston ppman install javascript=16.3.0
```

### Variabile de mediu

**Backend** (`.env`):

| Variabilă | Descriere |
|---|---|
| `DATABASE_URL` | Conexiune PostgreSQL — `postgresql+asyncpg://reinfo:reinfo@localhost:5432/reinfo` |
| `SECRET_KEY` | Cheie pentru sesiuni — generează cu `openssl rand -hex 32` |
| `PISTON_URL` | URL Piston — implicit `http://localhost:2000` |
| `ENVIRONMENT` | `development` sau `production` |

**Frontend** (`.env.local`):

| Variabilă | Descriere |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL API backend — implicit `http://localhost:8000` |
| `OPENROUTER_API_KEY` | Cheie pentru chatbot AI (opțional) |

---

## Ghid utilizator

### Cont

Apasă **Înregistrare**, completează username, email și parolă. Contul este activ imediat.

### Rezolvarea problemelor

1. Mergi la **Probleme** și filtrează după dificultate (1–10), etichete sau text.
2. Scrie codul în editorul Monaco și selectează limbajul.
3. Apasă **Trimite** — verdictul apare în câteva secunde.

Limbaje acceptate: **C, C++, Python, PyPy, Java, Kotlin, Rust, Go, JavaScript**

Folosește **stdin/stdout** — fără `freopen` sau fișiere.

| Verdict | Semnificație |
|---|---|
| AC | Toate testele trecute |
| WA | Output incorect |
| CE | Eroare de compilare |
| TLE | Depășit limita de timp |
| MLE | Depășit limita de memorie |
| RE | Eroare la execuție |

### Concursuri

Mergi la **Concursuri** → apasă **Participă** → rezolvă problemele în timpul alocat. Clasamentul se actualizează live.

### Dueluri

1v1 cu sistem **Elo** (rating inițial: 1200). Găsești adversar prin coadă automată sau invitație directă. Primul cu AC câștigă.

### Învățare

Lecții cu Markdown + LaTeX și chatbot AI integrat. Apasă **Marchează ca finalizat** pentru tracking pe profil.

### Clase

**Profesor:** creează clasa și distribuie codul de acces elevilor.
**Elev:** mergi la **Clase** → **Alătură-te** → introdu codul primit.

### Setări și profil

Din `/setari/profil`: schimbă poza, numele afișat, limba interfeței (română / engleză / maghiară) sau parola.

Profilul public (`/u/username`) afișează statistici, heatmap activitate și rating duel.
