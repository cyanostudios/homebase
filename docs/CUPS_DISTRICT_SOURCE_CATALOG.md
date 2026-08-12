# Cups — distriktskällor (katalog & checklista)

Ops-mall för att registrera ~20 distrikts-URL:er/PDF:er mot Cups-import.
Fyll en rad per distrikt. Uppdatera efter varje lyckad/testad import.

**Relaterat:** [`CUPS_AUTO_REFRESH_CRON.md`](CUPS_AUTO_REFRESH_CRON.md) (auto-refresh + soft-delete),  
[`DEVELOPMENT_GUIDE_V2.md`](DEVELOPMENT_GUIDE_V2.md) § Cups-import.

---

## Policy (kort)

| Fråga                           | Svar                                                                      |
| ------------------------------- | ------------------------------------------------------------------------- |
| Vad synkas?                     | En ingest-källa = ett distrikt (URL eller PDF)                            |
| Hur ofta?                       | Rekommenderat: **veckovis** cron + Auto refresh i Cups Settings           |
| Nya cuper                       | Skapas automatiskt vid import                                             |
| Cuper borta från distriktssidan | Soft-delete (Removed) → syns inte i Cupappen → hard-delete efter 30 dagar |
| Manuell plats                   | Behålls om bara plats skiljer sig (`touchImportSeen`)                     |
| Distriktsnamn i Cupappen        | = **ingest-källans namn**                                                 |

---

## Kända parserprofiler

Använd samma profil för flera URL:er om layouten är densamma. Ny layout → ny/justerad profil i `parseCupSource.js`.

| Profil                   | Kännetecken                             | Exempel                   |
| ------------------------ | --------------------------------------- | ------------------------- |
| `stockholm_pdf_table`    | PDF-tabell Cupens namn / Cupnamn        | Stockholm, vissa SvFF-PDF |
| `labeled_plaintext_pdf`  | Märkt PDF (Tävlingens namn, Arrangör)   | PDF med etiketter         |
| `skane_accordion`        | `accordion__item` / accordion-innehåll  | Skåne m.fl.               |
| `smaland_label_list`     | Tävlingens namn / Ålder / Arrangör      | Småland                   |
| `bohuslan_html_list`     | Host Bohuslän + “Fotbollscuper”         | Bohuslän-Dalsland         |
| `svff_table`             | HTML-tabell med kolumn **Cupnamn**      | Västerbotten, Västmanland |
| `sodermanland_accordion` | Accordion + h3 med YYYYMMDD-id          | Södermanland              |
| `svff_yearmonth_list`    | År + månadslistor / sanktionerade cuper | Östergötland              |
| `angermanland_labeled`   | “Tävling / Cup:”                        | Ångermanland              |
| `svff_paragraph_list`    | Arr. förening / “Cuper YYYY”            | Uppland, Jämtland         |
| _(fallback)_             | titel/h1 — **undvik**                   | Fixera profil innan prod  |

**Fetch:** `generic_http` först; `browser_fetch` bara om sidan kräver JS/Cloudflare.

---

## Checklista per ny källa

1. [ ] Skapa ingest-källa: **namn = distriktsnamn**, URL, typ `html` eller `pdf`, fetch-metod.
2. [ ] Manuell **Run** i Ingest (valfritt) — kontrollera att body/excerpt ser rimlig ut.
3. [ ] Cups Settings → bocka in källan i allowlist.
4. [ ] **Import from ingest** för den källan.
5. [ ] Notera `parsed` / `created` / `updated` / `errors` / `softDeleted`.
6. [ ] Verifiera profil (logik/indirekt: rimligt antal cuper + rätt fält).
7. [ ] Stickprov i Cupappen (distriktssida + en cup).
8. [ ] Fyll raden i tabellen nedan.
9. [ ] När alla källor är OK: slå på **Auto refresh**.

---

## Katalog (fyll i)

| #   | Distrikt (ingest-namn) | URL | Typ html/pdf | Fetch        | Profil (förväntad) | Senaste parsed | Senaste import (datum) | Status OK? | Anteckning |
| --- | ---------------------- | --- | ------------ | ------------ | ------------------ | -------------- | ---------------------- | ---------- | ---------- |
| 1   |                        |     |              | generic_http |                    |                |                        |            |            |
| 2   |                        |     |              |              |                    |                |                        |            |            |
| 3   |                        |     |              |              |                    |                |                        |            |            |
| 4   |                        |     |              |              |                    |                |                        |            |            |
| 5   |                        |     |              |              |                    |                |                        |            |            |
| 6   |                        |     |              |              |                    |                |                        |            |            |
| 7   |                        |     |              |              |                    |                |                        |            |            |
| 8   |                        |     |              |              |                    |                |                        |            |            |
| 9   |                        |     |              |              |                    |                |                        |            |            |
| 10  |                        |     |              |              |                    |                |                        |            |            |
| 11  |                        |     |              |              |                    |                |                        |            |            |
| 12  |                        |     |              |              |                    |                |                        |            |            |
| 13  |                        |     |              |              |                    |                |                        |            |            |
| 14  |                        |     |              |              |                    |                |                        |            |            |
| 15  |                        |     |              |              |                    |                |                        |            |            |
| 16  |                        |     |              |              |                    |                |                        |            |            |
| 17  |                        |     |              |              |                    |                |                        |            |            |
| 18  |                        |     |              |              |                    |                |                        |            |            |
| 19  |                        |     |              |              |                    |                |                        |            |            |
| 20  |                        |     |              |              |                    |                |                        |            |            |

**Status OK?** = import utan errors, parsed ≥ förväntat, stickprov i admin/Cupappen grönt.

---

## När något går fel

| Symptom                       | Trolig orsak                                             | Åtgärd                                                        |
| ----------------------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| `parsed = 0` / fel profil     | Layout matchar ingen detektor                            | Utveckling: utöka `detectCupSourceProfile` / ny parser        |
| Många `softDeleted` plötsligt | Trasig sida eller fel parse (men sweep kräver ≥3 parsed) | Jämför med föregående körning; kör inte “fix” utan att förstå |
| Fetch-fel / Cloudflare        | Behöver browser                                          | Byt till `browser_fetch` (+ ev. cookie-env)                   |
| Dubbletter                    | Ändrad `external_id` / två källor                        | Se dedupe i `CupsModel.findCupIdForImportDedupe`              |
| Tom allowlist + 403           | Källan inte ibockad                                      | Cups Settings → Import                                        |

---

## Äldre / borttagna cuper

- **Default:** låt soft-delete gälla — Cupappen ska spegla aktuell distriktslista.
- **Admin:** filter **Removed** för granskning innan hard-delete (30 dagar).
- **Behåll publikt trots borttag på distriktssidan:** skapa manuell cup (utan ingest) eller Restore (kan tas bort igen vid nästa lyckade sweep om den fortfarande saknas i källan).
