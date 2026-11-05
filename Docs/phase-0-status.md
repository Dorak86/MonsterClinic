# Phase 0 – Zwischenstand 05.11.2026

Kein Abnahmebericht. Phase 0 ist **nicht abgeschlossen**: T0-06 und T0-07 brauchen Unity und die Stilprobe.

## Umgesetzt

| Bereich | Inhalt | Anforderung |
| --- | --- | --- |
| Projektstruktur | Solution, Ordner nach Pflichtenheft 1, gemeinsame Build-Regeln (C# 9, Nullable, Warnungen = Fehler) | TEC-01 |
| Kern | `MonsterClinic.Sim` (.NET Standard 2.1), bisher nur Protokollschnittstelle ohne Systemzeit und ohne statischen Zustand | TEC-01, TEC-02 |
| Plattform | Dateilog mit Zeitstempel und Aufbewahrung der letzten 5 Sitzungen, Absturzbericht, Speicherpfade unter LocalLow\LeviaStudios\MonsterClinic | TEC-02 |
| Inhaltsprüfer | Schema, Dateiname/ID, doppelte IDs, Verweise, Sprachschlüssel DE/EN, Platzhalter in Texten, Platzhalterbericht | TEC-06, GEN-07, Regel 6 |
| Inhalte | 6 Schemata; 4 Spezies, 10 Krankheiten (4 beschrieben, 6 Platzhalter), 6 Symptome, 4 Untersuchungen, 4 Behandlungen, 4 Komplikationen (Auslöser offen, daher Platzhalter), 47 Sprachschlüssel je Sprache | MED-01, MED-03, MED-04 |
| Kommandozeilen-Simulator | Diagnosebefehle `log-test` und `crash-test` | TEC-02 |
| CI | GitHub-Actions-Workflow (wird aktiv, sobald das Repository existiert) | TEC-01 |
| Dokumente | Lastenheft, Entscheidungsprotokoll, Asset-Verzeichnis, Unity-Anleitung, Gemini-Briefing für die Stilprobe | QA-04 |

## Tests

| ID | Ergebnis | Hinweis |
| --- | --- | --- |
| T0-01 | bestanden | GitHub Actions Lauf 42055602015 am 05.11.2026 gruen: Bauen, Inhaltspruefer, Phase-0-Pruefungen |
| T0-02 | bestanden | |
| T0-03 | bestanden | 4 Teilprüfungen: echte Inhalte fehlerfrei, falscher Verweis, unerlaubter Wert, doppelte ID |
| T0-04 | bestanden | |
| T0-05 | bestanden | Logzeile und Absturzbericht |
| T0-06 | offen | Unity-Projekt wird auf dem PC des Auftraggebers angelegt |
| T0-07 | offen | Stilprobe, Grafiken vom Auftraggeber per Gemini |
| T0-08 | bestanden | |

Ausgeführt am 05.11.2026 mit .NET 8.0.133 unter Linux und in GitHub Actions (ubuntu-latest). Unter Windows noch nicht ausgeführt.

## Bekannte Einschränkungen und technische Schulden

1. Tests laufen als Skript statt mit NUnit (NuGet in der Entwicklungsumgebung gesperrt). Wird umgestellt, sobald NuGet erreichbar ist. Eingetragen in `Docs/decisions.md`.
2. Auslöser aller vier Komplikationen sind noch nicht festgelegt (Platzhalter).
3. Für Goblins sind keine Bedürfnisse festgelegt; „Kreatur des Tages“ ist eine Annahme.
4. Zahlenwerte (Aussagekraft der Untersuchungen) sind Platzhalter für das Balancing.
5. GitHub meldet, dass die Actions-Versionen v4 auf Node.js 20 laufen, das abgekündigt ist. Umstellung auf neuere Versionen bei der nächsten CI-Änderung.
6. Diese Claude-Sitzung darf nicht direkt auf `main` schreiben, nur auf Zweige `claude/...`. Änderungen kommen per Pull Request nach `main`.

## Nächste Schritte

1. Auftraggeber: Zweig `claude/phase-0-setup` auf GitHub in `main` umbenennen, Unity nach `Docs/unity-setup.md` einrichten, Stilprobe nach `Docs/stilprobe-briefing.md` erzeugen.
2. Claude: Unity-Prüfskript für T0-06, Einbau der Stilprobe in Unity, danach Abnahmebericht Phase 0.
