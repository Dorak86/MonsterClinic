# Asset-Verzeichnis

Herkunft jeder Grafik und jedes Tons. Pflicht für die Steam-Offenlegung KI-generierter Inhalte (D-13) und für spätere Nacharbeit.
Grafiken liegen unter `Art/` und werden über Git LFS versioniert. Claude kann aus seiner Arbeitsumgebung keine LFS-Dateien hochladen; Grafiken werden deshalb vom Auftraggeber eingecheckt.
Nutzungsbedingungen von Gemini zur kommerziellen Nutzung vor Release prüfen und hier festhalten (P-05).

| Datei | Art | Werkzeug | Datum | Prompt / Quelle | Nachbearbeitung | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Art/Source/floor_examination_gemini_20261105.jpg | Bodentextur Untersuchungszimmer, Quelle | Gemini (KI) | 05.11.2026 | Prompt „Seamless tileable floor texture … Victorian hospital floor … bone white and pale sickly green“ (Chat 05.11.2026) | keine | Quelle |
| Art/Floors/floor_examination_A.png | 16 isometrische Bodenkacheln 256 x 128, Variante A | Tools/Art/floor_to_iso.py | 05.11.2026 | aus der Quelle, Block 8 x 8 Fliesen (Pixel 205–614), Schnitt in den Fugen | Umrechnung dimetrisch 2:1, nahtlos | vom Auftraggeber gutgeheissen |
| Art/Floors/floor_examination_B.png | Variante B | Tools/Art/floor_variant_b_examination.py + floor_to_iso.py | 05.11.2026 | Block A um 180 Grad gedreht | 4 zusaetzliche Flecken (Rost, Russ, Gruenstich) per Skript | zur Freigabe |
| Art/Source/floor_wood_gemini_20261105.jpg | Bodentextur Holzdielen (Empfang, Wartezimmer), Quelle | Gemini (KI) | 05.11.2026 | Prompt „Seamless tileable floor texture … dark, worn oak floorboards … brass nail heads … candle wax“ | keine | Quelle |
| Art/Floors/floor_wood_A.png | 16 isometrische Bodenkacheln Holz | Tools/Art/floor_to_iso.py | 05.11.2026 | ganze Textur, 4 x 4 Kacheln | Umrechnung | zur Freigabe |
| Art/Source/floor_stone_gemini_20261105.jpg | Bodentextur Steinplatten (Flur), Quelle | Gemini (KI) | 05.11.2026 | Prompt „Seamless tileable floor texture … large square grey flagstones … moss in the joints“ | keine | Quelle |
| Art/Floors/floor_stone_A.png | 16 isometrische Bodenkacheln Stein | Tools/Art/normalize_joints.py + floor_to_iso.py | 05.11.2026 | ganze Textur, 4 x 4 Kacheln | Fugen auf gleiche Breite gebracht (Randfuge war dreifach breit) | zur Freigabe |
| Art/Source/floor_marble_gemini_20261105.jpg | Bodentextur Marmor (Operationssaal), Quelle | Gemini (KI) | 05.11.2026 | Prompt „Seamless tileable floor texture … black and white marble checkerboard … sickly green sheen“ | keine | Quelle; Fehler: Reihen 3 und 4 gleich begonnen, eine Platte geteilt |
| Art/Floors/floor_marble_A.png | 16 isometrische Bodenkacheln Marmor | Tools/Art/fix_checker_slabs.py + floor_to_iso.py | 05.11.2026 | Platten neu als korrektes Schachbrett gesetzt, geteilte Platte ersetzt durch gedrehte Kopie | Umrechnung | zur Freigabe |
| Art/Source/floor_ground_gemini_20261105.jpg | Aussenboden (Grundstueck), Quelle | Gemini (KI) | 05.11.2026 | Prompt „Seamless tileable ground texture … cracked dry dark earth … cobblestones … ember orange cracks“ | keine | Quelle |
| Art/Source/floor_ground2_gemini_20261105.jpg | Aussenboden Variante, Quelle | Gemini (KI) | 05.11.2026 | wie Aussenboden, zweite Erzeugung | keine | Quelle |
| Art/Floors/floor_ground_A/B/C.png | 64 isometrische Kacheln je Satz (8 x 8) | floor_to_iso.py (--tiles 8), match_edges.py, tone_match.py | 05.11.2026 | B = A um 180 Grad gedreht; C = zweite Quelle, farblich angeglichen | Raender von B und C an A angeglichen, damit Bloecke nahtlos wechseln | zur Freigabe |
| Art/Floors/floor_toilet_A.png | 16 isometrische Kacheln Toilette | Tools/Art/recolor_toilet.py + floor_to_iso.py | 05.11.2026 | Fliesenblock A des Untersuchungszimmers | vergilbt, Gruen stumpfer | zur Freigabe |

