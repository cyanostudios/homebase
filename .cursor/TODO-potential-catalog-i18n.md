# Potentiella framtida ändringar (katalog, språk, import)

**Status:** Idéer / backlog-kandidater — **inte** beslutad roadmap och **inte** garanti att något genomförs. Agenter ska **inte** tolka detta som bekräftat arbete.

Använd som inspirationslista när produkt/teknik prioriterar.

---

## Datamodell & UI

- **Valbar primärmarknad för katalogfält** — Idag kopplas `products.title` / `products.description` till Texter-marknaden **`se`** (Sverige). En mer generell modell vore t.ex. tenant- eller produktnivå: “vilken marknadsrad (`se`/`dk`/`fi`/`no`) som ska spegla katalogens `title`/`description`”, eller en explicit “katalogspråk”/primärmarknad utan att hårdkoda `se`.

- **Tydligare UX-copy** — Förklara i UI att listor/katalog använder samma källa som vald primärmarknad (om ni inför det ovan), så användare inte tror att gränssnittsspråk ändrar produktdata.

- **Tenant-/inställningsstyrd fallback** — T.ex. standard för `textsStandard` eller för vilken marknad som används när data saknas (i stället för implicit `se` på flera ställen).

---

## Export (CDON / Fyndiq)

- **`defaultLanguage` härledd, inte hårdkodad** — Idag sätts `sv-SE` i controllern vid export. Potentiellt: koppla till `channelSpecific.textsStandard` → `MARKET_TO_LANG`, eller tenant-inställning, när payload byggs från enbart `products.title`/`description`.

- **Verifiera konsekvent beteende** — Säkerställa att val av standardtext och export-språktaggar är förutsägbara i edge cases (endast `textsExtended.fi` ifylld, osv.).

---

## Process

- **Prioritering** — Varje punkt kräver produktbeslut innan implementation; denna fil ersätter inte ticket/issue-beskrivning.
