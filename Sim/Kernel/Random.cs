using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using MonsterClinic.Sim.Data;

namespace MonsterClinic.Sim.Kernel
{
    /// <summary>
    /// Zufallsgenerator xoshiro256** (Pflichtenheft 3). Ergebnis ist auf jeder Plattform gleich.
    /// Liefert nur Ganzzahlen; Wahrscheinlichkeiten werden in Promille oder Prozent angegeben.
    /// </summary>
    public sealed class SimRandom
    {
        private ulong _s0, _s1, _s2, _s3;

        public SimRandom(ulong seed)
        {
            ulong x = seed;
            _s0 = SplitMix64(ref x);
            _s1 = SplitMix64(ref x);
            _s2 = SplitMix64(ref x);
            _s3 = SplitMix64(ref x);
        }

        private SimRandom(ulong s0, ulong s1, ulong s2, ulong s3)
        {
            _s0 = s0; _s1 = s1; _s2 = s2; _s3 = s3;
        }

        public ulong NextULong()
        {
            ulong result = RotL(_s1 * 5, 7) * 9;
            ulong t = _s1 << 17;
            _s2 ^= _s0;
            _s3 ^= _s1;
            _s1 ^= _s2;
            _s0 ^= _s3;
            _s2 ^= t;
            _s3 = RotL(_s3, 45);
            return result;
        }

        /// <summary>Gleichverteilte Zahl in [0, exclusiveMax) ohne Verzerrung.</summary>
        public long NextLong(long exclusiveMax)
        {
            if (exclusiveMax <= 0) throw new ArgumentOutOfRangeException(nameof(exclusiveMax));
            ulong bound = (ulong)exclusiveMax;
            ulong threshold = (0UL - bound) % bound;
            while (true)
            {
                ulong r = NextULong();
                if (r >= threshold) return (long)(r % bound);
            }
        }

        /// <summary>Gleichverteilte Zahl in [min, max].</summary>
        public long Range(long min, long max)
        {
            if (max < min) throw new ArgumentOutOfRangeException(nameof(max));
            return min + NextLong(max - min + 1);
        }

        /// <summary>Wahr mit einer Wahrscheinlichkeit von permille/1000.</summary>
        public bool ChancePermille(int permille) => NextLong(1000) < permille;

        internal ulong[] GetState() => new[] { _s0, _s1, _s2, _s3 };
        internal static SimRandom FromState(ulong[] s) => new SimRandom(s[0], s[1], s[2], s[3]);

        private static ulong RotL(ulong x, int k) => (x << k) | (x >> (64 - k));

        private static ulong SplitMix64(ref ulong x)
        {
            ulong z = x += 0x9E3779B97F4A7C15UL;
            z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
            z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
            return z ^ (z >> 31);
        }
    }

    /// <summary>
    /// Ein eigener Zufallsstrom je System, abgeleitet aus dem Startwert und dem Systemnamen.
    /// Kommt ein System hinzu, bleiben die Folgen der anderen unveraendert (Pflichtenheft 3).
    /// </summary>
    public sealed class RandomStreams
    {
        private readonly Dictionary<string, SimRandom> _streams = new Dictionary<string, SimRandom>(StringComparer.Ordinal);

        public RandomStreams(ulong seed) => Seed = seed;

        public ulong Seed { get; }

        public SimRandom Get(string streamName)
        {
            if (!_streams.TryGetValue(streamName, out SimRandom? rng))
            {
                rng = new SimRandom(Seed ^ Fnv1a.Hash(streamName));
                _streams[streamName] = rng;
            }
            return rng;
        }

        public JsonValue SaveState()
        {
            JsonValue streams = JsonValue.NewObject();
            foreach (KeyValuePair<string, SimRandom> s in _streams.OrderBy(p => p.Key, StringComparer.Ordinal))
            {
                JsonValue state = JsonValue.NewArray();
                foreach (ulong part in s.Value.GetState())
                {
                    state.Add(JsonValue.From(part.ToString("x16", CultureInfo.InvariantCulture)));
                }
                streams.Set(s.Key, state);
            }
            return JsonValue.NewObject()
                .Set("seed", Seed.ToString("x16", CultureInfo.InvariantCulture))
                .Set("streams", streams);
        }

        public static RandomStreams LoadState(JsonValue state)
        {
            var result = new RandomStreams(ParseHex(state.GetString("seed")));
            foreach (KeyValuePair<string, JsonValue> s in state.Get("streams").Fields)
            {
                ulong[] parts = s.Value.Items.Select(i => ParseHex(i.AsString(s.Key))).ToArray();
                if (parts.Length != 4) throw new JsonFormatException($"Zufallsstrom '{s.Key}': 4 Werte erwartet");
                result._streams[s.Key] = SimRandom.FromState(parts);
            }
            return result;
        }

        private static ulong ParseHex(string text) =>
            ulong.TryParse(text, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out ulong v)
                ? v
                : throw new JsonFormatException($"Ungueltiger Zufallszustand '{text}'");
    }
}
