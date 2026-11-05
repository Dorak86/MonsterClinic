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

    public sealed class SpeciesDef
    {
        public SpeciesDef(string id, bool nightCreature, int groupSizeMin, bool placeholder)
        {
            Id = id;
            NightCreature = nightCreature;
            GroupSizeMin = groupSizeMin;
            Placeholder = placeholder;
        }

        public string Id { get; }
        public bool NightCreature { get; }
        public int GroupSizeMin { get; }
        public bool Placeholder { get; }
    }

    public readonly struct DiagnosisStep
    {
        public DiagnosisStep(string procedureId, int powerPercent)
        {
            ProcedureId = procedureId;
            PowerPercent = powerPercent;
        }

        public string ProcedureId { get; }
        public int PowerPercent { get; }
    }

    /// <summary>Krankheit (Planung 4.4). Platzhalter haben nur Spezies und Namen und nehmen nicht am Ablauf teil.</summary>
    public sealed class DiseaseDef
    {
        public DiseaseDef(string id, string speciesId, string severity, IReadOnlyList<DiagnosisStep> diagnosis, string treatmentId,
            IReadOnlyList<string> complications, int deadlineMinutes, bool placeholder)
        {
            Id = id;
            SpeciesId = speciesId;
            Severity = severity;
            Diagnosis = diagnosis;
            TreatmentId = treatmentId;
            Complications = complications;
            DeadlineMinutes = deadlineMinutes;
            Placeholder = placeholder;
        }

        public string Id { get; }
        public string SpeciesId { get; }
        public string Severity { get; }
        public IReadOnlyList<DiagnosisStep> Diagnosis { get; }
        public string TreatmentId { get; }
        public IReadOnlyList<string> Complications { get; }
        public int DeadlineMinutes { get; }
        public bool Placeholder { get; }
    }

    /// <summary>Untersuchung oder Behandlung mit der noetigen Spezialisierung des Monsterarztes.</summary>
    public sealed class ProcedureDef
    {
        public ProcedureDef(string id, string specialization)
        {
            Id = id;
            Specialization = specialization;
        }

        public string Id { get; }
        public string Specialization { get; }
    }

    public sealed class ComplicationDef
    {
        public ComplicationDef(string id, string effect, int permanentAfterMinutes, bool placeholder)
        {
            Id = id;
            Effect = effect;
            PermanentAfterMinutes = permanentAfterMinutes;
            Placeholder = placeholder;
        }

        public string Id { get; }

        /// <summary>permanent_uncured, emergency, extra_damage_and_mess, death</summary>
        public string Effect { get; }
        public int PermanentAfterMinutes { get; }
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
        private readonly Dictionary<string, SpeciesDef> _species = new Dictionary<string, SpeciesDef>(StringComparer.Ordinal);
        private readonly Dictionary<string, DiseaseDef> _diseases = new Dictionary<string, DiseaseDef>(StringComparer.Ordinal);
        private readonly Dictionary<string, ProcedureDef> _procedures = new Dictionary<string, ProcedureDef>(StringComparer.Ordinal);
        private readonly Dictionary<string, ProcedureDef> _treatments = new Dictionary<string, ProcedureDef>(StringComparer.Ordinal);
        private readonly Dictionary<string, ComplicationDef> _complications = new Dictionary<string, ComplicationDef>(StringComparer.Ordinal);
        private readonly Dictionary<string, JsonValue> _balancing = new Dictionary<string, JsonValue>(StringComparer.Ordinal);

        public IReadOnlyDictionary<string, SpeciesDef> Species => _species;
        public IReadOnlyDictionary<string, DiseaseDef> Diseases => _diseases;
        public IReadOnlyDictionary<string, ProcedureDef> Procedures => _procedures;
        public IReadOnlyDictionary<string, ProcedureDef> Treatments => _treatments;
        public IReadOnlyDictionary<string, ComplicationDef> Complications => _complications;

        /// <summary>Balancing-Datei nach Dateiname ohne Endung, z. B. "clinic_loop".</summary>
        public JsonValue Balancing(string name) =>
            _balancing.TryGetValue(name, out JsonValue? v) ? v : throw new KeyNotFoundException($"Balancing-Datei '{name}' fehlt");

        public void AddBalancing(string name, JsonValue value) => Put(_balancing, name, value);

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
                case "species":
                    Put(_species, id, new SpeciesDef(id, record.GetString("activity") == "night",
                        record.TryGet("groupSizeMin", out JsonValue g) ? checked((int)g.AsInt("groupSizeMin")) : 1, placeholder));
                    break;
                case "diseases":
                    Put(_diseases, id, placeholder
                        ? new DiseaseDef(id, record.Get("species").Items[0].AsString(), "medium", Array.Empty<DiagnosisStep>(), string.Empty, Array.Empty<string>(), 0, true)
                        : new DiseaseDef(id, record.Get("species").Items[0].AsString(), record.GetString("severity"),
                            record.Get("diagnosis").Items.Select(d => new DiagnosisStep(d.GetString("procedure"), checked((int)d.GetInt("power")))).ToList(),
                            record.GetString("treatment"), record.Get("complications").Items.Select(c => c.AsString()).ToList(),
                            checked((int)record.GetInt("deadlineGameMinutes")), false));
                    break;
                case "procedures":
                    Put(_procedures, id, new ProcedureDef(id, record.GetString("specialization")));
                    break;
                case "treatments":
                    Put(_treatments, id, new ProcedureDef(id, record.GetString("specialization")));
                    break;
                case "complications":
                    Put(_complications, id, new ComplicationDef(id, record.GetString("effect"),
                        record.TryGet("permanentAfterGameMinutes", out JsonValue pa) ? checked((int)pa.AsInt()) : 0, placeholder));
                    break;
            }
        }

        public IEnumerable<string> PlaceholderIds() =>
            _roomTypes.Values.Where(r => r.Placeholder).Select(r => r.Id)
                .Concat(_diseases.Values.Where(d => d.Placeholder).Select(d => d.Id))
                .Concat(_complications.Values.Where(c => c.Placeholder).Select(c => c.Id));

        private static void Put<T>(Dictionary<string, T> dict, string id, T value)
        {
            if (dict.ContainsKey(id)) throw new JsonFormatException($"ID '{id}' ist doppelt");
            dict[id] = value;
        }
    }
}
