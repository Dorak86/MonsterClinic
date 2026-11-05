# Unity einrichten (Phase 0, T0-06)

Diese Schritte machst du einmal auf deinem Windows-PC.

1. **.NET SDK 8 oder neuer** (für Kern, Werkzeuge und Tests). Prüfen in Git Bash mit `dotnet --list-sdks`; eine Zeile mit 8 oder höher genügt. Sonst: https://dotnet.microsoft.com/download
2. **Git und Git LFS installieren**: https://git-scm.com (enthält Git Bash) und danach in Git Bash einmal `git lfs install`.
3. **Unity Hub installieren** und darin die aktuelle **Unity 6 LTS** (Version beginnt mit `6000.`) mit dem Modul *Windows Build Support (Mono)* hinzufügen. Notiere die genaue Version; ich trage sie in `Docs/decisions.md` ein und wir aktualisieren danach nur noch bewusst.
4. **Projekt anlegen**: In Unity Hub *New project* → Vorlage **Universal 2D** → Name `Unity` → Speicherort: der Ordner `MonsterClinic`, sodass das Projekt in `MonsterClinic/Unity` liegt.
5. **Pakete**: Die Vorlage *Universal 2D* bringt 2D Animation und 2D PSD Importer bereits mit. Weitere Pakete kommen erst, wenn ein Schritt sie braucht (JSON liest der Kern selbst).
6. **Kern einbinden**: Im Ordner `MonsterClinic` einmal `dotnet build MonsterClinic.sln -c Release` ausführen. Danach liegen `MonsterClinic.Sim.dll` und `MonsterClinic.Platform.dll` in `Unity/Assets/Plugins/MonsterClinic`.
7. **Prüfen**: Unity öffnen. In der Konsole dürfen keine Fehler stehen. Den Testskript-Baustein für T0-06 liefere ich, sobald das Projekt existiert.

Sag mir die Unity-Version und ob Schritt 7 ohne Fehler durchläuft. Ist dein PC mit dieser Sitzung verknüpft, kann ich die Schritte 4–7 auch prüfen.
