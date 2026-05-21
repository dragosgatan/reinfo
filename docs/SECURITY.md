# Securitate – ReInfo

## Raportare vulnerabilități

Nu raporta public pe GitHub Issues. Trimite email la **gatan9dragos@gmail.com** cu subiectul `[SECURITY] <descriere>`. Răspuns în max 72 ore.

---

## Autentificare

**Cookie HTTP-only** — token-ul sesiunii nu este accesibil din JavaScript.

- `HttpOnly` — protecție XSS
- `SameSite=Strict` — protecție CSRF fără token separat
- `Secure` (producție) — doar HTTPS
- Expiră după 30 zile; invalidat explicit la logout
- Semnat cu `itsdangerous` folosind `SECRET_KEY`

**Parole:** hash bcrypt (12 runde), fără plaintext în logs.

**Roluri:**

| Rol | Permisiuni |
|---|---|
| `user` | Submisii, concursuri, duele, social |
| `teacher` | Creare clase, concursuri, probleme, lecții |
| `admin` | Toate + ștergere/modificare oricărei resurse |

---

## Rate limiting

| Endpoint | Limită |
|---|---|
| `POST /api/auth/register` | 5 / minut |
| `POST /api/auth/login` | 20 / minut |
| `POST /api/submissions` | 30 / minut |

Răspuns la depășire: `HTTP 429` cu header `Retry-After`.

---

## Execuție cod

Codul utilizatorilor rulează exclusiv în Piston:

- Namespace Linux izolat per execuție (PID, network, filesystem)
- Timeout și memory limit configurate per problemă
- Fără conectivitate externă în containerul Piston
- Portul 2000 **nu** este expus extern

---

## Validare input

- **Backend:** Pydantic v2 validează toate request body-urile
- **Frontend:** Zod validează răspunsurile API; React Hook Form validează formularele
- **SQL Injection:** imposibil — SQLAlchemy cu parametri legați, fără SQL raw din input
- **Path traversal:** căile de fișiere sunt construite din UUID-uri, nu din input utilizator

---

## Checklist producție

- [ ] `SECRET_KEY` generat aleatoriu (`openssl rand -hex 32`)
- [ ] `ENVIRONMENT=production`
- [ ] `ALLOWED_ORIGINS` limitat la domeniul de producție
- [ ] Credențiale PostgreSQL schimbate față de defaults
- [ ] HTTPS configurat cu certificat valid
- [ ] Portul Piston (2000) **nu** expus extern
- [ ] `DATA_DIR` pe volum persistent cu backup
