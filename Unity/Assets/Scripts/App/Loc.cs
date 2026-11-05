#nullable enable
using System.Collections.Generic;
using System.IO;
using MonsterClinic.Sim.Data;
using UnityEngine;

namespace MonsterClinic.App
{
    /// <summary>
    /// Sprachtabelle aus Content/localization (Pflichtenheft 4: keine festen Texte im Code).
    /// Fehlende Schluessel erscheinen als [schluessel], damit sie beim Testen auffallen.
    /// </summary>
    public sealed class Loc
    {
        private readonly Dictionary<string, string> _texts = new Dictionary<string, string>();

        public Loc(string contentRoot, string language)
        {
            string file = Path.Combine(contentRoot, "localization", language + ".json");
            if (!File.Exists(file))
            {
                Debug.LogWarning($"[Loc] Sprachtabelle {file} fehlt");
                return;
            }
            foreach (KeyValuePair<string, JsonValue> f in JsonValue.Parse(File.ReadAllText(file)).Fields)
            {
                if (f.Value.Kind == JsonKind.String) _texts[f.Key] = f.Value.AsString();
            }
        }

        public string this[string key] => _texts.TryGetValue(key, out string? t) ? t : "[" + key + "]";

        /// <summary>Setzt benannte Platzhalter ein, z. B. Format("currency.amount", ("amount", "1.200")).</summary>
        public string Format(string key, params (string Name, object Value)[] args)
        {
            string text = this[key];
            foreach ((string name, object value) in args) text = text.Replace("{" + name + "}", value.ToString());
            return text;
        }

        /// <summary>Name eines Inhalts, z. B. species.ghost -> "Geist".</summary>
        public string Name(string id) => this[id + ".name"];

        /// <summary>Betrag mit Tausenderpunkten und Waehrung (A-15).</summary>
        public string Money(long amount) => Format("currency.amount", ("amount", amount.ToString("#,0", System.Globalization.CultureInfo.GetCultureInfo("de-DE"))));
    }
}
