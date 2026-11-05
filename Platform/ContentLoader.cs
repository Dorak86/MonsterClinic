using System;
using System.IO;
using System.Linq;
using MonsterClinic.Sim.Data;

namespace MonsterClinic.Platform
{
    /// <summary>
    /// Liest die Inhaltsdateien aus dem Ordner Content in eine <see cref="ContentDb"/>.
    /// Die inhaltliche Pruefung (Schema, Verweise, Sprachen) macht der Inhaltspruefer; hier wird bei
    /// jedem Fehler mit Datei und Grund abgebrochen, damit das Spiel nie mit kaputten Daten laeuft (Pflichtenheft 4).
    /// </summary>
    public static class ContentLoader
    {
        private static readonly string[] Folders = { "rooms", "clinics" };

        public static ContentDb Load(string contentRoot)
        {
            if (!Directory.Exists(contentRoot)) throw new DirectoryNotFoundException($"Inhaltsordner nicht gefunden: {contentRoot}");
            var db = new ContentDb();
            foreach (string folder in Folders)
            {
                string dir = Path.Combine(contentRoot, folder);
                if (!Directory.Exists(dir)) continue;
                foreach (string file in Directory.GetFiles(dir, "*.json").OrderBy(f => f, StringComparer.Ordinal))
                {
                    try
                    {
                        db.Add(folder, JsonValue.Parse(File.ReadAllText(file)));
                    }
                    catch (JsonFormatException ex)
                    {
                        throw new JsonFormatException($"{folder}/{Path.GetFileName(file)}: {ex.Message}");
                    }
                }
            }
            return db;
        }

        /// <summary>Sucht den Ordner Content ausgehend vom aktuellen Verzeichnis nach oben.</summary>
        public static string FindContentRoot(string start)
        {
            for (DirectoryInfo? d = new DirectoryInfo(start); d != null; d = d.Parent)
            {
                string candidate = Path.Combine(d.FullName, "Content");
                if (Directory.Exists(Path.Combine(candidate, "schemas"))) return candidate;
            }
            throw new DirectoryNotFoundException($"Kein Content-Ordner oberhalb von {start} gefunden");
        }
    }
}
