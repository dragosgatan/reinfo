# Ghid utilizator – ReInfo

## Cont

1. Apasă **Înregistrare** din colțul din dreapta sus.
2. Completează username (3-30 caractere), email, parolă (min 8 caractere) și opțional un nume afișat.
3. Contul este activ imediat — nu necesită confirmare email.

---

## Navigare

| Secțiune | URL | Descriere |
|---|---|---|
| Probleme | `/probleme` | Catalog de probleme |
| Concursuri | `/concursuri` | Concursuri active și arhivă |
| Dueluri | `/duel` | Confruntări 1v1 cu sistem Elo |
| Învățare | `/invatare` | Materiale didactice |
| Clase | `/clase` | Grupuri profesor–elevi |
| Prieteni | `/prieteni` | Listă prieteni și activitate |

Platforma este disponibilă în **română** (implicit), **engleză** și **maghiară**. Schimbă limba din meniu sau din setările profilului.

---

## Rezolvarea problemelor

1. Filtrează după dificultate (1–10), etichete sau text.
2. Scrie codul în editorul Monaco.
3. Selectează limbajul: **C, C++, Python, PyPy, Java, Kotlin, Rust, Go, JavaScript**.
4. Apasă **Trimite** — verdictul apare în câteva secunde.

**Verdicte:**

| Verdict | Semnificație |
|---|---|
| AC | Toate testele trecute |
| WA | Output incorect |
| CE | Eroare de compilare |
| TLE | Depășit limita de timp |
| MLE | Depășit limita de memorie |
| RE | Eroare la execuție |

Folosește **stdin/stdout** — nu folosi `freopen` sau fișiere.

---

## Concursuri

1. Mergi la **Concursuri** și apasă **Participă** pe un concurs activ.
2. Rezolvă problemele în timpul alocat.
3. Clasamentul se actualizează **live** în tab-ul Clasament.

| Tip | Descriere |
|---|---|
| Concurs | Competiție cu timp fix |
| Temă | Set de probleme cu termen, creat de profesor |
| Calificativă | Rundă de selecție |

---

## Dueluri

- **Coadă automată** — ești pereche cu un adversar de nivel similar
- **Invitație directă** — caută un utilizator și trimite-i o provocare
- Primul care obține **AC** câștigă; la egalitate câștigă scorul parțial mai mare
- Rating inițial: **1200** Elo, actualizat după fiecare duel
- Poți propune **remiză** sau **abandona** — adversarul câștigă automat la abandon

---

## Învățare

- Lecții cu Markdown + LaTeX, exemple de cod și exerciții interactive
- **Chatbot AI** contextualizat per lecție — întreabă orice despre conținut
- Apasă **Marchează ca finalizat** pentru tracking pe profilul tău

---

## Clase

**Profesor:** creează clasa → distribuie codul de acces elevilor → postează anunțuri, teme și urmărește progresul.

**Elev:** mergi la **Clase** → **Alătură-te** → introdu codul primit de la profesor.

---

## Profil și social

- Profilul public (`/u/username`): statistici, heatmap activitate, rating duel, probleme rezolvate
- **Prieteni:** caută un utilizator → **Adaugă prieten** → el primește notificare
- **Notificări** (clopoțel): cereri de prietenie, invitații la duel, actualizări din clase

---

## Setări

Din **Setări** (`/setari/profil`): schimbă poza de profil, numele afișat, limba interfeței sau parola.

---

## Întrebări frecvente

**CE deși codul compilează local?** Verifică standardul folosit (ex: `-std=c++17`). Evită extensii non-standard.

**Cât durează judecarea?** 2–10 secunde, în funcție de numărul de teste și încărcarea serverului.

**Pot vedea cazurile de test pe care am greșit?** Exemplele sunt vizibile în enunț. Cazurile private nu sunt afișate.

**Nu pot trimite la un concurs.** Trebuie să apeși **Participă** pe pagina concursului mai întâi.

**Resetare parolă.** Nu este disponibilă momentan. Contactează administratorul la `gatan9dragos@gmail.com`.
