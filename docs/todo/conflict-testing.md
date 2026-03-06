# Conflict Resolution Testing

Manual test scenarios for the **override** and **align** conflict strategies.

## How conflicts happen

A conflict occurs when a user op's SQL executes with **rowcount 0** (value guard
mismatch) or throws a **UNIQUE constraint** error (duplicate key) during compile.
This means upstream changed something the user op was targeting.

Two conflict reasons:

- **guard_mismatch** — UPDATE/DELETE op targets a row whose guarded columns no
  longer match (upstream changed the same field).
- **duplicate_key** — CREATE op tries to insert a name that already exists
  (upstream created the same entity).

Two resolution strategies:

- **Override** — re-write the user's desired state on top of the current
  (post-upstream) state. Supersedes the old conflicting op.
- **Align** — drop the user's conflicting op entirely, accepting upstream's
  state.

---

## Setup per test

Each test requires:

1. A linked database instance with user ops enabled.
2. The entity under test exists in the base layer.
3. A user op is created that will conflict with a subsequent base change.
4. A base change is introduced (simulating an upstream sync/pull).
5. Recompile — the user op should show as conflicted.
6. Resolve with **override** or **align** and verify the result.

For **override** tests, verify:

- The entity's final state matches the user's desired values.
- The old user op is superseded (or dropped if desired = current).
- A new user op exists (or no new op if desired already matched).
- Recompile succeeds with no conflicts.

For **align** tests, verify:

- The entity's final state matches upstream's values (user change gone).
- The old user op is dropped.
- No new user op is created.
- Recompile succeeds with no conflicts.

---

## 1. Custom Formats

### 1.1 General — name rename conflict

**Setup:** Base creates CF "x265". User renames it to "x265 Local Rename".
Upstream renames it to "x265 Dev Rename".

**Conflict:** User's UPDATE has a name guard on "x265" but the row is now
"x265 Dev Rename" → guard mismatch.

**E2E spec:** `tests/e2e/pcd/specs/1.1-cf-name-rename.spec.ts`

| #   | Strategy | Expected result                                                                         | Pass  |
| --- | -------- | --------------------------------------------------------------------------------------- | ----- |
| a   | Override | CF is named "x265 Local Rename" (user's desired name). New user op with current guards. | - [x] |
| b   | Align    | CF is named "x265 Dev Rename" (upstream's name). User op dropped.                       | - [x] |

### 1.2 General — description change conflict

**Setup:** Base creates CF "x265". User changes description to
"Local description edit". Upstream changes description to
"Dev description edit".

**Conflict:** Guard mismatch on description column.

**E2E spec:** `tests/e2e/pcd/specs/1.2-cf-description-conflict.spec.ts`

| #   | Strategy | Expected result                          | Pass  |
| --- | -------- | ---------------------------------------- | ----- |
| a   | Override | Description is "Local description edit". | - [x] |
| b   | Align    | Description is "Dev description edit".   | - [x] |

### 1.3 General — include_in_rename auto-align (no conflict)

**Setup:** Base creates CF "x265". User toggles `include_in_rename` from false
to true. Upstream also sets `include_in_rename` to true.

**Expected:** No conflict. The user op is auto-aligned (dropped) because the
desired value already matches the current row.

**E2E spec:** `tests/e2e/pcd/specs/1.3-cf-include-in-rename.spec.ts`

| #   | Check                                                       | Pass  |
| --- | ----------------------------------------------------------- | ----- |
| a   | No conflict appears after pull; `include_in_rename` is true | - [x] |

### 1.4 General — upstream rename + user description change

**Setup:** Base creates CF "x265". User changes description to
"Local description edit". Upstream renames the CF to "x265 Dev Rename".
User op references the old name via stable_key.

**Conflict:** Guard mismatch — row name changed.

**E2E spec:** `tests/e2e/pcd/specs/1.4-cf-upstream-rename-user-description.spec.ts`

| #   | Strategy | Expected result                                                                                  | Pass  |
| --- | -------- | ------------------------------------------------------------------------------------------------ | ----- |
| a   | Override | CF keeps upstream's new name but has user's description. Rename chain resolves the current name. | - [x] |
| b   | Align    | CF has upstream's name and upstream's description.                                               | - [x] |

### 1.5 Conditions — upstream changes same condition

**Setup:** Base creates CF "x265" with condition "Not 2160p" (resolution 2160p).
User changes the condition value to 1080p. Upstream changes it to 720p.

**Conflict:** Guard mismatch on the condition row's value guards.

**E2E spec:** `tests/e2e/pcd/specs/1.5-cf-condition-conflict.spec.ts`

| #   | Strategy | Expected result                                     | Pass  |
| --- | -------- | --------------------------------------------------- | ----- |
| a   | Override | Condition "Not 2160p" uses 1080p (user's desired).  | - [x] |
| b   | Align    | Condition "Not 2160p" uses 720p (upstream's value). | - [x] |

### 1.6 Conditions — upstream adds new condition, user modifies existing

**Setup:** User modifies condition A. Upstream adds condition B (doesn't touch
condition A's guards).

**Expected:** No conflict. User op applies cleanly because it only guards on
condition A's row, which upstream didn't change.

**E2E spec:** `tests/e2e/pcd/specs/1.6-cf-condition-no-conflict.spec.ts`

| #   | Check                      | Pass  |
| --- | -------------------------- | ----- |
| a   | Verify no conflict appears | - [x] |

### 1.7 Conditions — upstream deletes condition user modified

**Setup:** User modifies condition "Source". Upstream deletes condition "Source".

**Conflict:** User's UPDATE targets a row that no longer exists → rowcount 0.

**E2E spec:** `tests/e2e/pcd/specs/1.7-cf-condition-deleted.spec.ts`

| #   | Strategy | Expected result                                                           | Pass  |
| --- | -------- | ------------------------------------------------------------------------- | ----- |
| a   | Override | Condition is re-created with user's desired values (via conditions diff). | - [x] |
| b   | Align    | Condition stays deleted.                                                  | - [x] |

### 1.8 Tests — read-only without PAT

**Setup:** Local ops enabled (no base writes). User attempts to add a test.

**Expected:** UI shows read-only alert and create action is blocked.

**E2E spec:** `tests/e2e/pcd/specs/1.8-cf-tests-readonly.spec.ts`

| #   | Check                                    | Pass  |
| --- | ---------------------------------------- | ----- |
| a   | Add Test is blocked with read-only alert | - [x] |
| b   | Create action fails with read-only error | - [x] |

### 1.9 Create conflict — duplicate key

**Setup:** User creates CF "My Format". Upstream also creates CF "My Format".

**Conflict:** UNIQUE constraint on name.

| #   | Strategy | Expected result                                                                                                      | Pass  |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------- | ----- |
| a   | Override | CF "My Format" has user's desired field values (description, tags, conditions, etc.) written on top of existing row. | - [x] |
| b   | Align    | CF "My Format" has upstream's values. User op dropped.                                                               | - [x] |

### 1.10 Delete conflict — target already changed

**Setup:** User deletes CF "Old Format". Upstream renames it to "New Format".

**Expected:** Auto‑align (no conflict). User DELETE has a name guard on "Old Format" → rowcount 0.

**E2E spec:** `tests/e2e/pcd/specs/1.10-cf-delete-renamed.spec.ts`

| #   | Check                                                    | Pass  |
| --- | -------------------------------------------------------- | ----- |
| a   | No conflict appears after pull; CF remains with new name | - [x] |

### 1.11 Tags only — no conflict expected

**Setup:** User adds a tag to a CF. Upstream changes a guarded field
(description, name, etc.).

**Expected:** Tags don't have value guards. A pure tag-only user op should NOT
conflict. If the user op also touches a guarded field, that op will conflict.

| #   | Check                                        | Pass  |
| --- | -------------------------------------------- | ----- |
| a   | Pure tag-only op does NOT show as conflicted | - [x] |

### 1.12 General multi-field — conflict expected

**Setup:** User changes description only. Upstream changes description,
`include_in_rename`, and tags in the same save.

**Expected:** Conflict (description guard mismatch). Override keeps the user's
description while preserving upstream include/tags. Align keeps upstream
values for all fields.

**E2E spec:** `tests/e2e/pcd/specs/1.12-cf-general-multi-field-conflict.spec.ts`

| #   | Strategy | Expected result                          | Pass  |
| --- | -------- | ---------------------------------------- | ----- |
| a   | Override | Local description; upstream include/tags | - [x] |
| b   | Align    | Upstream description/include/tags        | - [x] |

### 1.13 Conditions — same row changed upstream

**Setup:** User changes a condition value (e.g., Resolution "Not 2160p" → 1080p).
Upstream changes the **same condition row** to a different value.

**Expected:** Conflict (guard mismatch on the condition row).

**E2E spec:** `tests/e2e/pcd/specs/1.13-cf-condition-same-row.spec.ts`

| #   | Check                                       | Pass  |
| --- | ------------------------------------------- | ----- |
| a   | Conflict appears for condition row mismatch | - [x] |

### 1.14 Conditions — type + value changed upstream

**Setup:** User changes a condition's type + value. Upstream changes the same
condition to a different type + value.

**Expected:** Conflict (guard mismatch on base row / values). Override keeps the
user's type + value. Align keeps upstream.

**E2E spec:** `tests/e2e/pcd/specs/1.14-cf-condition-type-value-conflict.spec.ts`

| #   | Strategy | Expected result     | Pass  |
| --- | -------- | ------------------- | ----- |
| a   | Override | User type/value     | - [x] |
| b   | Align    | Upstream type/value | - [x] |

### 1.15 Conditions — multiple rows changed upstream

**Setup:** Upstream seeds two new Source conditions. User changes both in one
save. Upstream changes one overlapping condition plus a separate existing
condition.

**Expected:** Conflict only for the overlapping condition. The non‑conflicting
local condition should still apply (after per‑row ops are implemented).

**E2E spec:** `tests/e2e/pcd/specs/1.15-cf-conditions-multiple-upstream.spec.ts`

| #   | Strategy | Expected result       | Pass  |
| --- | -------- | --------------------- | ----- |
| a   | Override | Local A/B; upstream C | - [x] |
| b   | Align    | Local A; upstream B/C | - [x] |

### 1.16 Delete — upstream already deleted

**Setup:** User deletes a CF. Upstream also deletes the same CF.

**Expected:** Auto‑align (no conflict). User delete hits 0 rows.

| #   | Check                          | Pass  |
| --- | ------------------------------ | ----- |
| a   | No conflict appears after pull | - [x] |

### 1.17 Conditions — rename conflict

**Setup:** User renames a condition (e.g., "Source" → "Source Local"). Upstream
changes the same condition row (e.g., toggles `required`/`negate`).

**Expected:** Conflict on the condition row. Override keeps the user's new name.
Align keeps upstream's values (including the original name).

**E2E spec:** `tests/e2e/pcd/specs/1.17-cf-condition-rename-conflict.spec.ts`

| #   | Strategy | Expected result                      | Pass  |
| --- | -------- | ------------------------------------ | ----- |
| a   | Override | Condition uses user's renamed name   | - [x] |
| b   | Align    | Condition keeps upstream name/values | - [x] |

### 1.18 Conditions — toggle fields conflict

**Setup:** User toggles `required`/`arr_type`. Upstream toggles `negate` on the
same condition row.

**Expected:** Conflict on the condition row. Override keeps the user's toggle
values; align keeps upstream's toggles.

**E2E spec:** `tests/e2e/pcd/specs/1.18-cf-condition-toggle-conflict.spec.ts`

| #   | Strategy | Expected result      | Pass  |
| --- | -------- | -------------------- | ----- |
| a   | Override | User toggles win     | - [x] |
| b   | Align    | Upstream toggles win | - [x] |

### 1.19 Conditions — pattern value conflict

**Setup:** User edits a regex pattern condition. Upstream edits the same pattern
row with a different value.

**Expected:** Conflict on the condition row. Override keeps user's pattern; align
keeps upstream.

**E2E spec:** `tests/e2e/pcd/specs/1.19-cf-condition-pattern-conflict.spec.ts`

| #   | Strategy | Expected result       | Pass  |
| --- | -------- | --------------------- | ----- |
| a   | Override | User pattern wins     | - [x] |
| b   | Align    | Upstream pattern wins | - [x] |

### 1.20 Conditions — language conflict

**Setup:** User edits a language condition. Upstream edits the same language
row with a different value.

**Expected:** Conflict on the condition row. Override keeps user's language;
align keeps upstream.

**E2E spec:** `tests/e2e/pcd/specs/1.20-cf-condition-language-conflict.spec.ts`

| #   | Strategy | Expected result        | Pass  |
| --- | -------- | ---------------------- | ----- |
| a   | Override | User language wins     | - [x] |
| b   | Align    | Upstream language wins | - [x] |

### 1.21 Conditions — size conflict

**Setup:** User edits a size condition (min/max). Upstream edits the same size
row with a different value.

**Expected:** Conflict on the condition row. Override keeps user's size; align
keeps upstream.

**E2E spec:** `tests/e2e/pcd/specs/1.21-cf-condition-size-conflict.spec.ts`

| #   | Strategy | Expected result    | Pass  |
| --- | -------- | ------------------ | ----- |
| a   | Override | User size wins     | - [x] |
| b   | Align    | Upstream size wins | - [x] |

### 1.22 Conditions — year conflict

**Setup:** User edits a year condition (min/max). Upstream edits the same year
row with a different value.

**Expected:** Conflict on the condition row. Override keeps user's year; align
keeps upstream.

**E2E spec:** `tests/e2e/pcd/specs/1.22-cf-condition-year-conflict.spec.ts`

| #   | Strategy | Expected result    | Pass  |
| --- | -------- | ------------------ | ----- |
| a   | Override | User year wins     | - [x] |
| b   | Align    | Upstream year wins | - [x] |

### 1.23 Conditions — regex dependency pattern change

**Setup:** A condition references a named regex dependency. Upstream changes
the regex **pattern** (name unchanged). User updates the condition.

**Expected:** No conflict on the condition row. The condition update applies
and the regex pattern update applies.

**E2E spec:** `tests/e2e/pcd/specs/1.23-cf-condition-regex-dependency-conflict.spec.ts`

| #   | Check                                                  | Pass  |
| --- | ------------------------------------------------------ | ----- |
| a   | No conflict appears; condition keeps user's dependency | - [x] |

### 1.24 General — tag removal vs upstream tag change

**Setup:** User removes a tag. Upstream adds or removes a different tag on the
same CF.

**Expected:** No conflict. Final tags reflect upstream changes plus the user's
removal.

**E2E spec:** `tests/e2e/pcd/specs/1.24-cf-tags-remove-upstream-change.spec.ts`

| #   | Check                                  | Pass  |
| --- | -------------------------------------- | ----- |
| a   | No conflict; tags match expected merge | - [x] |

### 1.25 General — local update while upstream deletes CF

**Setup:** User updates CF general fields. Upstream deletes the CF.

**Expected:** Conflict on the user update. Override re-creates the CF with the
user's desired values. Align keeps the CF deleted.

**E2E spec:** `tests/e2e/pcd/specs/1.25-cf-update-upstream-deleted.spec.ts`

| #   | Strategy | Expected result                  | Pass  |
| --- | -------- | -------------------------------- | ----- |
| a   | Override | CF re-created with user's values | - [x] |
| b   | Align    | CF remains deleted               | - [x] |

### 1.26 General — local rename + upstream update (no conflict)

**Setup:** User renames CF. Upstream updates description.

**Expected:** No conflict. Final CF keeps user's name and upstream description.

**E2E spec:** `tests/e2e/pcd/specs/1.26-cf-local-rename-upstream-update.spec.ts`

| #   | Check                                            | Pass  |
| --- | ------------------------------------------------ | ----- |
| a   | No conflict; renamed CF has upstream description | - [x] |

### 1.27 General — local rename + local description vs upstream description

**Setup:** User renames CF and updates description in one save. Upstream updates
description only.

**Expected:** Conflict on description. Override keeps the user's new name +
local description. Align keeps upstream name + upstream description.

**E2E spec:** `tests/e2e/pcd/specs/1.27-cf-local-rename-upstream-description.spec.ts`

| #   | Strategy | Expected result                      | Pass  |
| --- | -------- | ------------------------------------ | ----- |
| a   | Override | User name + user description         | - [x] |
| b   | Align    | Upstream name + upstream description | - [x] |

### 1.28 Conditions — dependsOn regex renamed upstream

**Setup:** A condition references a regex by name. User modifies the condition
(e.g. toggles negate). Upstream renames the referenced regex.

**Expected:** Conflict (guard_mismatch — condition op references old regex name).
Override should resolve the rename chain and preserve the local condition change.
Align drops local change, upstream rename preserved.

**E2E spec:** `tests/e2e/pcd/specs/1.28-cf-condition-depends-on-regex-renamed.spec.ts`

| #   | Strategy | Expected result                                           | Pass  |
| --- | -------- | --------------------------------------------------------- | ----- |
| a   | Override | Condition change preserved, regex rename applied          | - [ ] |
| b   | Align    | Upstream rename preserved, local condition change dropped | - [ ] |

### 1.29 Conditions — dependsOn regex deleted upstream

**Setup:** A condition references a regex by name. User modifies the condition.
Upstream deletes the referenced regex.

**Expected:** Conflict. Override resolves but condition referencing deleted regex
is necessarily lost (dependency gone). Align drops local change, regex absent.

**E2E spec:** `tests/e2e/pcd/specs/1.29-cf-condition-depends-on-regex-deleted.spec.ts`

| #   | Strategy | Expected result                                             | Pass  |
| --- | -------- | ----------------------------------------------------------- | ----- |
| a   | Override | Conflict resolves, condition referencing deleted regex lost | - [ ] |
| b   | Align    | Upstream delete preserved, condition absent                 | - [ ] |

---

## 2. Quality Profiles

Comprehensive QP conflict coverage modeled after CF learnings.

### Execution Order

1. Non-overlapping no-conflict checks: `2.1`-`2.5`
2. Auto-align checks: `2.6`-`2.16`
3. Rename conflicts: `2.17`-`2.22`
4. General field conflicts: `2.23`-`2.26`
5. Qualities conflicts: `2.27`-`2.31`
6. Scoring conflicts: `2.32`-`2.39`
7. Lifecycle (create/delete): `2.40`-`2.43`
8. Dependencies: `2.44`-`2.45`
9. Real world use case: `2.46`

### 2.1-2.5 Non-Overlapping No-Conflict

| ID  | Scenario                                      | Type        | Expected                                          | E2E spec                                                                  | Pass  |
| --- | --------------------------------------------- | ----------- | ------------------------------------------------- | ------------------------------------------------------------------------- | ----- |
| 2.1 | Tags-only local vs upstream description       | No conflict | Tag change applies; upstream description applies  | `tests/e2e/pcd/specs/2.1-qp-tags-only-vs-upstream-description.spec.ts`    | - [x] |
| 2.2 | Local rename vs upstream description          | No conflict | Local name persists; upstream description applies | `tests/e2e/pcd/specs/2.2-qp-local-rename-vs-upstream-description.spec.ts` | - [x] |
| 2.3 | Local description vs upstream tags            | No conflict | Local description persists; upstream tags merge   | `tests/e2e/pcd/specs/2.3-qp-local-description-vs-upstream-tags.spec.ts`   | - [x] |
| 2.4 | Local scoring-only vs upstream general-only   | No conflict | Both non-overlapping changes apply                | `tests/e2e/pcd/specs/2.4-qp-local-scoring-vs-upstream-general.spec.ts`    | - [x] |
| 2.5 | Local qualities-only vs upstream scoring-only | No conflict | Both non-overlapping changes apply                | `tests/e2e/pcd/specs/2.5-qp-local-qualities-vs-upstream-scoring.spec.ts`  | - [x] |

### 2.6-2.16 Auto-Align

| ID   | Scenario                                                   | Type       | Expected                                               | E2E spec                                                                                    | Pass  |
| ---- | ---------------------------------------------------------- | ---------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ----- |
| 2.6  | Local description change, upstream same value              | Auto-align | No conflict row; user op dropped                       | `tests/e2e/pcd/specs/2.6-qp-description-same-value-auto-align.spec.ts`                      | - [x] |
| 2.7  | Local delete, upstream already deleted                     | Auto-align | No conflict row; profile remains deleted               | `tests/e2e/pcd/specs/2.7-qp-delete-upstream-deleted-auto-align.spec.ts`                     | - [x] |
| 2.8  | Local delete, upstream renamed                             | Auto-align | No conflict row; profile persists under upstream name  | `tests/e2e/pcd/specs/2.8-qp-delete-upstream-renamed-auto-align.spec.ts`                     | - [x] |
| 2.9  | Local qualities desired already matches upstream           | Auto-align | No conflict row; user op dropped                       | `tests/e2e/pcd/specs/2.9-qp-qualities-desired-matches-upstream-auto-align.spec.ts`          | - [x] |
| 2.10 | Local delete vs upstream rename                            | Auto-align | No conflict row; profile persists with upstream rename | `tests/e2e/pcd/specs/2.10-qp-delete-vs-upstream-rename-auto-align.spec.ts`                  | - [x] |
| 2.11 | Local minimum score change, upstream sets same value       | Auto-align | No conflict row; user op dropped                       | `tests/e2e/pcd/specs/2.11-qp-scoring-minimum-score-same-value-auto-align.spec.ts`           | - [x] |
| 2.12 | Local upgrade-until score change, upstream sets same value | Auto-align | No conflict row; user op dropped                       | `tests/e2e/pcd/specs/2.12-qp-scoring-upgrade-until-score-same-value-auto-align.spec.ts`     | - [x] |
| 2.13 | Local score increment change, upstream sets same value     | Auto-align | No conflict row; user op dropped                       | `tests/e2e/pcd/specs/2.13-qp-scoring-upgrade-score-increment-same-value-auto-align.spec.ts` | - [x] |
| 2.14 | Local CF score change, upstream sets same score            | Auto-align | No conflict row; user op dropped                       | `tests/e2e/pcd/specs/2.14-qp-scoring-cf-score-same-value-auto-align.spec.ts`                | - [x] |
| 2.15 | Local add CF score row, upstream adds same row/value       | Auto-align | No conflict row; user op dropped                       | `tests/e2e/pcd/specs/2.15-qp-scoring-add-cf-score-same-value-auto-align.spec.ts`            | - [x] |
| 2.16 | Local remove CF score row, upstream already removed row    | Auto-align | No conflict row; user op dropped                       | `tests/e2e/pcd/specs/2.16-qp-scoring-remove-cf-score-upstream-removed-auto-align.spec.ts`   | - [x] |

### 2.17-2.22 Rename Family

| ID   | Scenario                                         | Type     | Expected                                                                                 | E2E spec                                                                               | Pass  |
| ---- | ------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----- |
| 2.17 | Rename vs rename                                 | Conflict | Override: local rename. Align: upstream rename                                           | `tests/e2e/pcd/specs/2.17-qp-rename-vs-rename-conflict.spec.ts`                        | - [x] |
| 2.18 | Upstream rename + local description              | Conflict | Override: upstream name + local description. Align: upstream name + upstream description | `tests/e2e/pcd/specs/2.18-qp-upstream-rename-local-description-conflict.spec.ts`       | - [x] |
| 2.19 | Upstream rename + local scoring                  | Conflict | Override: upstream name + local scoring. Align: upstream name + upstream scoring         | `tests/e2e/pcd/specs/2.19-qp-upstream-rename-local-scoring-conflict.spec.ts`           | - [x] |
| 2.20 | Upstream rename + local qualities                | Conflict | Override: upstream name + local qualities. Align: upstream name + upstream qualities     | `tests/e2e/pcd/specs/2.20-qp-upstream-rename-local-qualities-conflict.spec.ts`         | - [x] |
| 2.21 | Local rename+description vs upstream description | Conflict | Override: local name + local description. Align: upstream name + upstream description    | `tests/e2e/pcd/specs/2.21-qp-local-rename-description-vs-upstream-description.spec.ts` | - [x] |
| 2.22 | Local rename+scoring vs upstream scoring         | Conflict | Override: local name + local scoring. Align: upstream name + upstream scoring            | `tests/e2e/pcd/specs/2.22-qp-local-rename-scoring-vs-upstream-scoring.spec.ts`         | - [x] |

### 2.23-2.26 General Field Conflicts

| ID   | Scenario                     | Type        | Expected                                                                         | E2E spec                                                             | Pass  |
| ---- | ---------------------------- | ----------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----- |
| 2.23 | Description conflict         | Conflict    | Override: local description. Align: upstream description                         | `tests/e2e/pcd/specs/2.23-qp-description-conflict.spec.ts`           | - [x] |
| 2.24 | Language conflict            | Conflict    | Override: local language. Align: upstream language                               | `tests/e2e/pcd/specs/2.24-qp-language-conflict.spec.ts`              | - [x] |
| 2.25 | Tag remove/add overlap merge | No conflict | Expected merged tags, no conflict row                                            | `tests/e2e/pcd/specs/2.25-qp-tags-overlap-merge-no-conflict.spec.ts` | - [x] |
| 2.26 | General multi-field conflict | Conflict    | Override: local guarded fields, upstream non-guarded. Align: upstream full state | `tests/e2e/pcd/specs/2.26-qp-general-multi-field-conflict.spec.ts`   | - [x] |

### 2.27-2.31 Qualities (Full-Replace Surface)

| ID   | Scenario                                      | Type     | Expected                                                                   | E2E spec                                                                      | Pass  |
| ---- | --------------------------------------------- | -------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----- |
| 2.27 | Reorder vs reorder                            | Conflict | Override: local order. Align: upstream order                               | `tests/e2e/pcd/specs/2.27-qp-qualities-reorder-vs-reorder.spec.ts`            | - [x] |
| 2.28 | Local add group vs upstream reorder           | Conflict | Override: local list with group. Align: upstream list without group        | `tests/e2e/pcd/specs/2.28-qp-qualities-add-group-vs-reorder.spec.ts`          | - [x] |
| 2.29 | Local remove group vs upstream reorder        | Conflict | Override: local group removal. Align: upstream list                        | `tests/e2e/pcd/specs/2.29-qp-qualities-remove-group-vs-reorder.spec.ts`       | - [x] |
| 2.30 | Local upgrade-until toggle vs upstream toggle | Conflict | Override: local toggle state. Align: upstream toggle state                 | `tests/e2e/pcd/specs/2.30-qp-qualities-upgrade-until-toggle-conflict.spec.ts` | - [x] |
| 2.31 | Local enabled toggles vs upstream order       | Conflict | Override: local enabled states + local list. Align: upstream list + states | `tests/e2e/pcd/specs/2.31-qp-qualities-enabled-toggles-vs-order.spec.ts`      | - [x] |

### 2.32-2.39 Scoring

| ID   | Scenario                                            | Type        | Expected                                                                         | E2E spec                                                                              | Pass  |
| ---- | --------------------------------------------------- | ----------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----- |
| 2.32 | `minimum_custom_format_score` conflict              | Conflict    | Override: local value. Align: upstream value                                     | `tests/e2e/pcd/specs/2.32-qp-scoring-minimum-score-conflict.spec.ts`                  | - [x] |
| 2.33 | `upgrade_until_score` conflict                      | Conflict    | Override: local value. Align: upstream value                                     | `tests/e2e/pcd/specs/2.33-qp-scoring-upgrade-until-score-conflict.spec.ts`            | - [x] |
| 2.34 | `upgrade_score_increment` conflict                  | Conflict    | Override: local value. Align: upstream value                                     | `tests/e2e/pcd/specs/2.34-qp-scoring-upgrade-score-increment-conflict.spec.ts`        | - [x] |
| 2.35 | CF score same row (`custom_format_name + arr_type`) | Conflict    | Override: local score. Align: upstream score                                     | `tests/e2e/pcd/specs/2.35-qp-scoring-cf-score-same-row-conflict.spec.ts`              | - [x] |
| 2.36 | CF score different `arr_type`                       | No conflict | Both scores apply on separate rows                                               | `tests/e2e/pcd/specs/2.36-qp-scoring-cf-score-different-arr-type-no-conflict.spec.ts` | - [x] |
| 2.37 | Local add CF score vs upstream add same row         | Conflict    | Override: local row value. Align: upstream row value                             | `tests/e2e/pcd/specs/2.37-qp-scoring-add-cf-score-vs-upstream-add-same-row.spec.ts`   | - [x] |
| 2.38 | Local delete CF score vs upstream update same row   | Conflict    | Override: row removed. Align: upstream updated row remains                       | `tests/e2e/pcd/specs/2.38-qp-scoring-delete-cf-score-vs-upstream-update.spec.ts`      | - [x] |
| 2.39 | Mixed scoring op vs upstream profile-field change   | Conflict    | Override: local mixed desired state. Align: upstream profile settings and scores | `tests/e2e/pcd/specs/2.39-qp-scoring-mixed-op-vs-upstream-profile-field.spec.ts`      | - [x] |

### 2.40-2.43 Lifecycle (Create/Delete)

| ID   | Scenario                                                   | Type        | Expected                                                                             | E2E spec                                                                    | Pass  |
| ---- | ---------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ----- |
| 2.40 | Create duplicate (general-only payload)                    | Conflict    | Override: local general values. Align: upstream general values                       | `tests/e2e/pcd/specs/2.40-qp-create-duplicate-general-only.spec.ts`         | - [x] |
| 2.41 | Local general update while upstream deletes profile        | Conflict    | Override: profile re-created with local general values. Align: profile stays deleted | `tests/e2e/pcd/specs/2.41-qp-local-general-update-upstream-deleted.spec.ts` | - [x] |
| 2.42 | Create duplicate (full payload: general+qualities+scoring) | Conflict    | Override: local full desired state. Align: upstream full state                       | `tests/e2e/pcd/specs/2.42-qp-create-duplicate-full-payload.spec.ts`         | - [x] |
| 2.43 | Local delete vs upstream general update                    | No conflict | Delete remains effective; profile absent locally                                     | `tests/e2e/pcd/specs/2.43-qp-delete-vs-upstream-general-update.spec.ts`     | - [x] |

### 2.44-2.45 Dependencies

| ID   | Scenario                              | Type                | Expected                                                                                       | E2E spec                                                            | Pass  |
| ---- | ------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----- |
| 2.44 | Scoring dependsOn CF renamed upstream | Dependency conflict | Override: rename chain resolves, local score preserved. Align: upstream rename, original score | `tests/e2e/pcd/specs/2.44-qp-scoring-depends-on-cf-renamed.spec.ts` | - [x] |
| 2.45 | Scoring dependsOn CF deleted upstream | Dependency conflict | Override/align: conflict resolves, score lost (CF gone)                                        | `tests/e2e/pcd/specs/2.45-qp-scoring-depends-on-cf-deleted.spec.ts` | - [x] |

### 2.46 Real World Use Case

Use one realistic mixed edit across general, scoring, and qualities.

**Local changes (`1080p Balanced`):**

- Language: `Any` -> `Chinese`
- Add tag: `Streaming Optimised`
- Description: add `Chinese` before `1080p **WEB-DLs**`
- Scoring: set `minimum_custom_format_score = 0`
- Scoring: set `upgrade_score_increment = 10000`
- Scoring: set Sonarr/Radarr scores for `MUBI`, `SHO`, `DRPO` to the same value as `AMZN`
- Scoring: set Sonarr/Radarr scores for `h265` and `x265` to `0`
- Qualities (`1080p Balanced` group): add `HDTV-1080p` to existing members
- Add group `Prereleases` with members `CAM`, `DVDSCR`, `REGIONAL`, `TELECINE`, `TELESYNC`, `WORKPRINT`
- Move `Prereleases` to position `3` (`1080p Balanced` > `720p Quality` > `480p Quality` > `Prereleases`)

**Dev changes (overlapping + non-overlapping):**

Conflicting (overlaps with local):

- Description: change `- Average Movie Sizes ~ 4 to 8gb per Movie` to `- Average Movie Sizes ~ 4 to 10gb per Movie`
- Scoring: set `minimum_custom_format_score = 10000`
- Scoring: set `SHO` scores (`radarr`, `sonarr`) to `-250`
- Scoring: set `DRPO` score (`radarr`) to `150`
- Add group `Prereleases` with the same members, placed at position `3` (same as local)

Non-conflicting (local didn't touch these):

- Add tag: `Recommended`
- Scoring: set `upgrade_until_score = 50000`
- Scoring: set `NF` score (`radarr`) to `500`
- Scoring: set `ATVP` score (`sonarr`) to `750`

| ID    | Scenario          | Type                | Expected                                                                                                      | E2E spec                                                  | Pass  |
| ----- | ----------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----- |
| 2.46a | Ask strategy      | Real-world conflict | 6 conflict rows appear on pull; non-conflicting dev changes (tag, upgradeUntilScore, NF, ATVP) apply cleanly. | `tests/e2e/pcd/specs/2.46-qp-real-world-use-case.spec.ts` | - [ ] |
| 2.46b | Override strategy | Real-world conflict | Conflicts auto-resolve by strategy; no conflict rows remain; local desired values win on conflicting fields.  | `tests/e2e/pcd/specs/2.46-qp-real-world-use-case.spec.ts` | - [ ] |
| 2.46c | Align strategy    | Real-world conflict | Conflicts auto-drop by strategy; no conflict rows remain; upstream values win on conflicting fields.          | `tests/e2e/pcd/specs/2.46-qp-real-world-use-case.spec.ts` | - [ ] |

---

## 3. Regular Expressions

Regex entity: name, pattern, description, regex101_id, tags. All fields on one
edit page (no sub-tabs like QPs). Base data regexes used: `126811`, `3D`, `3L`.

### 3.1 Pattern change conflict

**Setup:** Local changes regex "126811" pattern to `\bLOCAL_3_1\b`. Dev changes
same pattern to `\bDEV_3_1\b`. Dev pushes, local pulls.

**Conflict:** Guard mismatch on pattern column.

**E2E spec:** `tests/e2e/pcd/specs/3.1-regex-pattern-conflict.spec.ts`

| #   | Strategy | Expected result                         | Pass  |
| --- | -------- | --------------------------------------- | ----- |
| a   | Override | Pattern is `\bLOCAL_3_1\b` (local wins) | - [x] |
| b   | Align    | Pattern is `\bDEV_3_1\b` (dev wins)     | - [x] |

### 3.2 Name rename conflict

**Setup:** Local renames regex "126811" to "126811 Local Rename". Dev renames it
to "126811 Dev Rename". Dev pushes, local pulls.

**Conflict:** Guard mismatch on name column.

**E2E spec:** `tests/e2e/pcd/specs/3.2-regex-name-rename-conflict.spec.ts`

| #   | Strategy | Expected result                                | Pass  |
| --- | -------- | ---------------------------------------------- | ----- |
| a   | Override | Regex named "126811 Local Rename" (local wins) | - [x] |
| b   | Align    | Regex named "126811 Dev Rename" (dev wins)     | - [x] |

### 3.3 Upstream rename + user pattern change

**Setup:** Local changes pattern on regex "3D". Dev renames "3D" to "3D Dev
Rename". Dev pushes, local pulls.

**Conflict:** Guard mismatch — name changed upstream so local pattern op fails.

**E2E spec:** `tests/e2e/pcd/specs/3.3-regex-upstream-rename-user-pattern.spec.ts`

| #   | Strategy | Expected result                                               | Pass  |
| --- | -------- | ------------------------------------------------------------- | ----- |
| a   | Override | Regex has dev's name, local's pattern. Rename chain resolves. | - [x] |
| b   | Align    | Regex has dev's name and dev's pattern. Local op dropped.     | - [x] |

### 3.4 Description conflict

**Setup:** Local changes description on regex "3D". Dev changes description to
something different. Dev pushes, local pulls.

**Conflict:** Guard mismatch on description.

**E2E spec:** `tests/e2e/pcd/specs/3.4-regex-description-conflict.spec.ts`

| #   | Strategy | Expected result        | Pass  |
| --- | -------- | ---------------------- | ----- |
| a   | Override | Local description wins | - [x] |
| b   | Align    | Dev description wins   | - [x] |

### 3.5 Create conflict — duplicate key

**Setup:** Local creates regex "E2E Duplicate". Dev also creates regex
"E2E Duplicate" (different pattern/description). Dev pushes, local pulls.

**Conflict:** UNIQUE constraint on name.

**E2E spec:** `tests/e2e/pcd/specs/3.5-regex-create-duplicate.spec.ts`

| #   | Strategy | Expected result                                     | Pass  |
| --- | -------- | --------------------------------------------------- | ----- |
| a   | Override | "E2E Duplicate" has local's pattern/description     | - [x] |
| b   | Align    | "E2E Duplicate" has dev's values. Local op dropped. | - [x] |

### 3.6 Delete vs upstream rename (auto-align)

**Setup:** Local deletes regex "3L". Dev renames "3L" to "3L Dev Rename". Dev
pushes, local pulls.

**Expected:** Auto-align (no conflict). Local DELETE has a name guard on "3L"
but the row is now renamed → rowcount 0 → auto-dropped.

**E2E spec:** `tests/e2e/pcd/specs/3.6-regex-delete-vs-upstream-rename.spec.ts`

| #   | Check                                               | Pass  |
| --- | --------------------------------------------------- | ----- |
| a   | No conflict appears; regex persists with dev's name | - [x] |

### 3.7 Tags only — no conflict expected

**Setup:** Local adds a tag to regex "3L". Dev changes pattern on the same
regex. Dev pushes, local pulls.

**Expected:** Tags don't have value guards. Pure tag op should not conflict.

**E2E spec:** `tests/e2e/pcd/specs/3.7-regex-tags-no-conflict.spec.ts`

| #   | Check                                                    | Pass  |
| --- | -------------------------------------------------------- | ----- |
| a   | No conflict appears; tag applied and dev pattern applied | - [x] |

---

## 4–10. Removed — Local Ops Disabled

**Decision:** Local ops (user-layer edits) will be disabled for the following
entity types. These entities are small enough to be atomic units — if you're
changing one, you're essentially creating a new one. The conflict resolution
overhead isn't justified.

- **Delay Profiles** (sections 4)
- **Naming — Radarr** (section 5)
- **Naming — Sonarr** (section 6)
- **Media Settings — Radarr** (section 7)
- **Media Settings — Sonarr** (section 8)
- **Quality Definitions — Radarr** (section 9)
- **Quality Definitions — Sonarr** (section 10)

**Exception:** Regular Expressions (section 3) keep local ops because CF
conditions reference regexes by name. Without local edit, overriding a pattern
would require creating a new regex and updating every dependent CF condition.

**TODO:** Implement UI/server guards to block local edits on these entities,
similar to how CF tests and entity testing already enforce read-only mode.

---

## 11. Cross-cutting edge cases

### E.1 Desired state already matches current

**Setup:** User changes CF description to "foo". Upstream also changes it to
"foo" (same value).

**Conflict:** Guard mismatch (upstream changed the guarded field), but the
desired "to" value matches what's already there.

| #   | Strategy | Expected result                                               | Pass  |
| --- | -------- | ------------------------------------------------------------- | ----- |
| a   | Override | No new op written. Old op is dropped (not superseded). No-op. | - [ ] |
| b   | Align    | Old op dropped. Same result.                                  | - [ ] |

### E.2 Upstream rename chain — multiple renames

**Setup:** Base creates regex "A". Upstream renames "A" → "B" in one sync, then
"B" → "C" in a later sync. User's op targets "A".

| #   | Strategy | Expected result                                                                                     | Pass  |
| --- | -------- | --------------------------------------------------------------------------------------------------- | ----- |
| a   | Override | `followRenameChain` resolves "A" → "B" → "C". Override applies user's desired values to entity "C". | - [ ] |
| b   | Align    | Op dropped. Entity "C" has upstream's values.                                                       | - [ ] |

### E.3 Entity deleted by upstream

**Setup:** User updates CF "Gone". Upstream deletes CF "Gone".

**Conflict:** User op targets a row that no longer exists → rowcount 0.

| #   | Strategy | Expected result                                                                   | Pass  |
| --- | -------- | --------------------------------------------------------------------------------- | ----- |
| a   | Override | `resolveFormatName` returns null. Override fails with error. Op stays conflicted. | - [ ] |
| b   | Align    | Op dropped. Entity stays deleted.                                                 | - [ ] |

### E.4 Multiple user ops on same entity

**Setup:** User has two published ops on CF "Test": one changes description, one
changes conditions. Upstream changes the CF name.

**Expected:** Both ops conflict. Each must be resolved independently.

| #   | Strategy                     | Expected result                                               | Pass  |
| --- | ---------------------------- | ------------------------------------------------------------- | ----- |
| a   | Override both                | Both ops superseded. Two new ops written with current guards. | - [ ] |
| b   | Align both                   | Both ops dropped.                                             | - [ ] |
| c   | Override first, align second | First op's change applied, second op dropped.                 | - [ ] |

### E.5 Group ops — regex rename with dependent conditions

**Setup:** User renames regex "A" to "B". This generates a group of ops: the
regex rename + condition_patterns updates for each dependent CF. Upstream also
renames the regex.

**Conflict:** The regex op conflicts. The dependent condition ops may also
conflict if the condition_patterns rows changed.

| #   | Strategy | Expected result                                                                   | Pass  |
| --- | -------- | --------------------------------------------------------------------------------- | ----- |
| a   | Override | Regex gets user's desired name. Dependent condition ops need separate resolution. | - [ ] |
| b   | Align    | All group ops dropped. Upstream's rename stands.                                  | - [ ] |

### E.6 Conflicting op references nonexistent desired_state field

**Setup:** An op conflicts but its `desired_state` is malformed or missing
expected fields.

| #   | Strategy | Expected result                                                                                        | Pass  |
| --- | -------- | ------------------------------------------------------------------------------------------------------ | ----- |
| a   | Override | Falls back to current values for any missing fields. Only fields present in desired_state are changed. | - [ ] |
| b   | Align    | Op dropped regardless of desired_state content.                                                        | - [ ] |

### E.7 Cache not available

**Setup:** Database instance is disabled or cache build failed.

| #   | Strategy | Expected result                                                                | Pass  |
| --- | -------- | ------------------------------------------------------------------------------ | ----- |
| a   | Override | Returns error "Cache not available". Op stays conflicted.                      | - [ ] |
| b   | Align    | Op dropped (align doesn't need cache). Recompile skipped if instance disabled. | - [ ] |

### E.8 Auto-align behavior (strategy = "align")

When the database's conflict strategy is `align`, conflicts are auto-resolved
during compile:

- **Updates** where the desired "to" values already match current state are
  auto-dropped.
- **Deletes** where the target entity no longer exists are auto-dropped.
- All other conflicts are force-dropped (strategy = align drops everything).

| #   | Check                                                                                                       | Pass  |
| --- | ----------------------------------------------------------------------------------------------------------- | ----- |
| a   | With strategy `align`, conflicting ops never appear on the conflicts page — silently dropped during compile | - [ ] |

### E.9 Auto-align behavior (strategy = "override" or "ask")

With non-align strategies, auto-align still kicks in for safe cases:

- Delete of an already-deleted entity → auto-dropped.
- Update where desired "to" already matches current → auto-dropped.

Other conflicts are recorded as `conflicted` (override) or `conflicted_pending`
(ask) and appear on the conflicts page.

| #   | Check                                                                                        | Pass  |
| --- | -------------------------------------------------------------------------------------------- | ----- |
| a   | Update conflict where desired matches current does NOT show on conflicts page (auto-aligned) | - [ ] |
| b   | Delete conflict where entity already deleted does NOT show on conflicts page (auto-aligned)  | - [ ] |
| c   | Other conflicts DO show on the conflicts page                                                | - [ ] |
