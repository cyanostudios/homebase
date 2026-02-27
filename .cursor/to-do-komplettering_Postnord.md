---
name: postnord_contract_gap_plan
overview: Plan för vad som saknas innan PostNord-bokning kan slutföras utan gissningar, fallbacks eller workarounds.
todos:
  - id: collect-postnord-contract-details
    content: Hämta exakta avtalsspecifika uppgifter från PostNord (auth, endpoint, servicekoder, payloadkrav).
    status: pending
  - id: lock-technical-contract
    content: Lås tekniskt API-kontrakt i pluginet (validering, auth-mode, endpoint-typ, request/response-struktur).
    status: pending
  - id: wire-configurable-ui-fields
    content: Säkerställ att alla kundspecifika värden kan ställas in i pluginets UI per användare/tenant.
    status: pending
  - id: align-booking-request-response
    content: Anpassa booking-request och response-mappning exakt efter verifierat PostNord-underlag.
    status: pending
  - id: verify-end-to-end
    content: Kör verifiering för settings, booking, labels och tracking-uppdatering i Orders.
    status: pending
  - id: clarify-customer-vs-partner-plan
    content: Framtidsspår: utvärdera Partner plan för multi-tenant senare. Nuvarande beslut: fortsätt med Customer plan för egen e-handel och få produktion igång så snabbt som möjligt.
    status: pending
isProject: false
---

# Plan: PostNord-kontrakt och slutförande av shipping-plugin

## Syfte
Låsa alla nödvändiga PostNord-detaljer så att `shipping`-pluginet kan färdigställas korrekt för alla användare, utan hårdkodade kundvärden och utan gissningar.

---

## Beslut just nu
- Vi kör **Customer plan** nu för din egen e-handel för snabbast möjliga go-live.
- **Partner plan** utreds senare som ett separat framtidsspår när multi-tenant blir aktuellt.

---

## Viktigt förtydligande
När vi säger **“låsa kontrakt”** menar vi:

- **Låsa tekniskt API-kontrakt i kod** (struktur/regler),
- **inte** låsa ditt individuella kundnummer eller personliga credentials.

Pluginet ska vara generellt och användbart av vem som helst genom konfiguration i UI.

---

## Vad som saknas just nu (blockers)

### 1. Exakt auth-kontrakt
Vi behöver bekräfta den auth-modell som gäller för booking i verklig användning:

- query `apikey` enbart,
- eller annan exakt auth-variant som gäller för vald endpoint.

**Varför blocker:** Fel auth gör att allt faller, och vi får inte gissa.

---

### 2. Exakt endpoint-strategi för v1
Swagger visar flera möjliga flöden, men vi behöver välja exakt ett för v1:

- boka via endpoint A och hämta label separat,
- eller boka + label i samma anrop.

**Varför blocker:** Endpointval styr både requestformat och responsemappning.

---

### 3. Exakta servicekoder för användning
Vi behöver verifierade service codes/IDs för de tjänster som ska stödjas (inkl. Varubrev).

**Varför blocker:** Fel kod ger valideringsfel eller affärsfel.

---

### 4. Minsta giltiga payload (verifierad)
Vi behöver ett verifierat exempelrequest som fungerar mot vald endpoint och auth-modell.

**Varför blocker:** Swagger räcker inte alltid för avtalsspecifika obligatoriska fält.

---

### 5. Exakt response-mappning
Vi behöver veta var i response vi hämtar:

- tracking number,
- label-content eller label-URL,
- fel per shipment/rad.

**Varför blocker:** Annars risk för felaktig uppdatering i Orders.

---

## Vad som ska vara hårdkodat vs konfigurerbart

## Hårdkodat i pluginlogik (tekniskt kontrakt)
- Tillåtna auth-modes (enum),
- endpoint-typ för v1-flöde,
- request/response-schema och validering,
- felhantering utan fallbackkedjor.

## Konfigurerbart i UI (per user/tenant)
- `bookingUrl`,
- `apiKey`,
- ev. `integrationId`,
- ev. custom header-namn,
- labelformat,
- avsändare,
- service-presets/snabbval.

---

## Informationsunderlag att hämta från PostNord

1. Rekommenderad endpoint för v1 i produktion.
2. Exakt auth-krav för endpointen.
3. Ett verifierat minimal-request-exempel som fungerar.
4. Lista med servicekoder som ska användas.
5. Exempel på success/error-response med tracking + label.
6. Framtidsspår: klargörande om Partner plan för plattform med flera företag, inkl. credential-modell per tenant (ej blocker för nuvarande Customer-plan-lansering).

---

## Implementeringssteg efter att underlaget finns

1. **Lås tekniskt kontrakt i backend**
   - Auth/endpoint/payload-regler i controller + validering.
2. **Säkerställ UI-konfiguration**
   - Alla kundspecifika värden sparas i settings UI.
3. **Mappa response korrekt**
   - Tracking + labels + orderuppdatering utan antaganden.
4. **Verifiera end-to-end**
   - Settings → booking → labels → orders tracking.

---

## Risker om vi går vidare utan detta
- Fel auth trots korrekt swaggertolkning.
- Fel servicekodsanvändning.
- Payload avvisas p.g.a. saknade obligatoriska fält.
- Fel tracking/label-mappning i Orders.

---

## Klart-kriterier
- Booking fungerar med verifierat kontrakt.
- Inga fallbacks/workarounds i bookinglogik.
- Alla kundspecifika värden är UI-konfigurerbara.
- Tracking + label mappas korrekt och stabilt.