# Asset-Verzeichnis

Herkunft jeder Grafik und jedes Tons. Pflicht für die Steam-Offenlegung KI-generierter Inhalte (D-13) und für spätere Nacharbeit.
Grafiken liegen unter `Art/` und werden über Git LFS versioniert. Claude kann aus seiner Arbeitsumgebung keine LFS-Dateien hochladen; Grafiken werden deshalb vom Auftraggeber eingecheckt.
Nutzungsbedingungen von Gemini zur kommerziellen Nutzung vor Release prüfen und hier festhalten (P-05).

| Datei | Art | Werkzeug | Datum | Prompt / Quelle | Nachbearbeitung | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Art/Source/floor_examination_gemini_20261105.jpg | Bodentextur Untersuchungszimmer, Quelle | Gemini (KI) | 05.11.2026 | Prompt „Seamless tileable floor texture … Victorian hospital floor … bone white and pale sickly green“ (Chat 05.11.2026) | keine | Quelle |
| Art/Floors/floor_examination_A.png | 16 isometrische Bodenkacheln 256 x 128, Variante A | Tools/Art/floor_to_iso.py | 05.11.2026 | aus der Quelle, Block 8 x 8 Fliesen (Pixel 205–614), Schnitt in den Fugen | Umrechnung dimetrisch 2:1, nahtlos | vom Auftraggeber gutgeheissen |
| Art/Floors/floor_examination_B.png | Variante B | Tools/Art/floor_variant_b_examination.py + floor_to_iso.py | 05.11.2026 | Block A um 180 Grad gedreht | 4 zusaetzliche Flecken (Rost, Russ, Gruenstich) per Skript | zur Freigabe |
