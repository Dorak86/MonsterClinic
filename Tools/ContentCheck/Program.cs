using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace MonsterClinic.ContentCheck
{
    /// <summary>
    /// contentcheck [--content &lt;ordner&gt;] [--schemas &lt;ordner&gt;] [--placeholder-report &lt;datei.md&gt;]
    ///
    /// Prueft alle Inhaltsdateien (Pflichtenheft 4): Schema, Dateiname passend zur ID, doppelte IDs,
    /// Verweise auf unbekannte IDs, fehlende oder abweichende Sprachschluessel in DE und EN.
    /// Listet alle Platzhalter (Lastenheft Regel 6). Exitcode 0 = fehlerfrei, 1 = Fehler, 2 = Bedienfehler.
    /// </summary>
    internal static class Program
    {
        /// <summary>Inhaltsordner und ihr Schema. Ordner ohne Eintrag werden als Fehler gemeldet.</summary>
        private static readonly Dictionary<string, string> FolderSchemas = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["species"] = "species",
            ["diseases"] = "disease",
            ["symptoms"] = "symptom",
            ["procedures"] = "procedure",
            ["treatments"] = "treatment",
            ["complications"] = "complication",
            ["rooms"] = "room",
            ["clinics"] = "clinic",
        };

        private static readonly string[] Languages = { "de", "en" };
        private static readonly string[] SpecialFolders = { "schemas", "localization", "balancing" };

        private sealed class Record
        {
            public Record(string file, string id, bool placeholder, string[] locKeys)
            {
                File = file;
                Id = id;
                Placeholder = placeholder;
                LocKeys = locKeys;
            }

            public string File { get; }
            public string Id { get; }
            public bool Placeholder { get; }
            public string[] LocKeys { get; }
        }

        private static int Main(string[] args)
        {
            string content = Option(args, "--content") ?? "Content";
            string schemas = Option(args, "--schemas") ?? Path.Combine(content, "schemas");
            string? reportPath = Option(args, "--placeholder-report");

            if (!Directory.Exists(content))
            {
                Console.Error.WriteLine($"Inhaltsordner nicht gefunden: {content}");
                return 2;
            }

            var errors = new List<string>();
            var records = new List<Record>();
            var references = new List<(string File, SchemaValidator.Reference Ref)>();
            var validator = new SchemaValidator();
            var loadedSchemas = new Dictionary<string, JsonDocument>(StringComparer.Ordinal);
            int files = 0;

            foreach (string folder in Directory.GetDirectories(content).OrderBy(d => d, StringComparer.Ordinal))
            {
                string folderName = Path.GetFileName(folder);
                if (SpecialFolders.Contains(folderName))
                {
                    continue;
                }

                string[] jsonFiles = Directory.GetFiles(folder, "*.json").OrderBy(f => f, StringComparer.Ordinal).ToArray();
                if (!FolderSchemas.TryGetValue(folderName, out string? schemaName))
                {
                    if (jsonFiles.Length > 0)
                    {
                        errors.Add($"{folderName}/: Ordner hat kein zugeordnetes Schema");
                    }
                    continue;
                }

                if (!loadedSchemas.TryGetValue(schemaName, out JsonDocument? schemaDoc))
                {
                    schemaDoc = LoadSchema(Path.Combine(schemas, schemaName + ".schema.json"), errors);
                    if (schemaDoc == null)
                    {
                        continue;
                    }
                    loadedSchemas[schemaName] = schemaDoc;
                }

                foreach (string file in jsonFiles)
                {
                    files++;
                    string rel = $"{folderName}/{Path.GetFileName(file)}";
                    CheckRecord(file, rel, schemaDoc.RootElement, validator, errors, records, references);
                }
            }

            CheckDuplicates(records, errors);
            CheckReferences(records, references, errors);
            CheckLocalization(Path.Combine(content, "localization"), records, errors);

            List<Record> placeholders = records.Where(r => r.Placeholder).OrderBy(r => r.Id, StringComparer.Ordinal).ToList();
            foreach (string e in errors)
            {
                Console.WriteLine($"FEHLER {e}");
            }

            Console.WriteLine();
            Console.WriteLine($"Platzhalter ({placeholders.Count}):");
            foreach (Record p in placeholders)
            {
                Console.WriteLine($"  PLACEHOLDER {p.Id} ({p.File})");
            }

            if (reportPath != null)
            {
                WriteReport(reportPath, placeholders);
            }

            Console.WriteLine();
            Console.WriteLine($"{files} Dateien geprueft, {records.Count} Datensaetze, {errors.Count} Fehler, {placeholders.Count} Platzhalter.");
            return errors.Count == 0 ? 0 : 1;
        }

        private static JsonDocument? LoadSchema(string path, List<string> errors)
        {
            if (!File.Exists(path))
            {
                errors.Add($"Schema fehlt: {path}");
                return null;
            }

            try
            {
                JsonDocument doc = JsonDocument.Parse(File.ReadAllText(path));
                List<string> schemaErrors = SchemaValidator.CheckSchema(doc.RootElement).ToList();
                if (schemaErrors.Count > 0)
                {
                    errors.AddRange(schemaErrors.Select(e => $"Schema {Path.GetFileName(path)}: {e}"));
                    return null;
                }
                return doc;
            }
            catch (JsonException ex)
            {
                errors.Add($"Schema {Path.GetFileName(path)}: kein gueltiges JSON ({ex.Message})");
                return null;
            }
        }

        private static void CheckRecord(string file, string rel, JsonElement schema, SchemaValidator validator,
            List<string> errors, List<Record> records, List<(string, SchemaValidator.Reference)> references)
        {
            JsonDocument doc;
            try
            {
                doc = JsonDocument.Parse(File.ReadAllText(file));
            }
            catch (JsonException ex)
            {
                errors.Add($"{rel}: kein gueltiges JSON (Zeile {ex.LineNumber + 1}): {ex.Message}");
                return;
            }

            using (doc)
            {
                JsonElement root = doc.RootElement;
                if (root.ValueKind != JsonValueKind.Object ||
                    !root.TryGetProperty("id", out JsonElement idElement) ||
                    idElement.ValueKind != JsonValueKind.String)
                {
                    errors.Add($"{rel}: Feld 'id': Pflichtfeld fehlt oder ist kein Text");
                    return;
                }

                string id = idElement.GetString() ?? string.Empty;
                bool placeholder = root.TryGetProperty("placeholder", out JsonElement ph) && ph.ValueKind == JsonValueKind.True;

                var localErrors = new List<string>();
                var localRefs = new List<SchemaValidator.Reference>();
                validator.Validate(root, schema, string.Empty, placeholder, localErrors, localRefs);
                errors.AddRange(localErrors.Select(e => $"{rel}: {e}"));
                references.AddRange(localRefs.Select(r => (rel, r)));

                string expectedFile = id.Contains('.') ? id.Substring(id.IndexOf('.') + 1) + ".json" : id + ".json";
                if (!string.Equals(Path.GetFileName(file), expectedFile, StringComparison.Ordinal))
                {
                    errors.Add($"{rel}: Dateiname passt nicht zur ID '{id}' (erwartet {expectedFile})");
                }

                string[] locKeys = schema.TryGetProperty("x-locKeys", out JsonElement keys)
                    ? keys.EnumerateArray().Select(k => k.GetString() ?? string.Empty).ToArray()
                    : Array.Empty<string>();
                records.Add(new Record(rel, id, placeholder, locKeys));
            }
        }

        private static void CheckDuplicates(List<Record> records, List<string> errors)
        {
            foreach (IGrouping<string, Record> group in records.GroupBy(r => r.Id, StringComparer.Ordinal).Where(g => g.Count() > 1))
            {
                errors.Add($"ID '{group.Key}' ist mehrfach vergeben: {string.Join(", ", group.Select(r => r.File))}");
            }
        }

        private static void CheckReferences(List<Record> records, List<(string File, SchemaValidator.Reference Ref)> references,
            List<string> errors)
        {
            var ids = new HashSet<string>(records.Select(r => r.Id), StringComparer.Ordinal);
            foreach ((string file, SchemaValidator.Reference r) in references)
            {
                if (!r.Value.StartsWith(r.Prefix, StringComparison.Ordinal))
                {
                    errors.Add($"{file}: Feld '{r.Path}': '{r.Value}' muss mit '{r.Prefix}' beginnen");
                }
                else if (!ids.Contains(r.Value))
                {
                    errors.Add($"{file}: Feld '{r.Path}': Verweis auf unbekannte ID '{r.Value}'");
                }
            }
        }

        private static void CheckLocalization(string folder, List<Record> records, List<string> errors)
        {
            var tables = new Dictionary<string, Dictionary<string, string>>(StringComparer.Ordinal);
            foreach (string lang in Languages)
            {
                string path = Path.Combine(folder, lang + ".json");
                if (!File.Exists(path))
                {
                    errors.Add($"localization/{lang}.json: Sprachtabelle fehlt");
                    return;
                }

                try
                {
                    using JsonDocument doc = JsonDocument.Parse(File.ReadAllText(path));
                    var table = new Dictionary<string, string>(StringComparer.Ordinal);
                    foreach (JsonProperty p in doc.RootElement.EnumerateObject())
                    {
                        if (p.Value.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(p.Value.GetString()))
                        {
                            errors.Add($"localization/{lang}.json: Schluessel '{p.Name}': Text fehlt oder ist kein Text");
                            continue;
                        }
                        table[p.Name] = p.Value.GetString()!;
                    }
                    tables[lang] = table;
                }
                catch (Exception ex) when (ex is JsonException || ex is InvalidOperationException)
                {
                    errors.Add($"localization/{lang}.json: kein gueltiges JSON-Objekt ({ex.Message})");
                    return;
                }
            }

            foreach (Record r in records)
            {
                foreach (string key in r.LocKeys.Select(k => $"{r.Id}.{k}"))
                {
                    foreach (string lang in Languages.Where(l => !tables[l].ContainsKey(key)))
                    {
                        errors.Add($"{r.File}: Sprachschluessel '{key}' fehlt in localization/{lang}.json");
                    }
                }
            }

            var allKeys = tables.Values.SelectMany(t => t.Keys).Distinct(StringComparer.Ordinal).OrderBy(k => k, StringComparer.Ordinal);
            foreach (string key in allKeys)
            {
                string[] present = Languages.Where(l => tables[l].ContainsKey(key)).ToArray();
                foreach (string lang in Languages.Except(present))
                {
                    errors.Add($"localization/{lang}.json: Schluessel '{key}' fehlt (vorhanden in {string.Join(", ", present)})");
                }

                if (present.Length == Languages.Length)
                {
                    string[] tokenSets = Languages.Select(l => Tokens(tables[l][key])).ToArray();
                    if (tokenSets.Distinct(StringComparer.Ordinal).Count() > 1)
                    {
                        errors.Add($"localization: Schluessel '{key}' hat unterschiedliche Platzhalter in den Sprachen");
                    }
                }
            }
        }

        private static string Tokens(string text) =>
            string.Join(",", Regex.Matches(text, @"\{[a-zA-Z0-9_]+\}").Select(m => m.Value).OrderBy(t => t, StringComparer.Ordinal));

        private static void WriteReport(string path, List<Record> placeholders)
        {
            var sb = new StringBuilder();
            sb.AppendLine("# Platzhalterbericht Inhalte");
            sb.AppendLine();
            sb.AppendLine("Automatisch erzeugt vom Inhaltspruefer. Platzhalter gelten nicht als fertig (Lastenheft Regel 6).");
            sb.AppendLine();
            sb.AppendLine("| ID | Datei |");
            sb.AppendLine("| --- | --- |");
            foreach (Record p in placeholders)
            {
                sb.AppendLine($"| {p.Id} | {p.File} |");
            }
            string? dir = Path.GetDirectoryName(Path.GetFullPath(path));
            if (dir != null)
            {
                Directory.CreateDirectory(dir);
            }
            File.WriteAllText(path, sb.ToString(), new UTF8Encoding(false));
        }

        private static string? Option(string[] args, string name)
        {
            int i = Array.IndexOf(args, name);
            return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
        }
    }
}
