# Politică de securitate – ReInfo

## Raportarea vulnerabilităților

Dacă ai descoperit o vulnerabilitate de securitate în ReInfo, te rugăm să **nu** o raportezi public pe GitHub Issues.

Trimite un email la **gatan9dragos@gmail.com** cu subiectul `[SECURITY] <descriere scurtă>`. Încearcă să incluzi:

- Descrierea vulnerabilității
- Pași de reproducere
- Impactul potențial
- Sugestii de remediere (opțional)

Vei primi un răspuns în cel mult 72 de ore. Vulnerabilitățile valide vor fi remediate înainte de divulgarea publică.

---

## Model de autentificare

### Cookie-uri HTTP-only

Sesiunile sunt gestionate exclusiv prin cookie-uri HTTP-only:

- **`HttpOnly`** — cookie-ul nu este accesibil din JavaScript; protejează împotriva atacurilor XSS
- **`SameSite=Strict`** — cookie-ul nu este trimis în cereri cross-site; elimină necesitatea unui token CSRF separat
- **`Secure`** (producție) — cookie-ul este trimis doar pe HTTPS
- Expiră după 30 de zile; sesiunea este invalidată explicit la logout

Tokenul de sesiune este semnat cu `itsdangerous` folosind `SECRET_KEY`. Valoarea secretă nu este niciodată expusă clientului.

### Parole

- Hash bcrypt cu cost factor implicit (12 runde)
- Nicio parolă nu este stocată în plaintext sau logată
- Verificarea se face cu `bcrypt.checkpw()` (constant-time comparison)

### Roluri

| Rol | Permisiuni |
|---|---|
| `user` | Trimitere soluții, participare la concursuri, duele, social |
| `teacher` | Creare clase, concursuri, probleme, lecții |
| `admin` | Toate permisiunile + ștergere/modificare oricărei resurse |

---

## Rate limiting

SlowAPI aplică limite per IP:

| Endpoint | Limită |
|---|---|
| `POST /api/auth/register` | 5 / minut |
| `POST /api/auth/login` | 20 / minut |
| `POST /api/submissions` | 30 / minut |

La depășirea limitei: `HTTP 429 Too Many Requests` cu header `Retry-After`.

---

## CORS

Originile permise sunt configurate prin variabila de mediu `ALLOWED_ORIGINS`:

```
ALLOWED_ORIGINS=["https://reinfo.ro"]
```

Implicit (development): `["http://localhost:3000"]`.

Credentialele (cookies) sunt permise numai pentru originile listate explicit.

---

## Execuție cod (Piston)

Codul utilizatorilor rulează exclusiv în containerul Piston:

- **Izolat** — fiecare execuție rulează în propriul namespace Linux (PID, network, filesystem)
- **Timp limitat** — timeout configurat per problemă (implicit 1000 ms)
- **Memorie limitată** — limit configurat per problemă (implicit 64 MB)
- **Fără acces la rețea** — containerul Piston nu are conectivitate externă
- **Portul 2000 nu este expus extern** — Piston este accesibil doar intern din rețeaua Docker

Niciun cod de utilizator nu rulează pe procesul FastAPI sau pe mașina host.

---

## Stocare fișiere

Fișierele `.in`/`.out` (cazuri de test) și avatarele sunt stocate pe disc local în `DATA_DIR`:

- Accesul la fișierele de test este restricționat la utilizatori autentificați cu rol corespunzător
- Avatarele sunt servite static; numele fișierelor sunt derivate din UUID-ul utilizatorului (nu din input)
- Nu se execută niciun fișier încărcat de utilizatori

---

## Validare input

- **Backend:** Pydantic v2 validează toate body-urile de request; câmpurile neașteptate sunt ignorate
- **Frontend:** Zod validează datele API înainte de randare; React Hook Form validează formularele
- **SQL Injection:** Imposibil prin SQLAlchemy ORM cu parametri legați; niciun SQL raw construit din input utilizator
- **Path traversal:** Căile de fișiere sunt construite exclusiv din UUID-uri (nu din input utilizator)

---

## Dependințe

Dependințele sunt gestionate prin `uv` (Python) și `npm` (Node.js). Rulează periodic:

```bash
# Backend – verifică vulnerabilități cunoscute
pip-audit

# Frontend
npm audit
```

CI-ul nu rulează `audit` automat, dar se recomandă înainte de fiecare release.

---

## Configurare producție

Lista de verificare minimă înainte de deployment:

- [ ] `SECRET_KEY` generat aleatoriu (`openssl rand -hex 32`)
- [ ] `ENVIRONMENT=production` setat
- [ ] `ALLOWED_ORIGINS` limitat la domeniul de producție
- [ ] Credențiale PostgreSQL schimbate față de defaults
- [ ] HTTPS configurat (reverse proxy cu certificat valid)
- [ ] Portul Piston (2000) **nu** este expus extern
- [ ] `DATA_DIR` montat pe volum persistent cu backup
- [ ] Loguri activate și monitorizate
