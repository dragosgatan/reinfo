# Ghid utilizator – ReInfo

Bine ai venit pe **ReInfo**, platforma românească de programare competitivă! Acest ghid îți explică cum să folosești toate funcționalitățile platformei.

## Cuprins

- [Crearea unui cont](#crearea-unui-cont)
- [Navigarea platformei](#navigarea-platformei)
- [Rezolvarea problemelor](#rezolvarea-problemelor)
- [Concursuri](#concursuri)
- [Dueluri](#dueluri)
- [Materiale de învățare](#materiale-de-învățare)
- [Clase](#clase)
- [Profil și social](#profil-și-social)
- [Setări](#setări)
- [Întrebări frecvente](#întrebări-frecvente)

---

## Crearea unui cont

1. Apasă **Înregistrare** din colțul din dreapta sus.
2. Completează:
   - **Nume utilizator** (3-30 caractere, alfanumeric)
   - **Email** (pentru recuperarea parolei)
   - **Parolă** (minimum 8 caractere)
   - **Nume afișat** (opțional — cum vrei să apari pe platformă)
3. Apasă **Creează cont**.

Contul este activat imediat. Nu este necesară confirmarea prin email.

---

## Navigarea platformei

Bara de navigare din partea de sus conține:

| Secțiune | Descriere |
|---|---|
| **Probleme** | Catalog de probleme de algoritmică |
| **Concursuri** | Concursuri active și arhivă |
| **Dueluri** | Confruntări 1v1 cu sistem Elo |
| **Învățare** | Materiale didactice organizate pe teme |
| **Clase** | Grupuri pentru profesori și elevi |
| **Prieteni** | Lista de prieteni și activitate |

Platforma este disponibilă în **română** (implicit) și **engleză**. Schimbă limba din meniu sau din setările profilului.

---

## Rezolvarea problemelor

### Găsirea unei probleme

1. Mergi la **Probleme** (`/probleme`).
2. Filtrează după:
   - **Dificultate** (1 = ușor, 10 = olimpiadă internațională)
   - **Etichete** (array, dp, graph, greedy, math, strings etc.)
   - **Căutare text** în titlu și enunț
3. Apasă pe o problemă pentru a o deschide.

### Pagina problemei

O problemă conține:
- **Enunț** — formulat în Markdown, cu formule matematice (LaTeX)
- **Restricții** — limite de timp și memorie
- **Date de intrare/ieșire** — format și exemple interactive
- **Editor de cod** — Monaco Editor (același ca VS Code)

### Trimiterea unei soluții

1. **Scrie codul** în editorul Monaco.
2. **Selectează limbajul** din lista derulantă:
   - C, C++, Python, Java, Rust, Go, JavaScript, Kotlin, PyPy
3. **Apasă Trimite**.
4. Soluția este judecată automat pe toate cazurile de test. Rezultatul apare în câteva secunde.

### Verdicte posibile

| Verdict | Semnificație |
|---|---|
| **AC** (Accepted) | Toate testele trecute — felicitări! |
| **WA** (Wrong Answer) | Output-ul nu corespunde cu răspunsul corect |
| **CE** (Compile Error) | Eroare de compilare/sintaxă în codul tău |
| **TLE** (Time Limit Exceeded) | Codul a depășit limita de timp |
| **MLE** (Memory Limit Exceeded) | Codul a depășit limita de memorie |
| **RE** (Runtime Error) | Eroare la execuție (segfault, excepție etc.) |

### Reguli importante

- **Intrare/ieșire standard** — folosește `cin`/`scanf` și `cout`/`printf` în C/C++; `input()`/`print()` în Python. Nu folosi `freopen` sau fișiere.
- **Nu** copia soluții din surse externe — platforma este pentru învățare.
- Poți trimite oricâte soluții pentru aceeași problemă.

---

## Concursuri

### Participarea la un concurs

1. Mergi la **Concursuri** (`/concursuri`).
2. Apasă pe un concurs activ și apasă **Participă**.
3. Rezolvă problemele în timpul alocat.
4. Clasamentul se actualizează **în timp real** — îl poți urmări în tab-ul **Clasament**.

### Tipuri de concursuri

| Tip | Descriere |
|---|---|
| **Concurs** | Competiție cu timp fix, clasament public |
| **Temă** | Problemă/set de probleme cu termen (creat de profesor) |
| **Calificativă** | Rundă de selecție |

### Reguli de scoring

- Fiecare problemă are un punctaj maxim.
- Scorul este proporțional cu testele trecute.
- În caz de egalitate de scor, departajarea se face prin timp de submit (penalty).

---

## Dueluri

Duelurile sunt confruntări **1 contra 1** în timp real, cu sistem de rating **Elo** (similar șahului).

### Cum funcționează

1. Mergi la **Dueluri** (`/duel`).
2. Alege modul de căutare:
   - **Coadă automată** — ești pereche cu un adversar de nivel similar
   - **Invitație directă** — caută un utilizator și trimite-i o provocare
3. Când duelul începe, ambii jucători primesc aceeași problemă.
4. Primul care obține **AC** câștigă.
5. Dacă nimeni nu rezolvă, câștigă cel cu scorul parțial mai mare.

### Rating Elo

- Rating inițial: **1200**
- Câștigul/pierderea de puncte depinde de diferența de rating față de adversar
- Rating-ul se actualizează imediat după terminarea duelului
- Poți vedea istoricul ratingului pe profilul tău

### Regulile duelului

- Poți propune **remiză** (`Oferă remiză`) — adversarul poate accepta sau refuza
- Poți **abandona** (`Abandonează`) — adversarul câștigă automat
- Duelul are un **timp maxim** (30 de minute implicit); la expirare câștigă cel cu scorul mai mare

---

## Materiale de învățare

Secțiunea **Învățare** (`/invatare`) conține lecții structurate pe teme algoritmice.

### Parcurgerea unei lecții

1. Alege o lecție din catalog.
2. Conținutul include text, cod exemplu și exerciții interactive.
3. Formulele matematice sunt randate cu LaTeX.
4. La finalul lecției, apasă **Marchează ca finalizat** pentru a o marca în progresul tău.

### Asistentul AI

Fiecare lecție are un **chatbot AI** integrat. Poți întreba:
- „Explică-mi pasul 3 din algoritm"
- „De ce complexitatea este O(n log n)?"
- „Arată-mi un exemplu mai simplu"

Răspunsurile sunt contextualizate la lecția curentă.

### Progresul tău

Lecțiile finalizate apar marcate cu ✓ în catalog și pe profilul tău public.

---

## Clase

Clasele sunt spații dedicate pentru **profesori și elevi**.

### Profesori — cum să creezi o clasă

1. Mergi la **Clase** (`/clase`).
2. Apasă **Clasă nouă** și introdu un nume.
3. Distribuie codul de acces elevilor (exemplu: `ABCD12`).
4. Din dashboard-ul clasei poți:
   - Posta **anunțuri**
   - Crea **teme** (set de probleme cu termen)
   - Discuta în **chat** cu elevii
   - Vedea progresul individual al fiecărui elev

### Elevi — cum să te înscrii

1. Mergi la **Clase** și apasă **Alătură-te**.
2. Introdu codul de acces primit de la profesor.
3. Vei vedea anunțurile, temele active și chat-ul clasei.

### Mesaje directe

Poți trimite **mesaje private** oricărui coleg sau profesor din clasă prin butonul de mesaj de pe profilul acestuia.

---

## Profil și social

### Profilul tău public

Profilul tău (`/u/username`) afișează:
- **Statistici** — număr de probleme rezolvate, rating duel, participări la concursuri
- **Heatmap activitate** — vizualizare GitHub-style a submisiilor din ultimele 12 luni
- **Probleme rezolvate** — lista cu verdictele
- **Lecții finalizate**

### Prietenii

1. Caută un utilizator după username.
2. Apasă **Adaugă prieten** pe profilul lui.
3. El primește o notificare și poate accepta sau refuza.
4. Prietenii apar în lista ta de la `/prieteni` și în filtrele de clasament.

### Notificări

Pictograma de clopoțel din bara de navigare afișează notificări pentru:
- Cereri de prietenie primite
- Invitații la duel
- Actualizări din clasele tale

---

## Setări

Din **Setări** (`/setari/profil`) poți:

- **Schimba poza de profil** (upload imagine)
- **Modifica numele afișat**
- **Schimba limba** interfeței (română / engleză)
- **Schimba parola**

---

## Întrebări frecvente

**De ce primesc CE deși codul compilează pe calculatorul meu?**
Verifică că folosești standardul corect. Exemplu pentru C++: compilatorul platformei poate folosi `-std=c++17`. Evită extensii non-standard ale compilatorului.

**Cât durează judecarea soluțiilor?**
De obicei 2-10 secunde, în funcție de numărul de cazuri de test și încărcarea serverului.

**Pot vedea cazurile de test pe care am greșit?**
Cazurile de test publice (exemple) sunt vizibile în enunț. Cazurile private nu sunt afișate — aceasta este o decizie intenționată pentru a evita rezolvarea prin memorare.

**Limita de timp este strictă?**
Da. Dacă primești TLE, optimizează algoritmul, nu codul la nivel de micro-optimizări.

**Pot folosi orice limbaj de programare?**
Limbajele acceptate sunt: **C, C++, Python, PyPy, Java, Kotlin, Rust, Go, JavaScript**.

**Nu pot trimite soluție la o problemă dintr-un concurs activ.**
Trebuie să te înscrii mai întâi la concurs apăsând **Participă** pe pagina concursului.

**Cum resetez parola?**
Funcționalitatea de resetare parolă prin email nu este disponibilă momentan. Contactează administratorul la `gatan9dragos@gmail.com`.
