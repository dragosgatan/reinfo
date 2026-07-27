export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  list?: string[];
}

export interface LegalDoc {
  title: string;
  lastUpdated: string;
  intro: string[];
  sections: LegalSection[];
}

export type LegalLocale = "ro" | "en" | "hu";

export const privacyPolicy: Record<LegalLocale, LegalDoc> = {
  ro: {
    title: "Politica de Confidențialitate",
    lastUpdated: "Ultima actualizare: 28 iulie 2026",
    intro: [
      "ReInfo (reinfo.dev) este o platformă educațională de programare competitivă, dezvoltată ca proiect necomercial în cadrul InfoEducație, secțiunea Software Educațional. Nu suntem o companie înregistrată - ReInfo este operat direct de dezvoltatorul platformei.",
      "Pentru orice întrebare legată de confidențialitate sau date personale, ne poți contacta la: **dragos@gatan.dev**.",
    ],
    sections: [
      {
        heading: "1. Ce date colectăm",
        paragraphs: [
          "**Date de cont:** nume de utilizator, adresă de email, parolă (stocată exclusiv sub formă de hash), nume afișat, avatar (opțional, încărcat de tine - JPEG/PNG/WEBP, maxim 2 MB), biografie, limbă preferată a interfeței, temă preferată și linkuri externe opționale (profil GitHub și până la 3 linkuri personalizate).",
          "**Date de autentificare:** folosim un cookie de sesiune `httpOnly`, cu atributul `SameSite=Lax`, valabil 30 de zile. Pe server, păstrăm câte o înregistrare de sesiune cu tokenul de sesiune, data expirării, user-agent-ul browserului și adresa IP folosită la autentificare - necesare pentru securitate și pentru a putea invalida sesiuni compromise.",
          "**Resetare parolă:** la cererea unui reset de parolă, generăm un token temporar, cu o singură utilizare, trimis prin email folosind serviciul Resend.",
          "**Cod sursă și activitate de judecare:** codul sursă pe care îl trimiți la probleme, concursuri sau dueluri, limbajul folosit, verdictul obținut, punctajul și momentul trimiterii. Aceste date stau la baza istoricului tău de rezolvări, a clasamentelor și a ratingurilor.",
          "**Statistici și rating:** rating de duel, victorii/înfrângeri/egaluri, rating de concurs și data ultimei activități.",
          "**Funcții sociale:** cereri de prietenie, prietenii confirmate și notificări (de exemplu, cereri de prietenie primite sau acceptate).",
          "**Clase (profesor-elev):** dacă faci parte dintr-o clasă virtuală, stocăm apartenența la clasă, anunțurile clasei și mesajele directe schimbate între profesor și elev în cadrul clasei respective.",
          "**Rezultate externe:** poți adăuga manual rezultate obținute la alte concursuri (nume concurs, platformă, rezultat, an). Aceste rezultate pot fi verificate ulterior de un profesor sau administrator.",
          "**Asistent AI pentru lecții:** mesajele trimise către asistentul AI din cadrul lecțiilor sunt transmise printr-un furnizor terț, OpenRouter, pentru generarea răspunsului. Înregistrăm utilizarea (numărul de token-uri consumați, per lecție și per utilizator) pentru a aplica limite rezonabile de folosire. Răspunsurile pot fi păstrate temporar (24 de ore) într-un cache general, indexat după conținutul întrebării și lecție, nu după identitatea ta.",
          "**Token-uri API / CLI:** dacă folosești unealta de linie de comandă `reinfo-cli`, generăm token-uri de acces personale și înregistrări ale fluxului de autorizare pe dispozitiv (vezi secțiunea 4 pentru cum sunt protejate).",
          "**Integrare GitHub (opțională):** dacă această funcție este activată de un profesor pentru proiecte, preluăm doar metadate publice, read-only, ale unui repository GitHub. Nu stocăm token-uri sau credențiale GitHub.",
          "**Setări de confidențialitate:** poți controla dacă emailul, activitatea recentă și problemele rezolvate sunt vizibile public pe profilul tău.",
          "**Monitorizare erori:** folosim Sentry pentru a detecta și depana erorile aplicației. Aceste rapoarte pot conține metadate tehnice despre cererea care a generat eroarea.",
        ],
      },
      {
        heading: "2. Cum folosim datele",
        list: [
          "Furnizarea serviciului: autentificare, trimiterea și judecarea submisiilor, clasamente, dueluri, concursuri, lecții;",
          "Comunicare esențială: resetare parolă, notificări din platformă;",
          "Securitate: prevenirea fraudei, a abuzului sistemului de judecare și a folosirii multi-cont;",
          "Îmbunătățirea platformei pe baza utilizării agregate.",
        ],
      },
      {
        heading: "3. Temei legal",
        paragraphs: [
          "Prelucrăm datele în baza executării contractului dintre tine și ReInfo (crearea și utilizarea contului), a interesului legitim (securitate, prevenirea abuzului) și, acolo unde este cazul, a consimțământului (de exemplu, utilizarea asistentului AI).",
        ],
      },
      {
        heading: "4. Partajarea cu terți și securitate",
        paragraphs: [
          "Nu vindem datele tale și nu folosim publicitate sau tracking al terților. Folosim următorii furnizori, strict pentru funcționarea serviciului:",
        ],
        list: [
          "**Resend** - trimiterea emailurilor tranzacționale (resetare parolă);",
          "**OpenRouter** - rutarea mesajelor din chat-ul AI al lecțiilor către modele de limbaj;",
          "**Sentry** - monitorizarea erorilor din aplicație;",
          "**Vercel** - găzduirea aplicației frontend;",
          "**DigitalOcean** - găzduirea backend-ului și a bazei de date.",
        ],
      },
      {
        heading: "5. Securitate",
        paragraphs: [
          "Executarea codului sursă trimis de utilizatori are loc într-un mediu sandbox (Piston) auto-găzduit de ReInfo, nu printr-un serviciu terț.",
          "Parolele și token-urile de acces sunt stocate exclusiv sub formă de hash. Comunicarea cu platforma se face criptat (HTTPS). Codul trimis de utilizatori este executat izolat, într-un sandbox dedicat.",
        ],
      },
      {
        heading: "6. Cookie-uri",
        paragraphs: [
          "Folosim un singur cookie, cel de sesiune descris mai sus, necesar pentru autentificare. Nu folosim cookie-uri de analiză, marketing sau tracking.",
        ],
      },
      {
        heading: "7. Perioada de păstrare",
        paragraphs: [
          "Datele de cont sunt păstrate cât timp contul tău este activ. Sesiunile expiră automat după 30 de zile. Token-urile de resetare a parolei sunt de unică folosință și expiră rapid. Istoricul submisiilor este păstrat pentru a susține clasamentele și statisticile.",
          "Poți solicita ștergerea contului și a datelor asociate contactându-ne la dragos@gatan.dev - la momentul actual, ștergerea contului se face manual, la cerere, nefiind încă disponibilă o opțiune de auto-ștergere din platformă.",
        ],
      },
      {
        heading: "8. Drepturile tale",
        paragraphs: [
          "Conform GDPR, ai dreptul de acces, rectificare, ștergere, restricționare a prelucrării, portabilitate a datelor, opoziție și retragere a consimțământului. Poți depune oricând o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP). Pentru exercitarea oricărui drept, scrie-ne la dragos@gatan.dev.",
        ],
      },
      {
        heading: "9. Modificări ale acestei politici",
        paragraphs: [
          "Putem actualiza această politică pe măsură ce platforma evoluează. Vom afișa data ultimei actualizări în partea de sus a documentului.",
        ],
      },
      {
        heading: "10. Contact",
        paragraphs: ["dragos@gatan.dev"],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    lastUpdated: "Last updated: July 28, 2026",
    intro: [
      "ReInfo (reinfo.dev) is an educational competitive programming platform, built as a non-commercial project for InfoEducație (Software Educațional category). We are not a registered company - ReInfo is operated directly by the platform's developer.",
      "For any privacy or personal data questions, contact us at: **dragos@gatan.dev**.",
    ],
    sections: [
      {
        heading: "1. What data we collect",
        paragraphs: [
          "**Account data:** username, email address, password (stored only as a hash), display name, avatar (optional, user-uploaded - JPEG/PNG/WEBP, max 2 MB), bio, preferred interface language, preferred theme, and optional external links (GitHub profile and up to 3 custom links).",
          "**Authentication data:** we use an `httpOnly` session cookie with `SameSite=Lax`, valid for 30 days. On the server, we keep a session record with the session token, expiry date, browser user-agent, and the IP address used at login - needed for security and to revoke compromised sessions.",
          "**Password reset:** when you request a password reset, we generate a temporary, single-use token, sent by email via the Resend service.",
          "**Submitted code and judging activity:** the source code you submit to problems, contests, or duels, the language used, the resulting verdict, the score, and the submission timestamp. This data underlies your solving history, leaderboards, and ratings.",
          "**Stats and rating:** duel rating, wins/losses/draws, contest rating, and last-active timestamp.",
          "**Social features:** friend requests, confirmed friendships, and notifications (e.g. received or accepted friend requests).",
          "**Classrooms (teacher-student):** if you belong to a virtual classroom, we store your class membership, class announcements, and direct messages exchanged between teacher and student within that class.",
          "**External results:** you may manually add results achieved on other platforms (contest name, platform, result, year). These entries can later be verified by a teacher or administrator.",
          "**Lesson AI assistant:** messages sent to the lesson AI assistant are forwarded to a third-party provider, OpenRouter, to generate a response. We log usage (tokens consumed, per lesson and per user) to enforce reasonable usage limits. Responses may be cached temporarily (24 hours) in a general cache keyed by question content and lesson, not by your identity.",
          "**API / CLI tokens:** if you use the `reinfo-cli` command-line tool, we generate personal access tokens and records of the device-authorization login flow (see section 4 for how these are protected).",
          "**GitHub integration (optional):** if enabled by a teacher for project submissions, we fetch only public, read-only metadata of a GitHub repository. We never store GitHub tokens or credentials.",
          "**Privacy settings:** you can control whether your email, recent activity, and solved problems are publicly visible on your profile.",
          "**Error monitoring:** we use Sentry to detect and debug application errors. These reports may contain technical metadata about the request that triggered the error.",
        ],
      },
      {
        heading: "2. How we use this data",
        list: [
          "Providing the service: authentication, submission handling and judging, leaderboards, duels, contests, lessons;",
          "Essential communication: password resets, in-app notifications;",
          "Security: preventing fraud, judge-system abuse, and multi-account abuse;",
          "Improving the platform based on aggregated usage.",
        ],
      },
      {
        heading: "3. Legal basis",
        paragraphs: [
          "We process data under contract performance (creating and using your account), legitimate interest (security, abuse prevention), and, where applicable, consent (e.g. use of the AI assistant).",
        ],
      },
      {
        heading: "4. Third-party sharing",
        paragraphs: [
          "We do not sell your data and do not use third-party advertising or tracking. We use the following providers strictly to run the service:",
        ],
        list: [
          "**Resend** - sending transactional emails (password resets);",
          "**OpenRouter** - routing lesson AI chat messages to language models;",
          "**Sentry** - application error monitoring;",
          "**Vercel** - hosting the frontend application;",
          "**DigitalOcean** - hosting the backend and database.",
        ],
      },
      {
        heading: "5. Security",
        paragraphs: [
          "User-submitted code runs in a sandbox (Piston) self-hosted by ReInfo, not through a third-party service.",
          "Passwords and access tokens are stored only as hashes. Communication with the platform is encrypted (HTTPS). User-submitted code runs isolated, in a dedicated sandbox.",
        ],
      },
      {
        heading: "6. Cookies",
        paragraphs: [
          "We use a single cookie, the session cookie described above, required for authentication. We do not use analytics, marketing, or tracking cookies.",
        ],
      },
      {
        heading: "7. Retention period",
        paragraphs: [
          "Account data is kept while your account is active. Sessions expire automatically after 30 days. Password reset tokens are single-use and expire quickly. Submission history is retained to support leaderboards and statistics.",
          "You may request deletion of your account and associated data by contacting us at dragos@gatan.dev - account deletion is currently handled manually, on request, as a self-service deletion option is not yet available in the platform.",
        ],
      },
      {
        heading: "8. Your rights",
        paragraphs: [
          "Under GDPR, you have the right to access, rectify, erase, restrict processing of, port, and object to the processing of your data, and to withdraw consent. You may file a complaint at any time with the Romanian National Supervisory Authority for Personal Data Processing (ANSPDCP). To exercise any of these rights, write to us at dragos@gatan.dev.",
        ],
      },
      {
        heading: "9. Changes to this policy",
        paragraphs: [
          "We may update this policy as the platform evolves. The \"last updated\" date at the top of the document will reflect the most recent revision.",
        ],
      },
      {
        heading: "10. Contact",
        paragraphs: ["dragos@gatan.dev"],
      },
    ],
  },
  hu: {
    title: "Adatvédelmi irányelvek",
    lastUpdated: "Utolsó frissítés: 2026. július 28.",
    intro: [
      "A ReInfo (reinfo.dev) egy oktatási célú versenyprogramozási platform, amelyet nonprofit projektként fejlesztettünk az InfoEducație versenyre (Oktatási szoftver kategória). Nem vagyunk bejegyzett cég - a ReInfo-t közvetlenül a platform fejlesztője üzemelteti.",
      "Adatvédelemmel vagy személyes adatokkal kapcsolatos kérdéseiddel fordulj hozzánk: **dragos@gatan.dev**.",
    ],
    sections: [
      {
        heading: "1. Milyen adatokat gyűjtünk",
        paragraphs: [
          "**Fiókadatok:** felhasználónév, e-mail cím, jelszó (kizárólag hash formában tárolva), megjelenített név, avatar (opcionális, általad feltöltött - JPEG/PNG/WEBP, max. 2 MB), bemutatkozás, preferált felületi nyelv, preferált téma, valamint opcionális külső linkek (GitHub profil és legfeljebb 3 egyéni link).",
          "**Hitelesítési adatok:** egy `httpOnly` munkamenet-sütit használunk `SameSite=Lax` attribútummal, amely 30 napig érvényes. A szerveren tároljuk a munkamenet rekordját a munkamenet-tokennel, a lejárati dátummal, a böngésző user-agentjével és a bejelentkezéskor használt IP-címmel - ezekre a biztonság és a feltört munkamenetek visszavonása miatt van szükség.",
          "**Jelszó-visszaállítás:** jelszó-visszaállítási kérés esetén egy ideiglenes, egyszer használatos tokent generálunk, amelyet e-mailben küldünk el a Resend szolgáltatáson keresztül.",
          "**Beküldött kód és javítási tevékenység:** a feladatokhoz, versenyekhez vagy párbajokhoz beküldött forráskód, a használt nyelv, a kapott eredmény (verdikt), a pontszám és a beküldés időpontja. Ezek az adatok képezik a megoldási előzményeid, a ranglisták és a rating-jeid alapját.",
          "**Statisztikák és rating:** párbaj rating, győzelmek/vereségek/döntetlenek, verseny rating és az utolsó aktivitás időpontja.",
          "**Közösségi funkciók:** barátkérések, elfogadott barátságok és értesítések (pl. fogadott vagy elfogadott barátkérések).",
          "**Osztályok (tanár-diák):** ha egy virtuális osztály tagja vagy, tároljuk az osztálytagságodat, az osztály közleményeit és az adott osztályon belül tanár és diák között váltott közvetlen üzeneteket.",
          "**Külső eredmények:** manuálisan hozzáadhatsz más platformokon elért eredményeket (verseny neve, platform, eredmény, év). Ezeket a bejegyzéseket később egy tanár vagy adminisztrátor ellenőrizheti.",
          "**AI lecke-asszisztens:** a lecke AI-asszisztensének küldött üzeneteket egy harmadik féltől származó szolgáltatóhoz, az OpenRouterhez továbbítjuk a válasz generálásához. Naplózzuk a használatot (felhasznált tokenek száma, leckénként és felhasználónként) az ésszerű használati korlátok betartatásához. A válaszok ideiglenesen (24 órán át) egy általános gyorsítótárban tárolhatók, amelyet a kérdés tartalma és a lecke alapján indexelünk, nem a személyazonosságod alapján.",
          "**API / CLI tokenek:** ha a `reinfo-cli` parancssori eszközt használod, személyes hozzáférési tokeneket és az eszköz-hitelesítési bejelentkezési folyamat rekordjait hozzuk létre (lásd a 4. szakaszt, hogy ezek hogyan vannak védve).",
          "**GitHub integráció (opcionális):** ha ezt a funkciót egy tanár aktiválja projektekhez, kizárólag egy GitHub repository nyilvános, csak olvasható metaadatait kérjük le. Soha nem tárolunk GitHub tokeneket vagy hitelesítő adatokat.",
          "**Adatvédelmi beállítások:** szabályozhatod, hogy az e-mail címed, a legutóbbi aktivitásod és a megoldott feladataid nyilvánosan láthatók-e a profilodon.",
          "**Hibafigyelés:** a Sentry szolgáltatást használjuk az alkalmazáshibák felismerésére és javítására. Ezek a jelentések technikai metaadatokat tartalmazhatnak a hibát kiváltó kérésről.",
        ],
      },
      {
        heading: "2. Hogyan használjuk az adatokat",
        list: [
          "A szolgáltatás nyújtása: hitelesítés, beküldések kezelése és javítása, ranglisták, párbajok, versenyek, leckék;",
          "Alapvető kommunikáció: jelszó-visszaállítás, alkalmazáson belüli értesítések;",
          "Biztonság: csalás, a javítórendszerrel való visszaélés és a több fiókkal történő visszaélés megelőzése;",
          "A platform fejlesztése az összesített használat alapján.",
        ],
      },
      {
        heading: "3. Jogalap",
        paragraphs: [
          "Az adatokat a szerződés teljesítése (fiókod létrehozása és használata), jogos érdek (biztonság, visszaélés-megelőzés), valamint - adott esetben - hozzájárulás (pl. az AI-asszisztens használata) alapján kezeljük.",
        ],
      },
      {
        heading: "4. Harmadik felekkel való megosztás",
        paragraphs: [
          "Nem adjuk el az adataidat, és nem használunk harmadik féltől származó hirdetést vagy nyomon követést. A következő szolgáltatókat használjuk, kizárólag a szolgáltatás működtetéséhez:",
        ],
        list: [
          "**Resend** - tranzakciós e-mailek küldése (jelszó-visszaállítás);",
          "**OpenRouter** - a lecke AI chat üzeneteinek továbbítása nyelvi modellekhez;",
          "**Sentry** - alkalmazáshibák figyelése;",
          "**Vercel** - a frontend alkalmazás tárhelye;",
          "**DigitalOcean** - a backend és az adatbázis tárhelye.",
        ],
      },
      {
        heading: "5. Biztonság",
        paragraphs: [
          "A felhasználók által beküldött kód egy sandbox környezetben (Piston) fut, amelyet a ReInfo maga üzemeltet, nem egy harmadik fél szolgáltatásán keresztül.",
          "A jelszavak és a hozzáférési tokenek kizárólag hash formában vannak tárolva. A platformmal folytatott kommunikáció titkosított (HTTPS). A felhasználók által beküldött kód elkülönítve, egy dedikált sandboxban fut.",
        ],
      },
      {
        heading: "6. Sütik",
        paragraphs: [
          "Egyetlen sütit használunk, a fent leírt munkamenet-sütit, amely a hitelesítéshez szükséges. Nem használunk analitikai, marketing- vagy nyomon követő sütiket.",
        ],
      },
      {
        heading: "7. Megőrzési időszak",
        paragraphs: [
          "A fiókadatokat addig őrizzük, amíg a fiókod aktív. A munkamenetek 30 nap után automatikusan lejárnak. A jelszó-visszaállítási tokenek egyszer használatosak és gyorsan lejárnak. A beküldési előzményeket a ranglisták és statisztikák támogatása érdekében őrizzük meg.",
          "A fiókod és a hozzá kapcsolódó adatok törlését kérheted a dragos@gatan.dev címen - jelenleg a fiók törlése kérésre, manuálisan történik, mivel az önkiszolgáló törlési lehetőség még nem érhető el a platformon.",
        ],
      },
      {
        heading: "8. Jogaid",
        paragraphs: [
          "A GDPR értelmében jogod van az adataidhoz való hozzáféréshez, azok helyesbítéséhez, törléséhez, az adatkezelés korlátozásához, az adatok hordozhatóságához, valamint a tiltakozáshoz és a hozzájárulás visszavonásához. Bármikor panaszt tehetsz a Nemzeti Felügyeleti Hatóság a Személyes Adatok Feldolgozásáért (ANSPDCP) szervnél. Bármely jog gyakorlásához írj nekünk a dragos@gatan.dev címre.",
        ],
      },
      {
        heading: "9. A jelen irányelvek módosításai",
        paragraphs: [
          "A platform fejlődésével frissíthetjük ezt az irányelvet. A dokumentum tetején található „utolsó frissítés\" dátum tükrözi a legutóbbi módosítást.",
        ],
      },
      {
        heading: "10. Kapcsolat",
        paragraphs: ["dragos@gatan.dev"],
      },
    ],
  },
};

export const termsOfService: Record<LegalLocale, LegalDoc> = {
  ro: {
    title: "Termeni și Condiții",
    lastUpdated: "Ultima actualizare: 28 iulie 2026",
    intro: [
      "Prin crearea unui cont sau utilizarea platformei ReInfo (reinfo.dev), ești de acord cu acești Termeni și Condiții, precum și cu Politica de Confidențialitate. Dacă nu ești de acord, te rugăm să nu folosești platforma.",
      "ReInfo este un proiect educațional necomercial, dezvoltat pentru InfoEducație (secțiunea Software Educațional), și este operat de o singură persoană, nu de o companie înregistrată.",
    ],
    sections: [
      {
        heading: "1. Descrierea serviciului",
        paragraphs: [
          "ReInfo oferă probleme de programare competitivă, concursuri cronometrate, dueluri 1 la 1, lecții interactive cu quiz-uri și asistent AI, statistici și clasamente, funcții sociale (prieteni, notificări), clase virtuale profesor-elev și o unealtă de linie de comandă (`reinfo-cli`) pentru interacțiune programatică cu platforma.",
        ],
      },
      {
        heading: "2. Conturi de utilizator",
        paragraphs: [
          "Ești responsabil pentru păstrarea confidențialității parolei și a token-urilor tale de acces și pentru toate activitățile derulate din contul tău. Informațiile furnizate la înregistrare (nume de utilizator, email) trebuie să fie corecte. Fiecare cont este destinat utilizării de către o singură persoană - conturile multiple create de aceeași persoană pentru a obține un avantaj nedrept (clasament, dueluri, concursuri, limite ale asistentului AI) sunt interzise.",
        ],
      },
      {
        heading: "3. Reguli de utilizare",
        paragraphs: ["Prin utilizarea platformei, ești de acord să nu:"],
        list: [
          "copiezi, plagiezi sau distribui public soluții la probleme fără permisiune, în special în timpul concursurilor active;",
          "exploatezi sau abuzezi sistemul de judecare (de exemplu, încercări de citire/scriere de fișiere acolo unde regulile problemei impun exclusiv stdin/stdout, sau exploatarea mediului sandbox);",
          "folosești conturi multiple pentru a obține avantaje nedrepte la clasamente, dueluri sau concursuri;",
          "hărțuiești, abuzezi verbal sau spamezi alți utilizatori, inclusiv prin mesaje directe în cadrul claselor;",
          "folosești automatizări (boturi/scripturi) pentru a trimite soluții în masă sau pentru a interoga excesiv asistentul AI, dincolo de limitele de utilizare stabilite;",
          "încerci să accesezi neautorizat infrastructura ReInfo, inclusiv mediul de execuție a codului (Piston) sau bazele de date.",
        ],
      },
      {
        heading: "4. Conținutul utilizatorilor",
        paragraphs: [
          "Nerespectarea regulilor de la secțiunea 3 poate duce la anularea submisiilor, resetarea rating-ului sau suspendarea/interzicerea contului.",
          "Păstrezi drepturile asupra codului sursă, biografiei, avatarului și mesajelor pe care le trimiți pe platformă. Prin trimiterea acestui conținut, acorzi ReInfo dreptul de a-l stoca, procesa și afișa în cadrul serviciului - de exemplu, afișarea submisiilor pe profilul tău public, dacă ai activat această opțiune din setările de confidențialitate, sau afișarea în clasamente.",
        ],
      },
      {
        heading: "5. Proprietate intelectuală",
        paragraphs: [
          "Problemele, lecțiile, materialele educaționale și codul platformei ReInfo sunt proprietatea ReInfo sau a autorilor care le-au contribuit, și nu pot fi redistribuite sau folosite comercial fără acord prealabil.",
        ],
      },
      {
        heading: "6. Asistentul AI",
        paragraphs: [
          "Răspunsurile generate de asistentul AI din cadrul lecțiilor sunt produse automat, printr-un serviciu terț (OpenRouter), au caracter strict informativ și pot conține erori sau inexactități. Asistentul AI nu înlocuiește un profesor și nu garantăm acuratețea completă a răspunsurilor sale.",
        ],
      },
      {
        heading: "7. Concursuri, dueluri și rating",
        paragraphs: [
          "Participarea la concursuri și dueluri presupune joc corect (fair-play). ReInfo își rezervă dreptul de a anula submisii, de a ajusta sau reseta rating-ul unui utilizator și de a exclude un participant dintr-un concurs sau duel în cazul unor dovezi de trișat sau comportament neregulamentar. Deciziile administratorilor privind rezultatele judecării sunt finale.",
        ],
      },
      {
        heading: "8. Suspendarea și închiderea contului",
        paragraphs: [
          "ReInfo își rezervă dreptul de a suspenda sau interzice conturi care încalcă acești termeni. Poți solicita oricând închiderea contului tău, contactându-ne la dragos@gatan.dev.",
        ],
      },
      {
        heading: "9. Disponibilitatea serviciului",
        paragraphs: [
          "ReInfo este un proiect educațional, dezvoltat și întreținut fără garanții de disponibilitate continuă (SLA). Este posibil ca platforma să aibă întreruperi temporare de funcționare, în special pentru mentenanță sau în timpul dezvoltării de noi funcționalități.",
        ],
      },
      {
        heading: "10. Limitarea răspunderii",
        paragraphs: [
          "Platforma este oferită „ca atare\", fără garanții de niciun fel, explicite sau implicite. În limitele permise de lege, ReInfo nu răspunde pentru daune indirecte, incidentale sau de altă natură rezultate din utilizarea platformei.",
        ],
      },
      {
        heading: "11. Legea aplicabilă",
        paragraphs: ["Acești termeni sunt guvernați de legea română."],
      },
      {
        heading: "12. Modificări ale termenilor",
        paragraphs: [
          "Putem actualiza acești termeni pe măsură ce platforma evoluează. Vom afișa data ultimei actualizări în partea de sus a documentului. Continuarea utilizării platformei după o actualizare reprezintă acceptarea noilor termeni.",
        ],
      },
      {
        heading: "13. Contact",
        paragraphs: ["dragos@gatan.dev"],
      },
    ],
  },
  en: {
    title: "Terms of Service",
    lastUpdated: "Last updated: July 28, 2026",
    intro: [
      "By creating an account or using the ReInfo platform (reinfo.dev), you agree to these Terms of Service and to the Privacy Policy. If you do not agree, please do not use the platform.",
      "ReInfo is a non-commercial educational project, built for InfoEducație (Software Educațional category), and is operated by a single individual, not a registered company.",
    ],
    sections: [
      {
        heading: "1. Description of the service",
        paragraphs: [
          "ReInfo provides competitive programming problems, timed contests, 1v1 duels, interactive lessons with quizzes and an AI assistant, stats and leaderboards, social features (friends, notifications), teacher-student virtual classrooms, and a command-line tool (`reinfo-cli`) for programmatic interaction with the platform.",
        ],
      },
      {
        heading: "2. User accounts",
        paragraphs: [
          "You are responsible for keeping your password and access tokens confidential and for all activity carried out from your account. Information provided at registration (username, email) must be accurate. Each account is intended for use by a single person - multiple accounts created by the same person to gain an unfair advantage (leaderboards, duels, contests, AI assistant limits) are prohibited.",
        ],
      },
      {
        heading: "3. Usage rules",
        paragraphs: ["By using the platform, you agree not to:"],
        list: [
          "copy, plagiarize, or publicly share problem solutions without permission, particularly during active contests;",
          "exploit or abuse the judging system (for example, attempting file I/O where a problem's rules require stdin/stdout only, or exploiting the sandbox environment);",
          "use multiple accounts to gain an unfair advantage in leaderboards, duels, or contests;",
          "harass, verbally abuse, or spam other users, including through direct messages within classrooms;",
          "use automation (bots/scripts) to mass-submit solutions or excessively query the AI assistant beyond established usage limits;",
          "attempt unauthorized access to ReInfo's infrastructure, including the code execution environment (Piston) or databases.",
        ],
      },
      {
        heading: "4. User content",
        paragraphs: [
          "Violating the rules in section 3 may result in submissions being invalidated, rating resets, or account suspension/ban.",
          "You retain the rights to the source code, bio, avatar, and messages you submit on the platform. By submitting this content, you grant ReInfo the right to store, process, and display it as part of the service - for example, showing your submissions on your public profile if you've enabled that option in your privacy settings, or displaying them on leaderboards.",
        ],
      },
      {
        heading: "5. Intellectual property",
        paragraphs: [
          "The problems, lessons, educational materials, and code of the ReInfo platform are the property of ReInfo or the contributors who authored them, and may not be redistributed or used commercially without prior agreement.",
        ],
      },
      {
        heading: "6. AI assistant",
        paragraphs: [
          "Responses generated by the lesson AI assistant are produced automatically, through a third-party service (OpenRouter), are for informational purposes only, and may contain errors or inaccuracies. The AI assistant does not replace a teacher, and we do not guarantee the complete accuracy of its responses.",
        ],
      },
      {
        heading: "7. Contests, duels, and rating",
        paragraphs: [
          "Participation in contests and duels requires fair play. ReInfo reserves the right to invalidate submissions, adjust or reset a user's rating, and exclude a participant from a contest or duel in cases of evidence of cheating or irregular behavior. Administrator decisions regarding judging outcomes are final.",
        ],
      },
      {
        heading: "8. Account suspension and termination",
        paragraphs: [
          "ReInfo reserves the right to suspend or ban accounts that violate these terms. You may request closure of your account at any time by contacting us at dragos@gatan.dev.",
        ],
      },
      {
        heading: "9. Service availability",
        paragraphs: [
          "ReInfo is an educational project, developed and maintained without guarantees of continuous availability (no SLA). The platform may experience temporary interruptions, particularly for maintenance or while new features are being developed.",
        ],
      },
      {
        heading: "10. Limitation of liability",
        paragraphs: [
          'The platform is provided "as is", without warranties of any kind, express or implied. To the extent permitted by law, ReInfo is not liable for indirect, incidental, or other damages resulting from use of the platform.',
        ],
      },
      {
        heading: "11. Governing law",
        paragraphs: ["These terms are governed by Romanian law."],
      },
      {
        heading: "12. Changes to these terms",
        paragraphs: [
          "We may update these terms as the platform evolves. The \"last updated\" date at the top of the document will reflect the most recent revision. Continued use of the platform after an update constitutes acceptance of the new terms.",
        ],
      },
      {
        heading: "13. Contact",
        paragraphs: ["dragos@gatan.dev"],
      },
    ],
  },
  hu: {
    title: "Felhasználási feltételek",
    lastUpdated: "Utolsó frissítés: 2026. július 28.",
    intro: [
      "A ReInfo (reinfo.dev) platform fiók létrehozásával vagy használatával elfogadod a jelen Felhasználási feltételeket, valamint az Adatvédelmi irányelveket. Ha nem értesz egyet, kérjük, ne használd a platformot.",
      "A ReInfo egy nonprofit oktatási projekt, amelyet az InfoEducație versenyre (Oktatási szoftver kategória) fejlesztettünk, és amelyet egyetlen személy üzemeltet, nem bejegyzett cég.",
    ],
    sections: [
      {
        heading: "1. A szolgáltatás leírása",
        paragraphs: [
          "A ReInfo versenyprogramozási feladatokat, időzített versenyeket, 1 az 1 elleni párbajokat, kvízekkel és AI-asszisztenssel ellátott interaktív leckéket, statisztikákat és ranglistákat, közösségi funkciókat (barátok, értesítések), tanár-diák virtuális osztályokat, valamint egy parancssori eszközt (`reinfo-cli`) kínál a platformmal való programozott interakcióhoz.",
        ],
      },
      {
        heading: "2. Felhasználói fiókok",
        paragraphs: [
          "Felelős vagy a jelszavad és hozzáférési tokenjeid bizalmas kezeléséért, valamint a fiókodból végzett minden tevékenységért. A regisztrációkor megadott adatoknak (felhasználónév, e-mail) pontosnak kell lenniük. Minden fiók egyetlen személy általi használatra szolgál - ugyanazon személy által létrehozott több fiók, amelyek célja tisztességtelen előny szerzése (ranglisták, párbajok, versenyek, AI-asszisztens korlátai), tilos.",
        ],
      },
      {
        heading: "3. Használati szabályok",
        paragraphs: ["A platform használatával vállalod, hogy nem:"],
        list: [
          "másolsz, plagizálsz vagy engedély nélkül nyilvánosan megosztasz feladatmegoldásokat, különösen aktív versenyek alatt;",
          "kihasználod vagy visszaélsz a javítórendszerrel (például fájlok olvasására/írására tett kísérletekkel ott, ahol a feladat szabályai kizárólag stdin/stdout használatát írják elő, vagy a sandbox környezet kihasználásával);",
          "több fiókot használsz tisztességtelen előny szerzésére ranglistákon, párbajokban vagy versenyeken;",
          "zaklatsz, szóban bántalmazol vagy spammelsz más felhasználókat, ideértve az osztályokon belüli közvetlen üzeneteket is;",
          "automatizálást (botokat/szkripteket) használsz megoldások tömeges beküldésére vagy az AI-asszisztens túlzott mértékű lekérdezésére a megállapított használati korlátokon túl;",
          "megpróbálsz jogosulatlanul hozzáférni a ReInfo infrastruktúrájához, ideértve a kódfuttató környezetet (Piston) vagy az adatbázisokat.",
        ],
      },
      {
        heading: "4. Felhasználói tartalom",
        paragraphs: [
          "A 3. szakaszban foglalt szabályok megsértése a beküldések érvénytelenítését, a rating visszaállítását vagy a fiók felfüggesztését/kitiltását vonhatja maga után.",
          "Megtartod a jogaidat a platformon beküldött forráskód, bemutatkozás, avatar és üzenetek felett. E tartalom beküldésével a ReInfo számára jogot biztosítasz annak tárolására, feldolgozására és megjelenítésére a szolgáltatás keretében - például a beküldéseid megjelenítésére a nyilvános profilodon, ha ezt a lehetőséget aktiváltad az adatvédelmi beállításokban, vagy a ranglistákon való megjelenítésre.",
        ],
      },
      {
        heading: "5. Szellemi tulajdon",
        paragraphs: [
          "A ReInfo platform feladatai, leckéi, oktatási anyagai és kódja a ReInfo vagy az azokat létrehozó közreműködők tulajdonát képezik, és előzetes megállapodás nélkül nem terjeszthetők tovább vagy használhatók fel kereskedelmi célra.",
        ],
      },
      {
        heading: "6. AI-asszisztens",
        paragraphs: [
          "A lecke AI-asszisztense által generált válaszok automatikusan, egy harmadik féltől származó szolgáltatáson (OpenRouter) keresztül készülnek, kizárólag tájékoztató jellegűek, és hibákat vagy pontatlanságokat tartalmazhatnak. Az AI-asszisztens nem helyettesíti a tanárt, és nem garantáljuk válaszainak teljes pontosságát.",
        ],
      },
      {
        heading: "7. Versenyek, párbajok és rating",
        paragraphs: [
          "A versenyeken és párbajokon való részvétel tisztességes játékot (fair play) feltételez. A ReInfo fenntartja a jogot beküldések érvénytelenítésére, egy felhasználó rating-jének módosítására vagy visszaállítására, valamint egy résztvevő kizárására egy versenyből vagy párbajból csalásra utaló bizonyíték vagy szabálytalan viselkedés esetén. A javítási eredményekkel kapcsolatos adminisztrátori döntések véglegesek.",
        ],
      },
      {
        heading: "8. Fiók felfüggesztése és megszüntetése",
        paragraphs: [
          "A ReInfo fenntartja a jogot a jelen feltételeket megsértő fiókok felfüggesztésére vagy kitiltására. Fiókod megszüntetését bármikor kérheted a dragos@gatan.dev címen történő kapcsolatfelvétellel.",
        ],
      },
      {
        heading: "9. A szolgáltatás elérhetősége",
        paragraphs: [
          "A ReInfo egy oktatási projekt, amelyet folyamatos elérhetőségi garancia (SLA) nélkül fejlesztünk és tartunk karban. Előfordulhat, hogy a platform átmeneti üzemzavarokat tapasztal, különösen karbantartás vagy új funkciók fejlesztése során.",
        ],
      },
      {
        heading: "10. Felelősség korlátozása",
        paragraphs: [
          "A platformot „ahogy van\" alapon biztosítjuk, mindenféle - kifejezett vagy hallgatólagos - garancia nélkül. A törvény által megengedett mértékben a ReInfo nem vállal felelősséget a platform használatából eredő közvetett, véletlen vagy egyéb jellegű károkért.",
        ],
      },
      {
        heading: "11. Alkalmazandó jog",
        paragraphs: ["A jelen feltételekre a román jog az irányadó."],
      },
      {
        heading: "12. A feltételek módosításai",
        paragraphs: [
          "A platform fejlődésével frissíthetjük a jelen feltételeket. A dokumentum tetején található „utolsó frissítés\" dátum tükrözi a legutóbbi módosítást. A platform további használata egy frissítés után az új feltételek elfogadását jelenti.",
        ],
      },
      {
        heading: "13. Kapcsolat",
        paragraphs: ["dragos@gatan.dev"],
      },
    ],
  },
};
