using System;
using MonsterClinic.Sim.Data;

namespace MonsterClinic.Sim.Kernel
{
    /// <summary>Stabile 64-Bit-ID einer Entitaet. 0 bedeutet "keine". IDs werden nie wiederverwendet (Pflichtenheft 3).</summary>
    public readonly struct EntityId : IEquatable<EntityId>, IComparable<EntityId>
    {
        public EntityId(ulong value) => Value = value;

        public ulong Value { get; }
        public bool IsNone => Value == 0;
        public static readonly EntityId None = new EntityId(0);

        public bool Equals(EntityId other) => Value == other.Value;
        public override bool Equals(object? obj) => obj is EntityId other && Equals(other);
        public override int GetHashCode() => Value.GetHashCode();
        public int CompareTo(EntityId other) => Value.CompareTo(other.Value);
        public override string ToString() => $"E#{Value}";
        public static bool operator ==(EntityId a, EntityId b) => a.Value == b.Value;
        public static bool operator !=(EntityId a, EntityId b) => a.Value != b.Value;
    }

    /// <summary>Vergibt fortlaufende IDs ab 1.</summary>
    public sealed class IdAllocator
    {
        private ulong _next = 1;

        public EntityId Next() => new EntityId(_next++);

        public JsonValue SaveState() => JsonValue.NewObject().Set("next", checked((long)_next));

        public void LoadState(JsonValue state)
        {
            long next = state.GetInt("next");
            if (next < 1) throw new JsonFormatException("IdAllocator: 'next' muss mindestens 1 sein");
            _next = (ulong)next;
        }
    }

    /// <summary>Bestimmte, plattformunabhaengige Text-Pruefsumme (FNV-1a, 64 Bit) fuer Namen von Zufallsstroemen.</summary>
    internal static class Fnv1a
    {
        public static ulong Hash(string text)
        {
            ulong hash = 14695981039346656037UL;
            foreach (char c in text)
            {
                hash ^= c;
                hash *= 1099511628211UL;
            }
            return hash;
        }
    }
}
