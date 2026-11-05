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
| offen | Genaue Unity-Version (wird beim Anlegen des Projekts festgeschrieben) |
