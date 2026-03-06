# Op Splitting Checklist

Goal: split multi-field updates into separate ops so non-conflicting changes can survive align and conflicts are per-field/row.

Status legend: `- [ ]` pending, `- [x]` done.

**1. Custom Formats**

- [x] CF general: split tags vs guarded fields (name/description/include_in_rename).
- [x] CF conditions: split per condition change (add/update/delete per row).
- [x] CF tests: leave as-is (not needed).

**2. Regular Expressions**

- [ ] Regex general: split tags vs guarded fields (name/description/pattern).

**3. Quality Profiles**

- [x] QP general: split tags vs guarded fields (name/description/upgradeAllowed/cutoff).
- [x] QP qualities: split per quality row change.
- [x] QP scoring: split per custom format score row change.

**4. Delay Profiles**

- [ ] Delay profile general: split tags vs guarded fields (name/description/order).
- [ ] Delay profile values: split per protocol/quality row change.

**5. Media Management**

- [ ] Naming: split per naming row change (radarr/sonarr).
- [ ] Media settings: split per setting row change (radarr/sonarr).
- [ ] Quality definitions: split per quality row change (radarr/sonarr).

**6. Conflict/Align Behavior**

- [ ] Define expected behavior per op type after split (docs update).
- [ ] Add/update E2E tests for partial-keep scenarios.
