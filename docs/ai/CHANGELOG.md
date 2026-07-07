# AI-utvecklingsteam – Changelog

Versionshistorik för design- och specifikationsdokument under `docs/ai/`.

## v1.3 – Överlämning som verkligt stopp (2026-07-07)

Förstärker rolldisciplin efter överlämning utan att ändra Team Workflow, Stage Gates eller rollbefogenheter.

### Dokumentation

- `docs/ai/team-workflow.md` – princip **Efter överlämning** under Kommunikationsregler och Principer.
- `docs/ai/cursor-implementation.md` – princip under Output Contract: rollen fortsätter inte arbetet efter överlämning om nästa roll inte aktiveras.

### Cursor-regler (.cursor/rules/)

Alla åtta `role-*.mdc` har ny sektion **Efter överlämning**: rollen är klar efter överlämningsrad; svarar endast med påminnelse vid fortsättningsfraser utan rollaktivering; utför inte nästa rolls arbete.

- `role-technical-project-manager.mdc` – tillägg: TPM får inte återta överlämnad uppgift förrän rollen uttryckligen aktiveras igen.

---

## v1.2 – Rollseparation vid övertagande (2026-07-07)

Förstärker rollseparationen utan att ändra Team Workflow, Stage Gates eller rollbefogenheter.

### Dokumentation

- `docs/ai/cursor-implementation.md` – princip under Kontextkomprimering och Output Contract: utgå från föregående rolls Output Contract, inte hela chatthistoriken.

### Cursor-regler (.cursor/rules/)

Alla åtta `role-*.mdc` har ny sektion **Rollseparation** (eget ansvar, referera leverabler, inte återskapa annan rolls arbete).

- `role-technical-project-manager.mdc` – tillägg **Efter specialistleverans**: TPM utvärderar och rapporterar status utan att återge specialistens detaljerade arbete.

---

## v1.1 – Rollidentitet i kommunikationen (2026-07-07)

Förbättring av användbarheten vid praktisk användning av AI Team Framework. Ingen förändring av roller, ansvar eller arbetsflöde — endast tydligare kommunikation.

### Cursor-regler (.cursor/rules/)

Alla åtta `role-*.mdc` har ny sektion **Rollidentitet i kommunikationen**:

- Identitetsrad vid aktivering eller nytt uppdrag (t.ex. `[Solution Architect]`).
- Identitetsraden upprepas inte under samma arbetspass.
- Överlämningsrad vid avslut (t.ex. `Överlämning:\nDocumentation Specialist`).
- Överlämning är kommunikativ markering — aktiverar inte nästa roll automatiskt.

### Dokumentation

- `docs/ai/cursor-implementation.md` – ny undersektion **Rollidentitet och överlämning (kommunikation)** under Output Contract.

---

## v1.0 – AI Team Framework (2026-07-07)

Första fullständiga versionen av AI Team Framework. Ramverket är projektoberoende och redo för produktion.

### Dokumentation

- `docs/ai/engineering-principles.md` – universella engineering-principer för alla roller och projekt.
- `docs/ai/team-workflow.md` – arbetsflöde med stage gates, återkopplingsloopar och kommunikationsregler.
- `docs/ai/cursor-implementation.md` – implementationsprinciper för Cursor, inkl. Output Contract och Kontextkomprimering.

### Roller (docs/ai/roles/)

- `technical-project-manager.md` – koordinerande roll; avgränsar, prioriterar och håller ihop leveransen.
- `solution-architect.md` – äger teknisk lösning och arkitektur.
- `ui-ux-designer.md` – äger användarupplevelse, flöden och gränssnittsdesign.
- `backend-developer.md` – implementerar backend enligt arkitektens design.
- `frontend-developer.md` – implementerar UI enligt design och arkitektur.
- `qa-code-reviewer.md` – teamets kvalitetsgrind; granskar objektivt och godkänner eller underkänner.
- `security-expert.md` – teamets säkerhetsgrind; granskar pragmatiskt och riskbaserat.
- `documentation-specialist.md` – teamets dokumentationsgrind; dokumenterar verifierad implementation.

### Cursor-regler (.cursor/rules/)

- `engineering-principles.mdc` – alltid aktiv (`alwaysApply: true`); universella principer i varje session.
- `role-technical-project-manager.mdc`
- `role-solution-architect.mdc`
- `role-ui-ux-designer.mdc`
- `role-backend-developer.mdc`
- `role-frontend-developer.mdc`
- `role-qa-code-reviewer.mdc`
- `role-security-expert.mdc`
- `role-documentation-specialist.mdc`

### Nyckelkoncept

- **Stage Gates** – sex beslutsgrindar (Grind 1–6) med tydliga ägare och krav för att passera. Grind 2, 3 och 5 är villkorliga och kan markeras N/A av Teknisk Projektledare.
- **Output Contract** – varje roll avslutar sitt arbete med en rollspecifik, strukturerad leverans. Definieras i respektive Cursor-regel.
- **Kontextkomprimering** – princip för att minimera AI-kostnad och säkerställa tydliga överlämningar mellan roller.
- **Single Source of Truth** – `docs/ai/` är alltid primär sanningskälla; Cursor-regler är härledda representationer.
