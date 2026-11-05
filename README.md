# THE MONSTER CLINIC

Zweites Spiel von LeviaStudios im Levia-Universum. Hospital-Management-Simulation in Levia, der verrückten Hölle voller Monster.

Verbindliche Grundlagen in `Docs/`: Lastenheft V1.0 (mit Abweichungen A-01 bis A-10), Technische Planung v1.0, Pflichtenheft Phase 0 und 1.

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `Sim/` | Simulationskern, reines C# (.NET Standard 2.1), ohne Unity |
| `Platform/` | Dateilog, Absturzbericht, Speicherpfade |
| `Tools/ContentCheck/` | Inhaltsprüfer für alle JSON-Inhalte |
| `Tools/SimCli/` | Kommandozeilen-Simulator |
| `Content/` | Spielinhalte, Schemata, Sprachtabellen, Balancing |
| `Tests/` | automatische Prüfungen |
| `Unity/` | Unity-Projekt (Darstellung, UI, Eingabe, Audio) |
| `Docs/` | Spezifikationen, Entscheidungsprotokoll, Asset-Verzeichnis, Phasenberichte |

## Bauen und prüfen

Voraussetzung: .NET 8 SDK.

```
dotnet build MonsterClinic.sln -c Release
Tools/ContentCheck/bin/Release/net8.0/contentcheck --content Content
Tests/phase0-checks.sh        (unter Windows in Git Bash)
```

Ist das Unity-Projekt angelegt (`Unity/Assets` existiert), kopiert der Build den Kern automatisch nach `Unity/Assets/Plugins/MonsterClinic`.

Einrichtung Unity: siehe `Docs/unity-setup.md`.
