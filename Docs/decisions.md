# Entscheidungsprotokoll

Alle Entscheidungen des Auftraggebers und alle technischen Festlegungen mit Datum. Ausführlich in der Technischen Planung v1.0 (Abschnitt 10) und im Pflichtenheft Phase 0 und 1 (Abschnitt 10).

## Abweichungen vom Lastenheft V1.0 (freigegeben 05.11.2026)

| Nr. | Inhalt |
| --- | --- |
| A-01 | MVP mit 4 Spezies: Vampir, Geist, Zombie, Goblin |
| A-02 | Goblin neu, Drache erst nach dem MVP, Troll in 1.0 |
| A-03 | 9 Räume im MVP (Personalraum zusätzlich) |
| A-04 | Diagnose immer automatisch durch den Arzt; Ausbildung bestimmt Dauer und Treffsicherheit |
| A-05 | Welt Levia, Marke LeviaStudios |
| A-06 | Patienten können sterben; Tag/Nacht mit Schichten; Kreaturen der Nacht (Vampir, Geist, Zombie) und des Tages (Goblin) |
| A-07 | Quadratraster; nach dem MVP schräge Wände für sechs- und achteckige Räume |
| A-08 | MVP-Berufe: Monsterarzt, Verwaltungsangestellte, Hausmeister, Reinigungskraft; Fachärzte als Spezialisierung |
| A-09 | Krankenkasse legt Preise fest, Privatpatienten +20 %; Konkurrenz über Werbung, Ruf, Personal; Ruf aus Sauberkeit, Wartezeit, Diagnose- und Erfolgsquote |
| A-10 | Steam Early Access zu Halloween 2027 mit MVP-Umfang |
| A-11 | Krankheitsfrist ab Ankunft; waehrend der Behandlung halbe Geschwindigkeit; bei Ablauf Komplikation; Behandlung nach Dringlichkeit (Notfall vor kuerzester Restfrist vor Ankunft) |
| A-12 | Goblins in Gruppen ab 3, ruetteln an Snackautomaten und pinkeln in Blumen; Vampire sind genervt; Automaten koennen kaputtgehen, Hausmeister repariert |
| A-14 | Zuerst Meilenstein Spielkreislauf (K1–K5) mit 4 Krankheiten, dann Ausbau; pinker Goblin wird nach zweiter, kuerzerer Frist dauerhaft; neue Ereignisse aus A-13 nicht im MVP 1 |
| A-13 | Neue Ereignisse: Krankenkasse aendert Pauschale einer Behandlung; Geraet oder Objekt geht kaputt und muss ersetzt werden (Anzahl der MVP-Ereignisse offen) |

## Technische Festlegungen

| Datum | Entscheidung |
| --- | --- |
| 05.11.2026 | Unity 6 LTS mit C#; Simulationskern ohne Unity, .NET Standard 2.1 |
| 05.11.2026 | Ein Spieltag = 12 Minuten bei 1×; 1 Tick = 12 Spielsekunden |
| 05.11.2026 | Kamera mit Drehung in 90-Grad-Schritten (P-01) |
| 05.11.2026 | Grafik per KI (Gemini), Audio vom Auftraggeber selbst |
| 05.11.2026 | Messungen auf dem Rechner des Auftraggebers (P-04); Intro aus dem ersten Spiel als MP4 (P-03) |
| 05.11.2026 | Inhaltsprüfer nutzt System.Text.Json (.NET 8) und einen eigenen Prüfer für eine kleine Teilmenge von JSON Schema, statt einer Fremdbibliothek; das Spiel liest Inhalte in Phase 2 mit Newtonsoft.Json. Beide lesen Standard-JSON; der Inhaltsprüfer meldet nicht unterstützte Schema-Schlüsselwörter als Fehler. |
| 05.11.2026 | Übergangslösung: Phase-0-Prüfungen als Skript `Tests/phase0-checks.sh`, weil NUnit in der Entwicklungsumgebung von Claude nicht geladen werden kann (NuGet gesperrt). Umstellung auf NUnit, sobald NuGet erreichbar ist. |
| 05.11.2026 | Kerntests mit eigenem kleinem Testlaeufer (`Tests/Sim.Tests`, NUnit-aehnliche Attribute) bis NuGet erreichbar ist |
| 05.11.2026 | Eigener JSON-Baustein im Kern (`Sim/Data/Json.cs`), keine Fremdbibliothek; nur Ganzzahlen, kanonische Ausgabe fuer Pruefsummen. Aussagekraft von Untersuchungen daher in Prozent als Ganzzahl |
| 05.11.2026 | Unity-Version 6000.6.8f1 („Supported“), festgeschrieben in Unity/ProjectSettings/ProjectVersion.txt. Vor Release pruefen, ob auf eine LTS-Version gewechselt wird |
