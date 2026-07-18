# ADR — P-PLACE: Platsidentifiering för Guides

**Status:** Implementerad lokalt 2026-07-18. QA-verifierad (enhetstester + typecheck). Ej commit/deploy.  
**Epic:** P-PLACE  
**Relaterad:** [`P-TEXT_TEXT_PROVIDER.md`](P-TEXT_TEXT_PROVIDER.md), [`P-AI-SETTINGS_PROVIDER_CONFIGURATION.md`](P-AI-SETTINGS_PROVIDER_CONFIGURATION.md)  
**Grund:** TPM Output Contract (Grind 1 godkänd) + Solution Architect Output Contract (Grind 2)

---

## Sammanfattning

Ersätt fritext `geographic_reference` med en stabil, leverantörsoberoende intern platsrepresentation. Användaren söker naturligt (autocomplete); systemet lagrar en `PlaceResolved`-ögonblicksbild (extern stabil id, koordinater, kanoniskt namn m.m.). AI får strukturerad platskontext. Arkitekturen tillåter framtida AI-baserade platsförslag utan omskrivning.

---

## Låsta principer

| ID  | Princip                                  | Uttryck                                             |
| --- | ---------------------------------------- | --------------------------------------------------- |
| PL1 | Ingen leverantörslogik i domänen         | `places`-plugin + registry äger adaptrar            |
| PL2 | Intern modell är leverantörsoberoende    | `PlaceResolved`-kontrakt; DB-id som intern nyckel   |
| PL3 | Snapshot för stabilitet                  | Guiden påverkas ej av senare leverantörsdataändring |
| PL4 | Platskontext till prompt är strukturerad | Domänen skickar objekt; prompt härleder strängen    |

---

## Beslut

| Beslut           | Val                                                                | Motivering                                                 |
| ---------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| Kapabilitet      | Ny plugin `places` (speglar `ai-providers`)                        | Provider-oberoende; återanvändbar av framtida guider       |
| Registry         | `PlaceProviderRegistry` + `PLACE_PROVIDER_CATALOG`                 | Samma mönster som AI-providers                             |
| Default-adapter  | `nominatim` (OpenStreetMap), nyckelfri                             | Local-prod-parity utan hemligheter; ingen vendor-inlåsning |
| Valfria adaptrar | `google` / `mapbox` via katalog + credentials                      | Aktiveras utan domänändring                                |
| API              | `GET /api/places/search?q=`, `GET /api/places/:providerRef`        | Tunn yta; ingen leverantörslogik i Guides                  |
| Persistens       | Additiv migration på `guide_places`; behåll `geographic_reference` | Bakåtkompatibilitet + snapshot                             |
| Prompt           | `TextGenerateInput.placeContext` (strukturerat objekt)             | Bevarar P1/P2 från text-provider-ADR                       |

### Föreslagen datamodell (additiv)

```sql
ALTER TABLE guide_places
  ADD COLUMN place_provider      VARCHAR(50),
  ADD COLUMN place_provider_ref  VARCHAR(255),
  ADD COLUMN resolved_name       VARCHAR(255),
  ADD COLUMN formatted_address   VARCHAR(500),
  ADD COLUMN latitude            NUMERIC(9,6),
  ADD COLUMN longitude           NUMERIC(9,6),
  ADD COLUMN country_code        VARCHAR(2),
  ADD COLUMN admin_area          VARCHAR(255),
  ADD COLUMN locality            VARCHAR(255),
  ADD COLUMN place_types         JSONB,
  ADD COLUMN bbox                JSONB,
  ADD COLUMN place_resolved_at   TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_guide_places_provider_ref
  ON guide_places(place_provider, place_provider_ref);
```

`placeId` (intern) förblir DB-id. `place_provider_ref` är den stabila externa referensen.

---

## PlaceResolved (kontrakt)

```ts
interface PlaceResolved {
  provider: 'nominatim' | 'google' | 'mapbox' | 'manual';
  providerRef: string | null;
  displayName: string;
  formattedAddress: string | null;
  coordinates: { lat: number; lng: number } | null;
  countryCode: string | null;
  adminArea: string | null;
  locality: string | null;
  placeTypes: string[];
  bbox: [number, number, number, number] | null;
  resolvedAt: string;
}
```

`placeContext` till AI = delmängd: `{ displayName, formattedAddress, countryCode, adminArea, locality, coordinates, placeTypes }`.

---

## Framtida utökning

AI-baserade platsförslag = ny `suggest`-kapabilitet i registry eller route via `ai-providers`; returnerar samma `PlaceResolved`-form. Additivt.

---

## Risker (flaggor)

- Nominatim usage policy vid volym (cache; byt adapter via konfig).
- Prompt injection via platsnamn — behandla som otillförlitlig indata.
- Snapshot vs live-data: medvetet val; re-resolve via `place_provider_ref` senare.

---

## Status

Design only. Implementation kräver separat epik (Backend + Frontend + QA + Security + Documentation).
