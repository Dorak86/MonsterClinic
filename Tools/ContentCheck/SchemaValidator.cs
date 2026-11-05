using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace MonsterClinic.ContentCheck
{
    /// <summary>
    /// Prueft JSON gegen eine bewusst kleine Teilmenge von JSON Schema (Draft 2020-12):
    /// type, const, enum, required, properties, additionalProperties (nur false), items,
    /// minLength, pattern, minimum, maximum, minItems.
    /// Eigene Schluesselwoerter fuer MONSTER CLINIC:
    ///   x-ref                 der Text muss eine vorhandene ID mit diesem Praefix sein (z. B. "species.")
    ///   x-placeholderRequired ersetzt "required", wenn der Datensatz "placeholder": true traegt
    ///   x-locKeys             (nur Wurzel) Sprachschluessel, die je ID in allen Sprachen existieren muessen
    /// Nicht unterstuetzte Schluesselwoerter fuehren zu einem Fehler im Schema, damit nichts still ignoriert wird.
    /// </summary>
    public sealed class SchemaValidator
    {
        private static readonly HashSet<string> Supported = new HashSet<string>(StringComparer.Ordinal)
        {
            "$schema", "$id", "title", "description", "type", "const", "enum", "required", "properties",
            "additionalProperties", "items", "minLength", "pattern", "minimum", "maximum", "minItems",
            "x-ref", "x-placeholderRequired", "x-locKeys",
        };

        public sealed class Reference
        {
            public Reference(string path, string value, string prefix)
            {
                Path = path;
                Value = value;
                Prefix = prefix;
            }

            public string Path { get; }
            public string Value { get; }
            public string Prefix { get; }
        }

        /// <summary>Prueft das Schema selbst auf nicht unterstuetzte Schluesselwoerter.</summary>
        public static IEnumerable<string> CheckSchema(JsonElement schema, string path = "#")
        {
            if (schema.ValueKind != JsonValueKind.Object)
            {
                yield return $"{path}: Schema muss ein Objekt sein";
                yield break;
            }

            foreach (JsonProperty p in schema.EnumerateObject())
            {
                if (!Supported.Contains(p.Name))
                {
                    yield return $"{path}: Schluesselwort '{p.Name}' wird vom Inhaltspruefer nicht unterstuetzt";
                }
            }

            if (schema.TryGetProperty("properties", out JsonElement props))
            {
                foreach (JsonProperty p in props.EnumerateObject())
                {
                    foreach (string e in CheckSchema(p.Value, $"{path}/properties/{p.Name}"))
                    {
                        yield return e;
                    }
                }
            }

            if (schema.TryGetProperty("items", out JsonElement items))
            {
                foreach (string e in CheckSchema(items, $"{path}/items"))
                {
                    yield return e;
                }
            }
        }

        /// <summary>Prueft einen Datensatz. Fehler und gefundene Verweise werden gesammelt.</summary>
        public void Validate(JsonElement value, JsonElement schema, string path, bool isPlaceholder,
            List<string> errors, List<Reference> references)
        {
            if (schema.TryGetProperty("type", out JsonElement type) && !MatchesType(value, type))
            {
                errors.Add($"Feld '{path}': erwartet Typ {TypeText(type)}, gefunden {KindText(value)}");
                return;
            }

            if (schema.TryGetProperty("const", out JsonElement constant) && !JsonEquals(value, constant))
            {
                errors.Add($"Feld '{path}': muss {constant.GetRawText()} sein");
            }

            if (schema.TryGetProperty("enum", out JsonElement options) &&
                !options.EnumerateArray().Any(o => JsonEquals(value, o)))
            {
                string allowed = string.Join(", ", options.EnumerateArray().Select(o => o.GetRawText()));
                errors.Add($"Feld '{path}': Wert {value.GetRawText()} nicht erlaubt (erlaubt: {allowed})");
            }

            switch (value.ValueKind)
            {
                case JsonValueKind.Object:
                    ValidateObject(value, schema, path, isPlaceholder, errors, references);
                    break;
                case JsonValueKind.Array:
                    ValidateArray(value, schema, path, isPlaceholder, errors, references);
                    break;
                case JsonValueKind.String:
                    ValidateString(value.GetString() ?? string.Empty, schema, path, errors, references);
                    break;
                case JsonValueKind.Number:
                    ValidateNumber(value.GetDouble(), schema, path, errors);
                    break;
            }
        }

        private void ValidateObject(JsonElement value, JsonElement schema, string path, bool isPlaceholder,
            List<string> errors, List<Reference> references)
        {
            string requiredKey = isPlaceholder && schema.TryGetProperty("x-placeholderRequired", out _)
                ? "x-placeholderRequired"
                : "required";
            if (schema.TryGetProperty(requiredKey, out JsonElement required))
            {
                foreach (JsonElement r in required.EnumerateArray())
                {
                    string name = r.GetString() ?? string.Empty;
                    if (!value.TryGetProperty(name, out _))
                    {
                        errors.Add($"Feld '{Join(path, name)}': Pflichtfeld fehlt");
                    }
                }
            }

            schema.TryGetProperty("properties", out JsonElement props);
            bool closed = schema.TryGetProperty("additionalProperties", out JsonElement ap) && ap.ValueKind == JsonValueKind.False;

            foreach (JsonProperty p in value.EnumerateObject())
            {
                if (props.ValueKind == JsonValueKind.Object && props.TryGetProperty(p.Name, out JsonElement sub))
                {
                    Validate(p.Value, sub, Join(path, p.Name), isPlaceholder, errors, references);
                }
                else if (closed)
                {
                    errors.Add($"Feld '{Join(path, p.Name)}': unbekanntes Feld");
                }
            }
        }

        private void ValidateArray(JsonElement value, JsonElement schema, string path, bool isPlaceholder,
            List<string> errors, List<Reference> references)
        {
            int count = value.GetArrayLength();
            if (schema.TryGetProperty("minItems", out JsonElement min) && count < min.GetInt32())
            {
                errors.Add($"Feld '{path}': mindestens {min.GetInt32()} Eintraege erwartet, gefunden {count}");
            }

            if (schema.TryGetProperty("items", out JsonElement items))
            {
                int i = 0;
                foreach (JsonElement item in value.EnumerateArray())
                {
                    Validate(item, items, $"{path}[{i}]", isPlaceholder, errors, references);
                    i++;
                }
            }
        }

        private static void ValidateString(string text, JsonElement schema, string path,
            List<string> errors, List<Reference> references)
        {
            if (schema.TryGetProperty("minLength", out JsonElement min) && text.Length < min.GetInt32())
            {
                errors.Add($"Feld '{path}': Text zu kurz (mindestens {min.GetInt32()} Zeichen)");
            }

            if (schema.TryGetProperty("pattern", out JsonElement pattern) &&
                !Regex.IsMatch(text, pattern.GetString() ?? string.Empty, RegexOptions.CultureInvariant))
            {
                errors.Add($"Feld '{path}': '{text}' passt nicht zum Muster {pattern.GetString()}");
            }

            if (schema.TryGetProperty("x-ref", out JsonElement prefix))
            {
                references.Add(new Reference(path, text, prefix.GetString() ?? string.Empty));
            }
        }

        private static void ValidateNumber(double number, JsonElement schema, string path, List<string> errors)
        {
            if (schema.TryGetProperty("minimum", out JsonElement min) && number < min.GetDouble())
            {
                errors.Add($"Feld '{path}': {Num(number)} ist kleiner als das Minimum {Num(min.GetDouble())}");
            }

            if (schema.TryGetProperty("maximum", out JsonElement max) && number > max.GetDouble())
            {
                errors.Add($"Feld '{path}': {Num(number)} ist groesser als das Maximum {Num(max.GetDouble())}");
            }
        }

        private static bool MatchesType(JsonElement value, JsonElement type)
        {
            if (type.ValueKind == JsonValueKind.Array)
            {
                return type.EnumerateArray().Any(t => MatchesType(value, t));
            }

            switch (type.GetString())
            {
                case "object": return value.ValueKind == JsonValueKind.Object;
                case "array": return value.ValueKind == JsonValueKind.Array;
                case "string": return value.ValueKind == JsonValueKind.String;
                case "boolean": return value.ValueKind == JsonValueKind.True || value.ValueKind == JsonValueKind.False;
                case "null": return value.ValueKind == JsonValueKind.Null;
                case "number": return value.ValueKind == JsonValueKind.Number;
                case "integer": return value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out _);
                default: return false;
            }
        }

        private static bool JsonEquals(JsonElement a, JsonElement b)
        {
            if (a.ValueKind == JsonValueKind.Number && b.ValueKind == JsonValueKind.Number)
            {
                return a.GetDouble().Equals(b.GetDouble());
            }

            return a.ValueKind == b.ValueKind && a.GetRawText() == b.GetRawText();
        }

        private static string TypeText(JsonElement type) =>
            type.ValueKind == JsonValueKind.Array
                ? string.Join(" oder ", type.EnumerateArray().Select(t => t.GetString()))
                : type.GetString() ?? "?";

        private static string KindText(JsonElement value) => value.ValueKind switch
        {
            JsonValueKind.Object => "object",
            JsonValueKind.Array => "array",
            JsonValueKind.String => "string",
            JsonValueKind.Number => "number",
            JsonValueKind.True => "boolean",
            JsonValueKind.False => "boolean",
            JsonValueKind.Null => "null",
            _ => value.ValueKind.ToString(),
        };

        private static string Join(string path, string name) => path.Length == 0 ? name : $"{path}.{name}";

        private static string Num(double d) => d.ToString(CultureInfo.InvariantCulture);
    }
}
