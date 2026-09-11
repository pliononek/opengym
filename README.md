<div align="center">

<img src="assets/banner.png" alt="openGym" width="720">

<br>

**Self-hostowany tracker siłowni i wagi ciała, który naprawdę posiadasz.**

Planuj tydzień, prowadź treningi, zapisuj każdą serię i wagę ciała w czasie —
na telefonie, zsynchronizowane między urządzeniami, za własnym logowaniem.
Śledź też jedzenie i makroskładniki — opisem, zdjęciem lub kodem kreskowym, z AI szacującym
wartości. Zainstaluj go przez Docker albo uruchom za darmo na Cloudflare Pages + Supabase.
Bez konta na cudzym serwerze, bez subskrypcji, bez reklam.

<br>

[![Licencja: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-a3e635?style=flat-square)](LICENSE)
![Self-hosted](https://img.shields.io/badge/self--hosted-%F0%9F%8F%A0-60a5fa?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-installable-a78bfa?style=flat-square)
![React](https://img.shields.io/badge/React-19-38bdf8?style=flat-square&logo=react&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-ready-3ECF8E?style=flat-square)
![Brak telemetrii](https://img.shields.io/badge/telemetry-none-f472b6?style=flat-square)
<br>
![Ostatni commit](https://img.shields.io/github/last-commit/pliononek/opengym?style=flat-square)
[![Gwiazdki](https://img.shields.io/github/stars/pliononek/opengym?style=flat-square)](https://github.com/pliononek/opengym/stargazers)
[![Problemy](https://img.shields.io/github/issues/pliononek/opengym?style=flat-square)](https://github.com/pliononek/opengym/issues)

</div>

<br>

> ### 🤖 To jest fork — dodaje AI Coacha, licznik makro i wersję serverless
>
> Fork [emilfunk/opengym](https://github.com/emilfunk/opengym) (sam będącego forkiem
> [DuarteSantos8/openGym](https://github.com/DuarteSantos8/openGym)), który dodaje:
>
> - **AI Coach** — AI, które **projektuje** Twój plan treningowy i **poprawia go na podstawie
>   tego, co faktycznie logujesz**, działające na Twoim własnym serwerze i koncie providera.
> - **Licznik jedzenia i makro** — loguj posiłki opisem, zdjęciem lub kodem, a AI (Gemini) szacuje
>   kalorie / białko / węglowodany / tłuszcze, z opcjonalnym wyszukiwaniem w Open Food Facts.
>   Dane są przechowywane lokalnie na Twoim urządzeniu.
> - **Wersja serverless** — uruchom aplikację za darmo na **Cloudflare Pages + Supabase** (logowanie
>   e-mailem, synchronizacja per-użytkownik) bez dotykania Dockera. Zobacz [Hosting na Cloudflare Pages + Supabase](docs/HOSTING_SUPABASE.md).
>
> Reszta działa jak wcześniej: self-host z Dockerem, logowanie passkey, synchronizacja, media,
> wszystko tak samo jak w oryginale.
>
> **→ [Jak działa AI Coach i jak go zacząć](docs/AI_COACH.md)** ·
> [Konfiguracja Claude](Claude-setup-instructions.md) ·
> [Konfiguracja ChatGPT / Codex](ChatGPT-setup-instructions.md) ·
> [projekt (PDF)](openGym_AI_Strategy.pdf)

<br>

<div align="center">
<table>
<tr>
<td align="center"><img src="assets/screenshots/home.png" alt="Home" width="230"><br><sub><b>Home</b> — dzisiejszy trening i waga</sub></td>
<td align="center"><img src="assets/screenshots/workout.png" alt="Workout" width="230"><br><sub><b>Prowadzony trening</b> — animowane demo i serie</sub></td>
<td align="center"><img src="assets/screenshots/stats.png" alt="Stats" width="230"><br><sub><b>Statystyki</b> — heatmapa, wykresy i rekordy</sub></td>
</tr>
</table>
</div>

<div align="center">

### [🌐 opengym.duarte-santos.ch](https://opengym.duarte-santos.ch) · [▶ Wypróbuj live demo](https://duartesantos8.github.io/openGym/)

Bez rejestracji, niczego nie instalujesz — wszystko działa w przeglądarce na przykładowych danych.<br>
<sub>Za demo nie stoi żaden serwer, więc logowanie passkey, synchronizacja i panel admina
działają wyłącznie w instancji self-hostowanej.</sub>

</div>

## Po co to jest

Większość aplikacji treningowych blokuje Twoje dane za logowaniem na swoich serwerach, męczy
o dopłatę albo znika, gdy startup upadnie. openGym jest odwrotnością: **działa na Twojej maszynie,
Twoje dane leżą w katalogu, który kontrolujesz, i możesz go dowolnie forknąć.** Nadal wygląda
nowocześnie — instaluje się jako aplikacja na ekranie głównym, logowanie passkey, tryb offline,
synchronizacja między telefonem a laptopem.

## Funkcje

- ⚖️ **Śledzenie wagi ciała** — interaktywny wykres z linią celu; zyski/straty kolorowane zależnie od tego, czy zbliżają do celu
- 🏋️ **Plan tygodniowy** — rutyna na każdy dzień tygodnia, spośród biblioteki **1 324 ćwiczeń** (z wyszukiwarką i animowanymi demonstracjami)
- 🗓️ **Przeplanuj dowolny dzień** — chory, przegapiłeś sesję albo masz mniej dni treningowych? Przenieś trening na inny dzień bez ruszania planu tygodniowego
- ▶️ **Prowadzone treningi** — wie, jaki mamy dzień i startuje dzisiejszą sesję; najpierw pyta o wagę ciała, podpowiada ciężary z poprzednim razem, licznik odpoczynku, wykrywanie rekordów, śledzenie ciężaru dla każdego ćwiczenia
- ☀️ **Ekran nie gaśnie podczas treningu** — bez odblokowywania telefonu i szukania miejsca między każdą serią. Działa tak długo, jak aktywny jest trening, gaśnie w momencie jego końca; można wyłączyć w Ustawieniach
- 🔗 **Superserie** — twórz je i loguj jedną po drugiej, z odpoczynkiem dopiero po parze
- ⏱️ **Ćwiczenia czasowe** — deski, zwisy, podpory i noszenie obciążenia loguje się czasem, nie powtórzeniami; licznik pracy odlicza samo trzymanie (osobno od timera odpoczynku) i zapisuje faktyczny czas przytrzymania. Mogą też mieć obciążenie
- 📈 **Progresja według reguły** — wybierz jedną na rutynę, nadpisz przy ćwiczeniu: liniowa, **Greyskull LP** (AMRAP na górnej serii, podwójne skoki, reset 10 %), podwójna progresja w zakresie powtórzeń albo dodawanie czasu. Ciężary są już poprawne, gdy otwierasz sesję, a każdy cel tłumaczy, *dlaczego* takie. Niezaliczone powtórzenia nie zwiększają obciążenia, stagnacja wymusza deload, a ćwiczenia z masą ciała progresują w powtórzeniach
- 💪 **Szacowany 1RM** — dla każdego ćwiczenia, z najlepszej kwalifikującej się serii (podaje, której), z własną krzywą postępu i kalkulatorem dla niewykonanych serii. Nie zgadnie powyżej 12 powtórzeń
- 🎯 **Wysiłek na serię, w Twojej skali** — opcjonalna trzecia kolumna oceniająca trudność serii jako **RIR** (rezerwa powtórzeń) lub **RPE** (ta sama ocena w skali 10-stopniowej). Domyślnie wyłączone; każda seria zachowuje skalę, w jakiej ją zalogowano, a nic innego nie czyta tej wartości — progresja i 1RM działają bez zmian
- 🏃 **Cardio** — loguj czas + tempo, nie tylko ciężar × powtórzenia
- 📤 **Udostępnij plan** — wyślij komuś swoje rutyny i harmonogram tygodnia jako mały plik (bez treningów i wag ciała), albo wydrukuj jako schludny PDF. Importowanie scala, więc nic nie jest nadpisywane
- 🔧 **Filtruj po sprzęcie** — zawęź bibliotekę do tego, co faktycznie masz; opcje dopasowują się do wyborów, więc każda kombinacja ma wyniki
- ✨ **Własne ćwiczenia** — wystarczy nazwa i partia ciała; zachowują się jak wbudowane, z opcjonalnym opisem zamiast animacji
- 🟩 **Heatmapa aktywności** — roczny widok w stylu GitHuba, zacieniony czasem spędzonym na treningu
- 💪 **Mapa mięśni** — sylwetka z przodu i z tyłu, zacieniona nakładem pracy na każdy mięsień — za tydzień, miesiąc albo cały okres. Wymienia mięśnie, których *nie* trenowałeś w danym okresie, podgląda, co daje rutyna podczas budowania, i pokazuje, co właśnie potrenowałeś po zakończeniu treningu. Figura męska lub żeńska
- 🔔 **Powiadomienia push** — alerty timera odpoczynku nawet przy zamkniętej aplikacji, plus opcjonalne przypomnienie w dni, gdy masz zaplanowany trening, a nie zalogowałeś jeszcze żadnego. Dołączane per profil; klucze generowane przy pierwszym uruchomieniu, nic nie konfigurujesz
- 🤖 **AI Coach** (opcjonalnie) — AI, które *projektuje* Twój plan i dostosowuje go na podstawie tego, co faktycznie logujesz. Krótki wywiad daje kompletny plan tygodniowy, który dopracowujesz zwykłym językiem; na żądanie lub według harmonogramu czyta Twoje stagnacje, oceny wysiłku, przestrzeganie planu i trend wagi i proponuje **konkretne, opisane zmiany**, które akceptujesz pojedynczo. Wybierzesz oficjalny Claude Agent SDK lub dołączony OpenAI Codex CLI z logowaniem ChatGPT device-code; jest wyłączony, dopóki właściciel instancji go nie włączy, wymaga osobnej zgody każdego profilu i nigdy nie zmienia niczego bez Twojej akceptacji — każdy zestaw zmian jest migawkowany i odwracalny. Silnik progresji nadal odpowiada za Twoje ciężary sesja po sesji. **[Pełny przewodnik →](docs/AI_COACH.md)**
- 🔑 **Passkey zamiast haseł** — logowanie Face ID / Touch ID / odciskiem palca; każdy profil trzyma własne dane, zsynchronizowane między urządzeniami
- 🛠️ **Panel admina** (opcjonalnie) — dla osoby prowadzącej instancję: kto trenuje teraz, historia per-użytkownik, blokowanie kont, rejestracja tylko na zaproszenie. Domyślnie wyłączony, więc świeża instancja pozostaje otwarta bez admina
- 🎨 **Zaprojektowane, nie sklejone** — motywy jasny/ciemny i 8 kolorów akcentu zapisywanych na profilu, ręcznie rysowany zestaw ikon zamiast emoji, więc wygląda tak samo na każdym telefonie
- 🌍 **12 języków** — pełne tłumaczenie interfejsu (EN, DE, ES, FR, IT, PT, PL, TR, RU, ZH, KO, HI); instrukcje ćwiczeń zlokalizowane w 10 z nich, ładowane na żądanie, więc aplikacja pozostaje szybka
- 📥 **Zabierz swoją historię ze sobą** — import z **FitNotes** (Android i iOS), **Strong** i **Hevy**, albo waga ciała prosto z eksportu **Apple Health**. Nazwy ćwiczeń są dopasowywane do biblioteki, a wszystko nierozpoznane staje się Twoimi własnymi ćwiczeniami, więc nic z pliku nie ginie
- 📦 **Twoje na zawsze** — eksport/import JSON jednym dotknięciem, tryb gościa, **zero telemetrii**
- 📱 **Samodzielna aplikacja Android** — cały tracker jako doinstalowywany APK: bez konta, bez serwera, dane na telefonie, natywne przypomnienia treningów ([pobierz](https://opengym.duarte-santos.ch))

## Szybki start (self-host)

Potrzebujesz [Dockera](https://docs.docker.com/get-docker/) z Compose.

```bash
git clone https://github.com/DuarteSantos8/openGym
cd openGym
cp .env.example .env
docker compose pull   # pobierz gotowe obrazy (amd64 + arm64) — pominąć, aby budować ze źródeł
docker compose up -d
```

Otwórz **http://localhost:8080**, dotknij **Utwórz profil** i jesteś w środku. Pierwsze
uruchomienie pobiera raz media ćwiczeń (~140 MB). Wolisz zbudować obrazy sam zamiast
pobierać z `ghcr.io`? Pomiń krok `pull` i uruchom `docker compose up -d --build` — Node ani
kroku budowy nie potrzebujesz lokalnie.

> Chcesz mieć dostęp z telefonu przez internet z passkey? Potrzebujesz domeny HTTPS — zmiana
> dwóch linijek w `.env`. Zobacz **[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)**.

## Aplikacja mobilna (w ogóle bez serwera)

Ten sam kod buduje też **samodzielną aplikację mobilną** (Capacitor): bez konta, bez
synchronizacji, bez backendu — wszystko zostaje na telefonie, z natywnymi przypomnieniami
treningów i kopiami zapasowymi przez arkusz udostępniania. Self-host daje Ci synchronizację
między urządzeniami i profile dla rodziny i znajomych; aplikacja mobilna to wersja „zainstaluj
i gotowe".

- **Android:** [**pobierz APK**](https://opengym.duarte-santos.ch) i doinstaluj —
  openGym celowo nie ma na Play Store. Albo zbuduj sam: **[docs/MOBILE.md](docs/MOBILE.md)**.
- **iPhone:** Apple nie pozwala instalować aplikacji spoza App Store, więc nie ma pobierania
  na iOS. Zrób self-host i dodaj do ekranu głównego z Safari (to pełne PWA), albo zbuduj
  natywną aplikację na własnym urządzeniu z Xcode — zobacz **[docs/MOBILE.md](docs/MOBILE.md)**.

## Jak to działa

```
┌─────────────┐        ┌──────────────────────────────┐
│  Telefon    │──HTTPS─▶│  web  (nginx)               │
│  / laptop   │        │   ├─ serwuje zbudowaną apkę  │
└─────────────┘        │   └─ rutuje /api ──────────┐│
                       └──────────────────────────────┘│
                                                         ▼
                                         ┌──────────────────────────┐
                                         │  api  (Node + WebAuthn)  │
                                         │   └─ ./data (pliki JSON) │
                                         └──────────────────────────┘
```

- **frontend/** — React + Vite (React Router + Zustand), budowany do statycznych plików **wewnątrz Dockera**
- **api/** — Node bez frameworka, jedna zależność (`@simplewebauthn/server`), zapis wszystkiego w zwykłych plikach JSON w `./data`
- **web/** — obraz wieloetapowy budujący frontend i serwujący go przez nginx, rutujący `/api` na backend, więc wszystko jest na **jednym pochodzeniu** (wymagane przez passkey)

## Twoje dane

Leżą w `./data` na Twoim hoście: `db.json` (profile + publiczne passkey), `state-<user>.json`
(plan, treningi, waga ciała i ustawienia każdego użytkownika) oraz `secret` (klucz ciasteczka
sesji). **Zrób kopię `./data`, a masz kopię wszystkiego.** Prywatne klucze passkey nigdy nie
dotykają serwera — zostają w bezpiecznym sprzęcie telefonu / menedżerze haseł.

## Konfiguracja

Wszystko przez `.env` (zobacz `.env.example`):

| Zmienna       | Co to jest                                            | Domyślnie               |
|---------------|-------------------------------------------------------|-------------------------|
| `RP_ID`       | Nazwa hosta, do której przypięte są passkey           | `localhost`             |
| `ORIGIN`      | Pełny adres URL, z którego serwowana jest aplikacja   | `http://localhost:8080` |
| `WEB_PORT`    | Port hosta dla interfejsu web                          | `8080`                  |
| `RP_NAME`     | Nazwa pokazywana w prośbie o passkey                  | `openGym`               |
| `ADMIN_UIDS`  | Identyfikatory użytkowników z panelem admina (po przecinku) | *(brak)*           |
| `INVITE_ONLY` | Wymagaj kodu zaproszenia przy tworzeniu profilu        | *(wył.)*                |
| `COACH_DISABLED` | Wymusza wyłączenie AI Coacha niezależnie od panelu admina | *(puste)*            |

Klucze powiadomień push są generowane przy pierwszym uruchomieniu i zapisywane do
`./data/vapid.json` — nic do ustawiania.

**AI Coach** nie potrzebuje żadnego `.env`: Claude Agent SDK i przypięty OpenAI Codex CLI
są wbudowane w obraz api. Admin może dodać token setupu Claude Code albo ukończyć logowanie
device-code ChatGPT w panelu. Zobacz [przewodnik po AI Coachu](docs/AI_COACH.md),
[przewodnik po self-hosting](docs/SELF_HOSTING.md#8-the-ai-coach-optional) oraz instrukcje
dla [Claude](Claude-setup-instructions.md) i [ChatGPT/Codex](ChatGPT-setup-instructions.md).

## Plan rozwoju

Roboczy, prowadzony przez społeczność — pomysły i PR-y mile widziane:

- [x] Samodzielna aplikacja mobilna — APK na Androida do doinstalowania ([pobierz](https://opengym.duarte-santos.ch)); na iOS jako PWA self-hostowane (bez planów na store)
- [x] Automatyczne programy progresji (liniowy, Greyskull LP, podwójna progresja) z stagnacjami i deloadami
- [x] Szacowany 1RM na ćwiczenie
- [ ] Procentowa / treningowa progresja maksymalna (stylem 5/3/1) na bazie silnika progresji
- [x] AI Coach — projektowanie planu i przeglądy planu na podstawie feedbacku, z agenta CLI działającego na Twoim serwerze
- [ ] Więcej planów startowych (upper/lower, full body, 5×5)
- [x] Importy z FitNotes / Strong / Hevy (w tym zapisywane przez nie RPE) oraz waga ciała z Apple Health
- [x] Wysiłek na serię — RIR lub RPE, w skali, w jakiej myślisz
- [ ] Pomiary ciała (talia, ramiona…) obok wagi
- [ ] Notatki na ćwiczenie i kalkulator talerzy
- [ ] Instrukcje ćwiczeń po niemiecku i portugalsku (interfejs jest przetłumaczony; upstream nie ma jeszcze tych danych)

## Technologia

React 19 + Vite (React Router, Zustand) · Node (bez frameworka) · nginx · Docker Compose ·
WebAuthn · dane ćwiczeń z [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset).
Żaden serwer baz danych, żadnych zależności od chmury — frontend buduje się wewnątrz Dockera,
więc self-hosting pozostaje jednokomendowym `docker compose up`.

Logika treningowa — reguły progresji, szacowanie 1RM, odczytywanie zalogowanej sesji —
mieszka w czystych funkcjach w `frontend/src/lib/` z testami obok: `npm test` w `frontend/`.
Vitest jest zależnością deweloperską; sama aplikacja nie ma zależności wykonawczych poza
Reactem, routerem i Zustandem.

## Społeczność

- **[Q&A](https://github.com/DuarteSantos8/openGym/discussions/categories/q-a)** — pomoc przy
  self-hostingowaniu, problemy z passkey/logowaniem, „jak zrobić…". Większość problemów z
  logowaniem to niezgodność `RP_ID`/`ORIGIN`.
- **[Pomysły](https://github.com/DuarteSantos8/openGym/discussions/categories/ideas)** — funkcje
  warte przedyskutowania, zanim ktokolwiek napisze kod.
- **[Pokaż i opowiedz](https://github.com/DuarteSantos8/openGym/discussions/categories/show-and-tell)**
  — Twoja konfiguracja, szablony planów, wszystko, co zbudowano na bazie.
- **[Problemy](https://github.com/DuarteSantos8/openGym/issues)** — błędy i praca już ustalona.

## Współpraca

Problemy i PR-y mile widziane — zobacz [CONTRIBUTING.md](CONTRIBUTING.md). Dobre pierwsze
zadania: więcej planów startowych, języki danych ćwiczeń, import z innych trackerów.
**⭐ pomoże dotrzeć do większej liczby osób.**

openGym jest darmowe i pozostanie darmowe: AGPL, bez subskrypcji, bez płatnej wersji, nic
ukrytego. Jeśli zastąpiło Ci płatny tracker i chcesz się odwdzięczyć, przycisk Sponsor na górze
strony jest tutaj — gwiazdka, zgłoszenie błędu lub PR znaczą tyle samo.

## Licencja

[GNU AGPL v3.0](LICENSE) — darmowe i open source. Możesz hostować, używać, modyfikować
i udostępniać; jeśli wersję zmodyfikowaną uruchomisz jako usługę sieciową, musisz udostępnić
jej źródła na tej samej licencji. Nikt nie zamieni openGym w zamknięty produkt.

Zdjęcia/GIF-y ćwiczeń pobierane są z upstreamowego zbioru danych i zachowują własne zasady —
zobacz [NOTICE.md](NOTICE.md).