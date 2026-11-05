using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace MonsterClinic.Sim.Data
{
    /// <summary>
    /// Kleiner, abhaengigkeitsfreier JSON-Baustein fuer Spielstaende und Inhalte.
    /// Objekte behalten die Reihenfolge ihrer Felder, damit die Ausgabe kanonisch ist
    /// (gleicher Zustand ergibt Byte fuer Byte denselben Text und damit dieselbe Pruefsumme).
    /// Zahlen werden als Ganzzahlen (long) gefuehrt; der Kern verwendet keine Gleitkommazahlen.
    /// </summary>
    public enum JsonKind
    {
        Null,
        Bool,
        Integer,
        String,
        Array,
        Object,
    }

    public sealed class JsonValue
    {
        private readonly List<KeyValuePair<string, JsonValue>>? _fields;
        private readonly List<JsonValue>? _items;

        private JsonValue(JsonKind kind, bool boolValue = false, long intValue = 0, string? stringValue = null,
            List<KeyValuePair<string, JsonValue>>? fields = null, List<JsonValue>? items = null)
        {
            Kind = kind;
            BoolValue = boolValue;
            IntValue = intValue;
            StringValue = stringValue;
            _fields = fields;
            _items = items;
        }

        public JsonKind Kind { get; }
        public bool BoolValue { get; }
        public long IntValue { get; }
        public string? StringValue { get; }

        public static readonly JsonValue Null = new JsonValue(JsonKind.Null);
        public static JsonValue From(bool value) => new JsonValue(JsonKind.Bool, boolValue: value);
        public static JsonValue From(long value) => new JsonValue(JsonKind.Integer, intValue: value);
        public static JsonValue From(string value) => new JsonValue(JsonKind.String, stringValue: value ?? throw new ArgumentNullException(nameof(value)));
        public static JsonValue NewObject() => new JsonValue(JsonKind.Object, fields: new List<KeyValuePair<string, JsonValue>>());
        public static JsonValue NewArray() => new JsonValue(JsonKind.Array, items: new List<JsonValue>());

        public IReadOnlyList<KeyValuePair<string, JsonValue>> Fields => _fields ?? throw new InvalidOperationException("Kein JSON-Objekt");
        public IReadOnlyList<JsonValue> Items => _items ?? throw new InvalidOperationException("Kein JSON-Array");

        /// <summary>Fuegt ein Feld an (nur Objekte). Doppelte Namen sind ein Programmierfehler.</summary>
        public JsonValue Set(string name, JsonValue value)
        {
            List<KeyValuePair<string, JsonValue>> fields = _fields ?? throw new InvalidOperationException("Kein JSON-Objekt");
            foreach (KeyValuePair<string, JsonValue> f in fields)
            {
                if (f.Key == name)
                {
                    throw new InvalidOperationException($"Feld '{name}' doppelt gesetzt");
                }
            }
            fields.Add(new KeyValuePair<string, JsonValue>(name, value));
            return this;
        }

        public JsonValue Set(string name, long value) => Set(name, From(value));
        public JsonValue Set(string name, string value) => Set(name, From(value));
        public JsonValue Set(string name, bool value) => Set(name, From(value));

        public JsonValue Add(JsonValue value)
        {
            (_items ?? throw new InvalidOperationException("Kein JSON-Array")).Add(value);
            return this;
        }

        public bool TryGet(string name, out JsonValue value)
        {
            if (_fields != null)
            {
                foreach (KeyValuePair<string, JsonValue> f in _fields)
                {
                    if (f.Key == name)
                    {
                        value = f.Value;
                        return true;
                    }
                }
            }
            value = Null;
            return false;
        }

        /// <summary>Liest ein Pflichtfeld; fehlt es, gibt es eine verstaendliche Fehlermeldung.</summary>
        public JsonValue Get(string name) =>
            TryGet(name, out JsonValue v) ? v : throw new JsonFormatException($"Pflichtfeld '{name}' fehlt");

        public long GetInt(string name) => Get(name).AsInt(name);
        public string GetString(string name) => Get(name).AsString(name);
        public bool GetBool(string name) => Get(name).AsBool(name);

        public long AsInt(string context = "Wert") =>
            Kind == JsonKind.Integer ? IntValue : throw new JsonFormatException($"{context}: Ganzzahl erwartet, gefunden {Kind}");

        public string AsString(string context = "Wert") =>
            Kind == JsonKind.String ? StringValue! : throw new JsonFormatException($"{context}: Text erwartet, gefunden {Kind}");

        public bool AsBool(string context = "Wert") =>
            Kind == JsonKind.Bool ? BoolValue : throw new JsonFormatException($"{context}: Wahrheitswert erwartet, gefunden {Kind}");

        /// <summary>Kanonische Ausgabe ohne Leerraum.</summary>
        public string ToJson()
        {
            var sb = new StringBuilder();
            Write(sb);
            return sb.ToString();
        }

        private void Write(StringBuilder sb)
        {
            switch (Kind)
            {
                case JsonKind.Null: sb.Append("null"); break;
                case JsonKind.Bool: sb.Append(BoolValue ? "true" : "false"); break;
                case JsonKind.Integer: sb.Append(IntValue.ToString(CultureInfo.InvariantCulture)); break;
                case JsonKind.String: WriteString(sb, StringValue!); break;
                case JsonKind.Array:
                    sb.Append('[');
                    for (int i = 0; i < _items!.Count; i++)
                    {
                        if (i > 0) sb.Append(',');
                        _items[i].Write(sb);
                    }
                    sb.Append(']');
                    break;
                case JsonKind.Object:
                    sb.Append('{');
                    for (int i = 0; i < _fields!.Count; i++)
                    {
                        if (i > 0) sb.Append(',');
                        WriteString(sb, _fields[i].Key);
                        sb.Append(':');
                        _fields[i].Value.Write(sb);
                    }
                    sb.Append('}');
                    break;
            }
        }

        private static void WriteString(StringBuilder sb, string s)
        {
            sb.Append('"');
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20)
                        {
                            sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        }
                        else
                        {
                            sb.Append(c);
                        }
                        break;
                }
            }
            sb.Append('"');
        }

        /// <summary>Liest JSON. Gleitkommazahlen werden abgelehnt (Code-Regel 2).</summary>
        public static JsonValue Parse(string text) => new Parser(text ?? throw new ArgumentNullException(nameof(text))).ParseDocument();

        private sealed class Parser
        {
            private readonly string _s;
            private int _i;

            public Parser(string s) => _s = s;

            public JsonValue ParseDocument()
            {
                SkipWhitespace();
                JsonValue v = ParseValue();
                SkipWhitespace();
                if (_i != _s.Length)
                {
                    throw Error("Unerwartete Zeichen nach dem Ende");
                }
                return v;
            }

            private JsonValue ParseValue()
            {
                if (_i >= _s.Length) throw Error("Unerwartetes Ende");
                char c = _s[_i];
                switch (c)
                {
                    case '{': return ParseObject();
                    case '[': return ParseArray();
                    case '"': return From(ParseString());
                    case 't': Expect("true"); return From(true);
                    case 'f': Expect("false"); return From(false);
                    case 'n': Expect("null"); return Null;
                    default:
                        if (c == '-' || (c >= '0' && c <= '9')) return ParseNumber();
                        throw Error($"Unerwartetes Zeichen '{c}'");
                }
            }

            private JsonValue ParseObject()
            {
                JsonValue obj = NewObject();
                _i++;
                SkipWhitespace();
                if (Peek() == '}') { _i++; return obj; }
                while (true)
                {
                    SkipWhitespace();
                    if (Peek() != '"') throw Error("Feldname erwartet");
                    string name = ParseString();
                    SkipWhitespace();
                    if (Peek() != ':') throw Error("':' erwartet");
                    _i++;
                    SkipWhitespace();
                    if (obj.TryGet(name, out _)) throw Error($"Feld '{name}' doppelt");
                    obj.Set(name, ParseValue());
                    SkipWhitespace();
                    char c = Peek();
                    _i++;
                    if (c == '}') return obj;
                    if (c != ',') throw Error("',' oder '}' erwartet");
                }
            }

            private JsonValue ParseArray()
            {
                JsonValue arr = NewArray();
                _i++;
                SkipWhitespace();
                if (Peek() == ']') { _i++; return arr; }
                while (true)
                {
                    SkipWhitespace();
                    arr.Add(ParseValue());
                    SkipWhitespace();
                    char c = Peek();
                    _i++;
                    if (c == ']') return arr;
                    if (c != ',') throw Error("',' oder ']' erwartet");
                }
            }

            private string ParseString()
            {
                var sb = new StringBuilder();
                _i++;
                while (true)
                {
                    if (_i >= _s.Length) throw Error("Text nicht abgeschlossen");
                    char c = _s[_i++];
                    if (c == '"') return sb.ToString();
                    if (c != '\\') { sb.Append(c); continue; }
                    if (_i >= _s.Length) throw Error("Text nicht abgeschlossen");
                    char e = _s[_i++];
                    switch (e)
                    {
                        case '"': sb.Append('"'); break;
                        case '\\': sb.Append('\\'); break;
                        case '/': sb.Append('/'); break;
                        case 'b': sb.Append('\b'); break;
                        case 'f': sb.Append('\f'); break;
                        case 'n': sb.Append('\n'); break;
                        case 'r': sb.Append('\r'); break;
                        case 't': sb.Append('\t'); break;
                        case 'u':
                            if (_i + 4 > _s.Length) throw Error("Unvollstaendiges \\u");
                            sb.Append((char)int.Parse(_s.Substring(_i, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                            _i += 4;
                            break;
                        default: throw Error($"Unbekannte Escape-Folge \\{e}");
                    }
                }
            }

            private JsonValue ParseNumber()
            {
                int start = _i;
                if (Peek() == '-') _i++;
                while (_i < _s.Length && char.IsDigit(_s[_i])) _i++;
                if (_i < _s.Length && (_s[_i] == '.' || _s[_i] == 'e' || _s[_i] == 'E'))
                {
                    throw Error("Gleitkommazahlen sind im Kern nicht erlaubt");
                }
                string token = _s.Substring(start, _i - start);
                if (!long.TryParse(token, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out long v))
                {
                    throw Error($"Ungueltige Ganzzahl '{token}'");
                }
                return From(v);
            }

            private void Expect(string word)
            {
                if (string.CompareOrdinal(_s, _i, word, 0, word.Length) != 0) throw Error($"'{word}' erwartet");
                _i += word.Length;
            }

            private char Peek() => _i < _s.Length ? _s[_i] : '\0';

            private void SkipWhitespace()
            {
                while (_i < _s.Length && (_s[_i] == ' ' || _s[_i] == '\t' || _s[_i] == '\n' || _s[_i] == '\r')) _i++;
            }

            private JsonFormatException Error(string message) => new JsonFormatException($"{message} (Zeichen {_i})");
        }
    }

    /// <summary>Fehler beim Lesen von JSON oder fehlende/falsche Felder.</summary>
    public sealed class JsonFormatException : Exception
    {
        public JsonFormatException(string message) : base(message)
        {
        }
    }
}
