# Plan refaktoru wydajności widoku publicznego

## Cel
Celem jest zbudowanie takiego modelu działania widoku publicznego, aby:
- przechodzenie między listami, filtrami i kartami było szybkie i przewidywalne,
- nowe funkcje publiczne można było dodawać bez psucia wydajności,
- serwis zachowywał się możliwie blisko „prawie realtime”, ale bez nadmiernego komplikowania architektury.

---

## Zasada prowadzenia tego pliku
**Po każdym zakończonym etapie trzeba dopisać tutaj:**
1. co zostało wdrożone,
2. jakie pliki / moduły objęła zmiana,
3. jaki był efekt wydajnościowy,
4. co zostało do następnego etapu.

Nie kasować historii wykonanych etapów — ten plik ma być stałą kroniką refaktoru.

---

## Stan obecny — rzeczy już zrobione

### ✅ Wdrożone wcześniej
- dodano cache / revalidate dla publicznych stron meczów,
- po zapisach w panelu admina publiczne widoki są odświeżane,
- przełączanie dekad w publicznej liście meczów zostało przeniesione na lokalne filtrowanie po stronie klienta,
- zniknął problem kilkusekundowego przeładowania przy zmianie dekady,
- część zbyt dużych zapytań do Supabase została już wcześniej porcjowana (chunking), żeby ograniczyć awarie i opóźnienia,
- publiczna karta meczu została odpięta od najcięższej części adminowego pobierania uczestników i osób.

### ⚠️ Nadal do poprawy
- karta konkretnego meczu nadal może wykonywać zbyt dużo pracy przy wejściu,
- publiczne widoki wciąż w kilku miejscach korzystają z logiki zbyt zbliżonej do adminowej,
- przy dalszym rozwoju statystyk i kolejnych kart bez wspólnej architektury wydajność znów zacznie siadać.

---

## Architektura docelowa
Docelowo publiczny serwis powinien działać w oparciu o 4 warstwy:

1. **Public UI**
   - szybki, prosty readonly frontend,
   - lokalne przełączanie filtrów, zakładek i sekcji tam, gdzie dane są już pobrane.

2. **Public Read Layer**
   - osobne funkcje / zapytania tylko pod publiczny odczyt,
   - żadnego nadmiarowego pobierania danych z logiki adminowej.

3. **Cache + selective invalidation**
   - cache dla stron publicznych,
   - odświeżanie tylko tych fragmentów, których naprawdę dotknęła zmiana.

4. **Precomputed data / snapshots**
   - gotowe agregaty i podsumowania liczone po zapisie,
   - publiczny frontend czyta dane już przygotowane, zamiast liczyć je w locie.

---

## ETAP 1 — Fundament wydajności publicznej
**Status:** częściowo zrobiony

### Zakres
- oddzielić myślenie „public” od „admin”,
- trzymać lekkie readonly flow dla list i prostych przejść,
- unikać pełnych przeładowań przy prostych interakcjach użytkownika.

### Co wchodzi w ten etap
- osobne lekkie funkcje danych dla widoków publicznych,
- dalsze przenoszenie prostych przełączeń na klienta,
- przegląd, które widoki publiczne robią zbędne zapytania.

### Co już zrobiono w ramach etapu 1
- publiczny selektor dekad działa już lokalnie i szybko,
- podstawowy cache publicznych tras już istnieje.

### Co jeszcze zostało w etapie 1
- dalej przeglądać kolejne publiczne widoki pod kątem współdzielenia z logiką adminową,
- ograniczać cięższe zapytania w następnych kartach i statystykach,
- utrzymywać zasadę, że nowe widoki publiczne dostają lekkie readonly query od początku.

---

## ETAP 2 — Szybka karta meczu i szybkie karty szczegółowe
**Status:** planowany

### Cel
Żeby wejście w konkretny mecz, a później także w inne publiczne karty, było szybkie niezależnie od rozbudowy danych.

### Plan
- zbudować lekkie publiczne query dla szczegółów meczu,
- ograniczyć liczbę równoległych odczytów do niezbędnego minimum,
- rozdzielić dane krytyczne od danych dodatkowych,
- cięższe sekcje ładować później lub dopiero po rozwinięciu.

### Efekt oczekiwany
- szybki pierwszy render,
- mniej opóźnień przy wejściu na kartę meczu,
- lepsza baza pod kolejne typy kart publicznych.

---

## ETAP 3 — Cache sterowany tagami
**Status:** planowany

### Cel
Odświeżać tylko to, co trzeba, zamiast czyścić większe fragmenty serwisu.

### Plan
- wprowadzić tagowanie cache dla widoków publicznych,
- osobno tagować:
  - listy meczów,
  - szczegóły meczu,
  - statystyki roczne,
  - przyszłe karty zawodników / krajów / rankingów,
- po zmianie danych w adminie odświeżać wyłącznie dotknięte tagi.

### Efekt oczekiwany
- szybsze aktualizacje,
- mniejsze koszty renderów,
- większa przewidywalność przy rozwoju funkcji.

---

## ETAP 4 — Public Read Model / Snapshoty / Agregaty
**Status:** planowany

### Cel
Nie liczyć ciężkich rzeczy przy każdym wejściu użytkownika.

### Plan
- przygotować warstwę danych tylko do odczytu publicznego,
- trzymać gotowe agregaty dla:
  - list meczów,
  - kart meczów,
  - statystyk per rok,
  - przyszłych statystyk zawodników i drużyny,
- rozważyć SQL views, materialized views albo dedykowane tabele snapshotów.

### Efekt oczekiwany
- publiczny frontend pobiera gotowe dane,
- nowe funkcje statystyczne nie obciążają tak mocno runtime,
- lepsza skalowalność na przyszłość.

---

## ETAP 5 — Model „prawie realtime”
**Status:** planowany na później

### Cel
Uzyskać efekt bardzo szybkiej aktualizacji po zmianach w adminie, bez przebudowy całego systemu w kierunku skomplikowanego realtime.

### Plan
- po zapisie danych uruchamiać przeliczenie tylko powiązanych agregatów,
- odświeżać precyzyjnie cache powiązanych widoków,
- dodać monitoring czasu odpowiedzi najważniejszych publicznych stron,
- w razie potrzeby dopiero później rozważyć bardziej zaawansowane mechanizmy typu background jobs.

### Efekt oczekiwany
- użytkownik publiczny widzi świeże dane bardzo szybko,
- serwis pozostaje prosty w utrzymaniu,
- wydajność nie degraduje się przy rozroście funkcji.

---

## Priorytet wdrożenia

### Teraz
1. domknąć etap 1,
2. wejść w etap 2 dla karty meczu,
3. przygotować miejsce pod etap 3.

### Później
4. wprowadzić public read model,
5. dobudować snapshoty / agregaty,
6. dołożyć monitoring i selektywną revalidację na większą skalę.

---

## Zasada dla wszystkich kolejnych funkcji publicznych
Każda nowa funkcja publiczna powinna być oceniana wg prostego pytania:

**czy ta funkcja pobiera dane w sposób lekki, cache-friendly i niezależny od ciężkiej logiki adminowej?**

Jeśli nie — trzeba ją od razu projektować zgodnie z tym planem.

---

## Miejsce na kolejne aktualizacje postępu

### Aktualizacja po następnym etapie
- Data: 2026-04-17
- Zakres: domknięcie bieżącego etapu fundamentów wydajności publicznej
- Co zrobiono: dodano lżejszy publiczny odczyt dla karty meczu i odłączono publiczny readonly view od najcięższej ścieżki adminowej pobierającej pełną listę osób oraz dodatkowe dane niepotrzebne w widoku publicznym.
- Efekt: wejście w publiczny szczegół meczu powinno być wyraźnie szybsze i bardziej odporne na rozrost danych.
- Co dalej: kolejny krok to dalsze porządkowanie public read layer i przygotowanie bardziej selektywnego cache dla kolejnych kart.

