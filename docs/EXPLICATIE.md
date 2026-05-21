# ReInfo
**O platformă modernă — pentru că informatica merită.**

---

## De ce ReInfo?

- Programa de informatică din România tranziționează de la C++ la Python.
- Platformele existente de informatică sunt învechite și nu sunt deloc atractive pentru elevi.
- Într-o lume aflată într-o continuă schimbare și în mijlocul erei AI, programarea este o competență deosebit de importantă.
- Această perioadă în timp reprezintă o mare oportunitate de a crește interesul elevilor în acest domeniu.
- Platformele existente au adăugat Python ca să bifeze o căsuță. ReInfo a fost construit cu Python ca limbaj principal de la zero.

---

## Rezolvarea propusă

Propunem platforma web **ReInfo**, un epicentru al programării competitive, învățării și pregătirii pentru olimpiadele de sub umbrela informaticii.

- Ideea din spate e că mulți elevi renunță la informatică nu pentru că e grea, ci pentru că **pare plictisitoare sau solitară** — stai singur, rezolvi exerciții, nu se întâmplă nimic. Funcțiile sociale și gamification sunt o încercare să schimbe asta.
- Restul platformelor arată și se comportă ca în 2012 — interfață veche, editor de cod rudimentar, trimiți codul și aștepți să dai refresh. **ReInfo a fost gândit altfel de la început**, nu peticit pe un cod vechi.

---

## Interfața

- Interfața e curată și ușoară pe ochi. **Dark mode și light mode** cu toggle în header; pe dark, fundalul e aproape negru, contrastul e bun — poți sta la rezolvat probleme ore întregi fără să obosești.
- Layoutul se adaptează de la **320px** în sus datorită Tailwind CSS. Pe ecrane mici nimic nu dispare sau se taie, totul se reorganizează ca să rămână utilizabil.
- Platforma are **trei limbi disponibile**: română, engleză și maghiară. Engleza și maghiara acoperă elevii pentru care româna nu e prima limbă, cu selector în header.
- Codul se scrie direct în browser prin **Monaco Editor** — același motor folosit de Visual Studio Code — fără fișiere de descărcat sau uplodat. Oferă auto-closing brackets, autocomplete și syntax highlighting.
- Navigație intuitivă: **Probleme, Concursuri, Învățare, Clasament** — toate accesibile din header.
- Keyboard navigation și ARIA labels complete, accesibil pentru utilizatori cu nevoi speciale (**WCAG AA**).
- **Feedback imediat**: SSE streaming pentru verdictul submisiei (nu trebuie să dai refresh).

---

## Conținut

- **Judging real-time** în 8 limbaje: C, C++, Python, Java, Kotlin, Rust, Go, JavaScript.
- **Dueluri 1v1** cu timer, sistem de rating Elo, buton de remiză — utilizatorul este participant activ, nu observator pasiv.
- **Concursuri** cu clasament live actualizat în timp real.
- Paginile de învățare includ un **agent AI** care poate rezuma lecțiile și explica concepte mai în detaliu la cerere.
- Grilele vin cu **explicații după submit** — nu doar răspunsul corect, ci și de ce este corect. Pot fi integrate ca exerciții în pagina de probleme sau în lecții.
- **Cod Python rulabil direct** în paginile de lecție via Pyodide — experimentezi fără să pleci din browser.
- **Gamification**: badge-uri de realizări, clasamente săptămânale și all-time.
- Profesorii și adminii pot adăuga probleme, concursuri și lecții **direct din interfață**, fără acces la cod sau bază de date.
- Comparare output cu **3 moduri**: exact, whitespace-insensitive, float epsilon.
- La crearea conținutului, platforma oferă **traducere automată prin AI** între limbile disponibile.

---

## Anti-Cheat & Integritate

- Submisiile suspecte (trimitere în primele secunde, structură neobișnuită) sunt **marcate automat pentru review manual**.
- Blocarea copy-paste și modul fullscreen pot fi **activate opțional** de organizator.
- **Browser fingerprinting** identifică încercările de acces de pe mai multe dispozitive în același timp.

---

## Stivă Tehnică

| Componentă | Tehnologie |
|---|---|
| Backend | FastAPI (Python) |
| Frontend | Next.js + TypeScript |
| Bază de date | PostgreSQL |
| Execuție cod | Piston (sandbox Docker izolat, 9 limbaje) |
| Autentificare | Sesiuni cu HTTP-only cookies |
| Comunicare real-time | SSE + WebSocket |

---

## Arhitectură & Implementare

- Codul e organizat într-un **monorepo** cu backend și frontend separate, ușor de navigat și de lucrat pe ambele în același timp.
- Backendul e împărțit în **module cu responsabilitate unică**: `auth`, `problems`, `submissions`, `judging`, `piston`, `contests`, `duels`. Fiecare modul poate fi modificat fără să atingi restul.
- Frontendul folosește **react-query** pentru date server-side, cu invalidare automată când ceva se schimbă — nu există stale data afișat utilizatorului.
- **Verdictele** vin prin SSE (conexiune unidirecțională); **duelurile și notificările** prin WebSocket (comunicare bidirecțională în timp real).
- **Type hints** în tot codul Python, **TypeScript strict** pe frontend — codul se documentează singur, refactoring-ul nu sparge nimic pe ascuns.
- Logica de judging e separată în `judging.py` și `piston.py` — dacă vrei să adaugi un nou limbaj sau un nou verdict, modifici un singur fișier.
- **Linting automat** în CI cu `ruff` și ESLint — codul arată la fel indiferent cine l-a scris.
- Variabilele și funcțiile sunt denumite descriptiv + **docstrings** pentru toate funcțiile și clasele publice (ex: `submission_result`).

---

## Testare & Versionare

- `pytest` acoperă **endpoint-urile critice** de backend (auth, submissions, judging).
- Dependențele externe sunt **simulate în teste** — testele sunt izolate și nu depind de disponibilitatea unor servicii externe.
- **GitHub Actions** rulează automat testele și linting-ul la fiecare push.
- Fișierele sensibile sunt excluse din repo prin `.gitignore` configurat de la primul commit.

---

## În Producție & Securitate

- Aplicația este **live la [reinfo.dev](https://reinfo.dev)** cu utilizatori reali și submisii active.
- Deployment cu **Docker multi-stage** în producție, backup-uri nocturn ale bazei de date și monitorizare a erorilor prin **Sentry**.
- Parolele sunt hashuite cu **bcrypt**, sesiunile folosesc HTTP-only cookies, iar **rate limiting**-ul protejează endpoint-urile de autentificare.
- Execuția codului utilizatorilor rulează exclusiv în **sandbox Docker izolat**, fără acces la filesystem sau rețea externă.
- Toate inputurile sunt validate cu **Pydantic** pe backend și **Zod** pe frontend înainte de procesare.

---

## Echipă

**Colegiul Național "Gheorghe Șincai"**

| Nume | Clasă | Rol |
|---|---|---|
| Gâțan Dragoș-Andrei | IX C | Full Stack Developer |
| Mînăilă Filip Alexandru | IX D | Frontend Developer, Bug Hunting |

---

## Linkuri

- **Cod sursă**: [github.com/dragosgatan/reinfo](https://github.com/dragosgatan/reinfo)
- **Site live**: [reinfo.dev](https://reinfo.dev)
