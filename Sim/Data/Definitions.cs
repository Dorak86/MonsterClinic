using System;
using System.Collections.Generic;
using System.Linq;

namespace MonsterClinic.Sim.Data
{
    /// <summary>Raumtyp aus Content/rooms (Datenmodell Planung 4.5). Weitere Felder folgen mit den Systemen, die sie nutzen.</summary>
    public sealed class RoomTypeDef
    {
        public RoomTypeDef(string id, int minWidth, int minHeight, bool placeholder)
        {
            Id = id;
            MinWidth = minWidth;
            MinHeight = minHeight;
            Placeholder = placeholder;
        }

        public string Id { get; }
        public int MinWidth { get; }
        public int MinHeight { get; }
        public bool Placeholder { get; }
    }

    /// <summary>Fester Grundriss einer Klinik aus Content/clinics (Meilenstein K2: feste Testklinik).</summary>
    public sealed class ClinicLayoutDef
    {
        public ClinicLayoutDef(string id, JsonValue raw)
        {
            Id = id;
            Raw = raw;
        }

        public string Id { get; }

        /// <summary>Der Datensatz; ausgewertet von <see cref="World.ClinicLayout"/>.</summary>
        public JsonValue Raw { get; }
    }

    /// <summary>
    /// Alle Inhaltsdefinitionen, die der Kern kennt. Wird vom Gastgeber aus den JSON-Dateien befuellt;
    /// der Kern selbst liest keine Dateien.
    /// </summary>
    public sealed class ContentDb
    {
        private readonly Dictionary<string, RoomTypeDef> _roomTypes = new Dictionary<string, RoomTypeDef>(StringComparer.Ordinal);
        private readonly Dictionary<string, ClinicLayoutDef> _clinics = new Dictionary<string, ClinicLayoutDef>(StringComparer.Ordinal);

        public IReadOnlyDictionary<string, RoomTypeDef> RoomTypes => _roomTypes;
        public IReadOnlyDictionary<string, ClinicLayoutDef> Clinics => _clinics;

        public RoomTypeDef RoomType(string id) =>
            _roomTypes.TryGetValue(id, out RoomTypeDef? def) ? def : throw new KeyNotFoundException($"Unbekannter Raumtyp '{id}'");

        /// <summary>Uebernimmt einen Datensatz aus dem genannten Inhaltsordner. Unbekannte Ordner werden ignoriert, bis ihr System existiert.</summary>
        public void Add(string folder, JsonValue record)
        {
            string id = record.GetString("id");
            bool placeholder = record.TryGet("placeholder", out JsonValue ph) && ph.Kind == JsonKind.Bool && ph.BoolValue;
            switch (folder)
            {
                case "rooms":
                    Put(_roomTypes, id, new RoomTypeDef(id, checked((int)record.GetInt("minWidth")), checked((int)record.GetInt("minHeight")), placeholder));
                    break;
                case "clinics":
                    Put(_clinics, id, new ClinicLayoutDef(id, record));
                    break;
            }
        }

        public IEnumerable<string> PlaceholderIds() => _roomTypes.Values.Where(r => r.Placeholder).Select(r => r.Id);

        private static void Put<T>(Dictionary<string, T> dict, string id, T value)
        {
            if (dict.ContainsKey(id)) throw new JsonFormatException($"ID '{id}' ist doppelt");
            dict[id] = value;
        }
    }
}
