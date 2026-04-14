#!/usr/bin/env bash
set -euo pipefail

if ! command -v scc >/dev/null 2>&1; then
  echo "scc is required but not found on PATH."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required but not found on PATH."
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SCC_ARGS=(
  --no-cocomo
  --no-complexity
  --format json
  --include-ext "ts,tsx,js,jsx,svelte,css,scss,html,sql,cs"
  --exclude-dir ".git,node_modules,dist,docs,.svelte-kit"
)

MODULES=(
  "server/pcd|src/lib/server/pcd"
  "server/sync|src/lib/server/sync"
  "server/db|src/lib/server/db"
  "server/jobs|src/lib/server/jobs"
  "server/notifications|src/lib/server/notifications"
  "server/upgrades|src/lib/server/upgrades"
  "server/rename|src/lib/server/rename"
  "server/utils|src/lib/server/utils"
  "client/ui|src/lib/client/ui"
  "client/alerts|src/lib/client/alerts"
  "client/stores|src/lib/client/stores"
  "client/utils|src/lib/client/utils"
  "shared/pcd|src/lib/shared/pcd"
  "shared/utils|src/lib/shared/utils"
  "shared/notifications|src/lib/shared/notifications"
  "shared/upgrades|src/lib/shared/upgrades"
  "routes/custom-formats|src/routes/custom-formats"
  "routes/quality-profiles|src/routes/quality-profiles"
  "routes/regular-expressions|src/routes/regular-expressions"
  "routes/delay-profiles|src/routes/delay-profiles"
  "routes/media-management|src/routes/media-management"
  "routes/databases|src/routes/databases"
  "routes/arr|src/routes/arr"
  "routes/settings|src/routes/settings"
  "routes/auth|src/routes/auth"
  "routes/api-v1|src/routes/api/v1"
  "services/parser|src/services/parser"
  "tests/unit/base|tests/unit/base"
  "tests/unit/jobs|tests/unit/jobs"
  "tests/unit/logger|tests/unit/logger"
  "tests/unit/upgrades|tests/unit/upgrades"
  "app-shell|src/app.css,src/app.d.ts,src/app.html,src/hooks.server.ts"
  "schema-reference|src/lib/server/db/schema.sql,docs/backend/0.schema.sql"
)

# Parse JSON safely, returning "0,0,0,0,0,0" on failure
function scc_totals() {
  scc "${SCC_ARGS[@]}" "$@" | python3 -c '
import json, sys
raw = sys.stdin.read().strip()
if not raw:
    print("0,0,0,0,0,0")
    sys.exit(0)
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print("0,0,0,0,0,0")
    sys.exit(0)
totals = {"files": 0, "lines": 0, "code": 0, "comment": 0, "blank": 0, "bytes": 0}
for item in data:
    totals["files"] += item.get("Count", 0)
    totals["lines"] += item.get("Lines", 0)
    totals["code"] += item.get("Code", 0)
    totals["comment"] += item.get("Comment", 0)
    totals["blank"] += item.get("Blank", 0)
    totals["bytes"] += item.get("Bytes", 0)
print("{files},{lines},{code},{comment},{blank},{bytes}".format(**totals))
'
}

# Get per-language breakdown from scc JSON
function scc_languages() {
  scc "${SCC_ARGS[@]}" "$@" | python3 -c '
import json, sys
raw = sys.stdin.read().strip()
if not raw:
    sys.exit(0)
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    sys.exit(0)
for item in data:
    name = item.get("Name", "Unknown")
    files = item.get("Count", 0)
    code = item.get("Code", 0)
    lines = item.get("Lines", 0)
    print(f"{name}\t{files}\t{code}\t{lines}")
'
}

# ── Language Breakdown ────────────────────────────────────────────────
echo "LANGUAGE BREAKDOWN"
echo "=============================================================================="
printf "%-20s %8s %10s %10s %8s\n" "Language" "Files" "Code" "Lines" "% Code"
printf "%-20s %8s %10s %10s %8s\n" "--------" "-----" "----" "-----" "------"

# Collect language data from the whole src/ tree (not per-module)
lang_total_code=0
declare -A lang_files lang_code lang_lines

while IFS=$'\t' read -r name files code lines; do
  lang_files["$name"]=$files
  lang_code["$name"]=$code
  lang_lines["$name"]=$lines
  lang_total_code=$((lang_total_code + code))
done < <(scc_languages "${ROOT}/src")

# Also include docs schema reference
while IFS=$'\t' read -r name files code lines; do
  prev_files="${lang_files[$name]:-0}"
  prev_code="${lang_code[$name]:-0}"
  prev_lines="${lang_lines[$name]:-0}"
  lang_files["$name"]=$((prev_files + files))
  lang_code["$name"]=$((prev_code + code))
  lang_lines["$name"]=$((prev_lines + lines))
  lang_total_code=$((lang_total_code + code))
done < <(scc_languages "${ROOT}/docs/backend/0.schema.sql" 2>/dev/null || true)

# Sort languages by code lines descending
sorted_langs=()
while IFS= read -r lang; do
  sorted_langs+=("$lang")
done < <(
  for lang in "${!lang_code[@]}"; do
    echo "${lang_code[$lang]} $lang"
  done | sort -rn | awk '{print substr($0, index($0,$2))}'
)

for lang in "${sorted_langs[@]}"; do
  files="${lang_files[$lang]}"
  code="${lang_code[$lang]}"
  lines="${lang_lines[$lang]}"
  if [ "$lang_total_code" -gt 0 ]; then
    pct=$(python3 -c "print(f'{${code}/${lang_total_code}*100:.1f}')")
  else
    pct="0.0"
  fi
  printf "%-20s %8d %10d %10d %7s%%\n" "$lang" "$files" "$code" "$lines" "$pct"
done

printf "%-20s %8s %10s %10s %8s\n" "--------" "-----" "----" "-----" "------"
printf "%-20s %8s %10d %10s %7s%%\n" "TOTAL" "" "$lang_total_code" "" "100.0"

# ── Module Breakdown ─────────────────────────────────────────────────
echo ""
echo "MODULE BREAKDOWN"
echo "=============================================================================="
printf "%-28s %8s %8s %8s %8s %8s %7s\n" "Module" "Files" "Lines" "Code" "Comment" "Blank" "% Code"
printf "%-28s %8s %8s %8s %8s %8s %7s\n" "------" "-----" "-----" "----" "-------" "-----" "------"

total_files=0
total_lines=0
total_code=0
total_comment=0
total_blank=0

# Collect all module stats first so we can compute percentages
declare -a mod_names mod_files mod_lines mod_code mod_comment mod_blank

for entry in "${MODULES[@]}"; do
  name="${entry%%|*}"
  path_list="${entry#*|}"
  IFS=',' read -r -a rel_paths <<< "$path_list"
  abs_paths=()
  for rel in "${rel_paths[@]}"; do
    abs_paths+=("${ROOT}/${rel}")
  done

  stats="$(scc_totals "${abs_paths[@]}")"
  IFS=',' read -r files lines code comment blank bytes <<< "$stats"

  mod_names+=("$name")
  mod_files+=("$files")
  mod_lines+=("$lines")
  mod_code+=("$code")
  mod_comment+=("$comment")
  mod_blank+=("$blank")

  total_files=$((total_files + files))
  total_lines=$((total_lines + lines))
  total_code=$((total_code + code))
  total_comment=$((total_comment + comment))
  total_blank=$((total_blank + blank))
done

for i in "${!mod_names[@]}"; do
  if [ "$total_code" -gt 0 ]; then
    pct=$(python3 -c "print(f'{${mod_code[$i]}/${total_code}*100:.1f}')")
  else
    pct="0.0"
  fi
  printf "%-28s %8d %8d %8d %8d %8d %6s%%\n" \
    "${mod_names[$i]}" "${mod_files[$i]}" "${mod_lines[$i]}" "${mod_code[$i]}" "${mod_comment[$i]}" "${mod_blank[$i]}" "$pct"
done

printf "%-28s %8s %8s %8s %8s %8s %7s\n" "------" "-----" "-----" "----" "-------" "-----" "------"
printf "%-28s %8d %8d %8d %8d %8d %6s%%\n" \
  "TOTAL" "$total_files" "$total_lines" "$total_code" "$total_comment" "$total_blank" "100.0"

# ── Summary ──────────────────────────────────────────────────────────
echo ""
echo "SUMMARY"
echo "=============================================================================="
if [ "$total_lines" -gt 0 ]; then
  code_pct=$(python3 -c "print(f'{${total_code}/${total_lines}*100:.1f}')")
  comment_pct=$(python3 -c "print(f'{${total_comment}/${total_lines}*100:.1f}')")
  blank_pct=$(python3 -c "print(f'{${total_blank}/${total_lines}*100:.1f}')")
else
  code_pct="0.0"
  comment_pct="0.0"
  blank_pct="0.0"
fi

printf "  Files:       %6d\n" "$total_files"
printf "  Lines:       %6d\n" "$total_lines"
printf "  Code:        %6d  (%s%%)\n" "$total_code" "$code_pct"
printf "  Comments:    %6d  (%s%%)\n" "$total_comment" "$comment_pct"
printf "  Blanks:      %6d  (%s%%)\n" "$total_blank" "$blank_pct"
printf "  Languages:   %6d\n" "${#lang_code[@]}"
printf "  Modules:     %6d\n" "${#MODULES[@]}"
