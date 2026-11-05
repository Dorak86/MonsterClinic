# Asset-Verzeichnis

Herkunft jeder Grafik und jedes Tons. Pflicht für die Steam-Offenlegung KI-generierter Inhalte (D-13) und für spätere Nacharbeit.
Grafiken liegen unter `Art/` und werden über Git LFS versioniert. Claude kann aus seiner Arbeitsumgebung keine LFS-Dateien hochladen; Grafiken werden deshalb vom Auftraggeber eingecheckt.
Nutzungsbedingungen von Gemini zur kommerziellen Nutzung vor Release prüfen und hier festhalten (P-05).

| Datei | Art | Werkzeug | Datum | Prompt / Quelle | Nachbearbeitung | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Art/Source/floor_examination_gemini_20261105.jpg | Bodentextur Untersuchungszimmer, Quelle | Gemini (KI) | 05.11.2026 | Prompt „Seamless tileable floor texture … Victorian hospital floor … bone white and pale sickly green“ (Chat 05.11.2026) | keine | Quelle |
| Art/Floors/floor_examination_atlas.png | 16 isometrische Bodenkacheln 256 x 128 | Tools/Art/floor_to_iso.py | 05.11.2026 | aus der Quelle, Block 8 x 8 Fliesen, Schnitt in den Fugen | Umrechnung dimetrisch 2:1, nahtlos | Stilprobe, zur Freigabe |
