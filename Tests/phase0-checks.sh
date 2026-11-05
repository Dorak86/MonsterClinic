#!/usr/bin/env bash
# Automatische Pruefungen Phase 0 (Pflichtenheft Abschnitt 9).
# Uebergangsloesung, bis NUnit verfuegbar ist; laeuft in GitHub Actions und lokal (Git Bash unter Windows).
# Voraussetzung: "dotnet build -c Release" wurde ausgefuehrt.
set -u
cd "$(dirname "$0")/.."

CC=Tools/ContentCheck/bin/Release/net8.0/contentcheck
SIM=Tools/SimCli/bin/Release/net8.0/simcli
[ -f "$CC.exe" ] && CC="$CC.exe"
[ -f "$SIM.exe" ] && SIM="$SIM.exe"

PASS=0
FAIL=0
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

ok()   { echo "BESTANDEN  $1"; PASS=$((PASS+1)); }
bad()  { echo "FEHLGESCHLAGEN  $1"; FAIL=$((FAIL+1)); }

# Kopiert die echten Inhalte in einen Testordner, damit Fehler gezielt eingebaut werden koennen.
fresh() { rm -rf "$TMP/c"; cp -r Content "$TMP/c"; }

# Erwartet Exitcode 1 und eine Meldung, die den Suchtext enthaelt.
expect_error() {
  local name="$1" needle="$2"
  local out code
  out=$("$CC" --content "$TMP/c" 2>&1); code=$?
  if [ $code -eq 1 ] && grep -qF -- "$needle" <<<"$out"; then ok "$name"; else bad "$name (Exit $code)"; echo "$out" | head -5; fi
}

# T0-02: Kern ohne Unity
if grep -rqs "UnityEngine" Sim --include=*.cs --include=*.csproj; then bad "T0-02 Kern enthaelt keinen Verweis auf UnityEngine"; else ok "T0-02 Kern enthaelt keinen Verweis auf UnityEngine"; fi

# T0-03 Basis: echte Inhalte sind fehlerfrei
if "$CC" --content Content >/dev/null; then ok "T0-03a Echte Inhalte fehlerfrei"; else bad "T0-03a Echte Inhalte fehlerfrei"; fi

# T0-03: falscher Verweis
fresh; sed -i 's/"species.goblin"/"species.gobblin"/' "$TMP/c/diseases/goblin_depression.json"
expect_error "T0-03b Falscher Verweis wird mit Datei, Feld und Grund gemeldet" "diseases/goblin_depression.json: Feld 'species[0]': Verweis auf unbekannte ID 'species.gobblin'"

# T0-03: Schemafehler (unerlaubter Wert)
fresh; sed -i 's/"severity": "medium"/"severity": "huge"/' "$TMP/c/diseases/goblin_depression.json"
expect_error "T0-03c Unerlaubter Wert wird gemeldet" "Feld 'severity': Wert \"huge\" nicht erlaubt"

# T0-03: doppelte ID
fresh; cp "$TMP/c/symptoms/staggering.json" "$TMP/c/symptoms/staggering_copy.json"
expect_error "T0-03d Doppelte ID wird gemeldet" "ID 'symptom.staggering' ist mehrfach vergeben"

# T0-04: fehlender Sprachschluessel
fresh; grep -v '"disease.zombie_rot.name"' "$TMP/c/localization/en.json" > "$TMP/en.json" && mv "$TMP/en.json" "$TMP/c/localization/en.json"
expect_error "T0-04 Fehlender Sprachschluessel in EN wird gemeldet" "Sprachschluessel 'disease.zombie_rot.name' fehlt in localization/en.json"

# T0-05: Logzeile mit Tick, System, Entitaet; Absturzbericht
R="$TMP/root"
"$SIM" log-test --root "$R" >/dev/null
if grep -qE '\[Tick 12345\] \[Grid\] \[E#4711\]' "$R"/logs/*.log 2>/dev/null; then ok "T0-05a Logzeile enthaelt Tick, System und Entitaet"; else bad "T0-05a Logzeile enthaelt Tick, System und Entitaet"; fi
"$SIM" crash-test --root "$R" >/dev/null 2>&1; code=$?
if [ $code -eq 3 ] && grep -q "Absichtlicher Testabsturz" "$R"/crashes/*.txt 2>/dev/null; then ok "T0-05b Absturz erzeugt Absturzbericht"; else bad "T0-05b Absturz erzeugt Absturzbericht (Exit $code)"; fi

# T0-08: Platzhalterbericht
if "$CC" --content Content --placeholder-report "$TMP/ph.md" >/dev/null && grep -q "disease.sun_allergy" "$TMP/ph.md"; then ok "T0-08 Platzhalterbericht wird erzeugt"; else bad "T0-08 Platzhalterbericht wird erzeugt"; fi

echo
echo "$PASS bestanden, $FAIL fehlgeschlagen"
[ $FAIL -eq 0 ]
