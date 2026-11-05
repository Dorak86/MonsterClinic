using System;
using System.Collections.Generic;
using System.Linq;
using MonsterClinic.Sim.Data;
using MonsterClinic.Sim.Kernel;

namespace MonsterClinic.Sim.World
{
    public sealed class WalkerArrived : IDomainEvent
    {
        public WalkerArrived(long tick, EntityId walker, Tile tile)
        {
            Tick = tick;
            Walker = walker;
            Tile = tile;
        }

        public long Tick { get; }
        public EntityId Walker { get; }
        public Tile Tile { get; }
    }

    public sealed class WalkerStuck : IDomainEvent
    {
        public WalkerStuck(long tick, EntityId walker, Tile at, Tile goal)
        {
            Tick = tick;
            Walker = walker;
            At = at;
            Goal = goal;
        }

        public long Tick { get; }
        public EntityId Walker { get; }
        public Tile At { get; }
        public Tile Goal { get; }
    }

    /// <summary>Position und Weg einer Figur. Fortschritt in 1/256 Kachel (Festkomma, Code-Regel 2).</summary>
    public sealed class Walker
    {
        internal Walker(EntityId id, Tile tile, int speed)
        {
            Id = id;
            Tile = tile;
            Speed = speed;
        }

        public EntityId Id { get; }
        public Tile Tile { get; internal set; }
        public Tile? Goal { get; internal set; }

        /// <summary>Tempo in 1/256 Kachel pro Tick.</summary>
        public int Speed { get; internal set; }

        /// <summary>Zurueckgelegter Anteil des aktuellen Schritts in 1/256 Kachel.</summary>
        public int Progress { get; internal set; }

        internal List<Tile> Remaining { get; } = new List<Tile>();
        internal long PathVersion { get; set; }

        public Tile? NextTile => Remaining.Count > 0 ? Remaining[0] : (Tile?)null;
        public bool IsMoving => Goal.HasValue;
    }

    /// <summary>
    /// Bewegt Figuren von Kachelmitte zu Kachelmitte (Pflichtenheft 7). Bei einer Bauaenderung wird der Weg neu gesucht;
    /// ist das Ziel unerreichbar, meldet das System <see cref="WalkerStuck"/>.
    /// ZWISCHENSTAND (Regel 6): Belegungsgrenze je Kachel, Tuerdurchlass und Ausweichen folgen mit dem Patientenablauf (K3).
    /// </summary>
    public sealed class MovementSystem : ISimSystem
    {
        public const int UnitsPerTile = 256;
        public const int DiagonalUnits = 362; // 256 * Wurzel 2, gerundet

        private readonly SortedDictionary<ulong, Walker> _walkers = new SortedDictionary<ulong, Walker>();
        private BuildingSystem? _building;
        private Pathfinder? _pathfinder;

        public string Name => "Movement";
        public int IntervalTicks => 1;
        public int OffsetTicks => 0;

        public IEnumerable<Walker> Walkers => _walkers.Values;

        public Walker Get(EntityId id) =>
            _walkers.TryGetValue(id.Value, out Walker? w) ? w : throw new KeyNotFoundException($"Keine Figur {id}");

        public bool Contains(EntityId id) => _walkers.ContainsKey(id.Value);

        public Walker Spawn(EntityId id, Tile tile, int speed)
        {
            if (speed < 1) throw new ArgumentOutOfRangeException(nameof(speed));
            if (_walkers.ContainsKey(id.Value)) throw new InvalidOperationException($"Figur {id} existiert bereits");
            var w = new Walker(id, tile, speed);
            _walkers[id.Value] = w;
            return w;
        }

        public void Remove(EntityId id) => _walkers.Remove(id.Value);

        /// <summary>Schickt eine Figur los. Gibt false zurueck, wenn das Ziel unerreichbar ist.</summary>
        public bool SetGoal(Simulation sim, EntityId id, Tile goal)
        {
            Walker w = Get(id);
            w.Goal = goal;
            return Repath(sim, w);
        }

        public void Update(Simulation sim)
        {
            BuildingSystem building = Building(sim);
            foreach (Walker w in _walkers.Values)
            {
                if (!w.Goal.HasValue) continue;
                if (w.PathVersion != building.Version && !Repath(sim, w)) continue;
                if (w.Remaining.Count == 0)
                {
                    Arrive(sim, w);
                    continue;
                }

                Tile next = w.Remaining[0];
                int stepLength = next.X != w.Tile.X && next.Y != w.Tile.Y ? DiagonalUnits : UnitsPerTile;
                w.Progress += w.Speed;
                while (w.Progress >= stepLength && w.Remaining.Count > 0)
                {
                    w.Progress -= stepLength;
                    w.Tile = w.Remaining[0];
                    w.Remaining.RemoveAt(0);
                    if (w.Remaining.Count == 0)
                    {
                        Arrive(sim, w);
                        break;
                    }
                    next = w.Remaining[0];
                    stepLength = next.X != w.Tile.X && next.Y != w.Tile.Y ? DiagonalUnits : UnitsPerTile;
                }
            }
        }

        private void Arrive(Simulation sim, Walker w)
        {
            w.Goal = null;
            w.Progress = 0;
            w.Remaining.Clear();
            sim.Events.Publish(new WalkerArrived(sim.Tick, w.Id, w.Tile));
        }

        private bool Repath(Simulation sim, Walker w)
        {
            BuildingSystem building = Building(sim);
            w.PathVersion = building.Version;
            w.Remaining.Clear();
            w.Progress = 0;
            if (!w.Goal.HasValue) return true;
            IReadOnlyList<Tile>? path = Finder(sim).FindPath(w.Tile, w.Goal.Value);
            if (path == null)
            {
                Tile goal = w.Goal.Value;
                w.Goal = null;
                sim.Events.Publish(new WalkerStuck(sim.Tick, w.Id, w.Tile, goal));
                sim.Log.Warning(Name, $"Ziel {goal} von {w.Tile} aus nicht erreichbar", w.Id.Value);
                return false;
            }
            w.Remaining.AddRange(path.Skip(1));
            return true;
        }

        private BuildingSystem Building(Simulation sim) => _building ??= sim.GetSystem<BuildingSystem>();

        private Pathfinder Finder(Simulation sim) => _pathfinder ??= new Pathfinder(Building(sim));

        /// <summary>Gemeinsam genutzte Wegfindung (zwischengespeicherte Wege).</summary>
        public Pathfinder GetPathfinder(Simulation sim) => Finder(sim);

        public JsonValue SaveState()
        {
            JsonValue walkers = JsonValue.NewArray();
            foreach (Walker w in _walkers.Values)
            {
                JsonValue path = JsonValue.NewArray();
                foreach (Tile t in w.Remaining) path.Add(JsonValue.NewArray().Add(JsonValue.From(t.X)).Add(JsonValue.From(t.Y)));
                JsonValue o = JsonValue.NewObject()
                    .Set("id", checked((long)w.Id.Value)).Set("x", w.Tile.X).Set("y", w.Tile.Y)
                    .Set("speed", w.Speed).Set("progress", w.Progress).Set("pathVersion", w.PathVersion);
                o.Set("goal", w.Goal.HasValue ? JsonValue.NewArray().Add(JsonValue.From(w.Goal.Value.X)).Add(JsonValue.From(w.Goal.Value.Y)) : JsonValue.Null);
                o.Set("path", path);
                walkers.Add(o);
            }
            return JsonValue.NewObject().Set("walkers", walkers);
        }

        public void LoadState(JsonValue state)
        {
            _walkers.Clear();
            foreach (JsonValue o in state.Get("walkers").Items)
            {
                var w = new Walker(new EntityId((ulong)o.GetInt("id")), new Tile((int)o.GetInt("x"), (int)o.GetInt("y")), (int)o.GetInt("speed"))
                {
                    Progress = (int)o.GetInt("progress"),
                    PathVersion = o.GetInt("pathVersion"),
                };
                JsonValue goal = o.Get("goal");
                if (goal.Kind != JsonKind.Null) w.Goal = new Tile((int)goal.Items[0].AsInt(), (int)goal.Items[1].AsInt());
                foreach (JsonValue p in o.Get("path").Items) w.Remaining.Add(new Tile((int)p.Items[0].AsInt(), (int)p.Items[1].AsInt()));
                _walkers[w.Id.Value] = w;
            }
        }
    }

    /// <summary>
    /// Warteschlange eines Raums (Pflichtenheft 7, A-11): Notfall vor kuerzester Restfrist vor Ankunftszeit;
    /// bei Gleichstand entscheidet die ID, damit die Reihenfolge immer gleich ist.
    /// Die Restfrist aendert sich laufend und wird deshalb erst bei der Auswahl abgefragt.
    /// </summary>
    public sealed class RoomQueue
    {
        private readonly List<(EntityId Id, long ArrivalTick)> _entries = new List<(EntityId, long)>();

        public int Count => _entries.Count;

        public IEnumerable<EntityId> Members => _entries.Select(e => e.Id);

        public void Enqueue(EntityId id, long arrivalTick)
        {
            if (_entries.Any(e => e.Id == id)) throw new InvalidOperationException($"{id} steht bereits in der Warteschlange");
            _entries.Add((id, arrivalTick));
        }

        public bool Remove(EntityId id) => _entries.RemoveAll(e => e.Id == id) > 0;

        /// <summary>Reihenfolge nach Dringlichkeit, ohne die Schlange zu veraendern.</summary>
        public IReadOnlyList<EntityId> Ordered(Func<EntityId, (bool Emergency, long RemainingTicks)> urgency) =>
            _entries
                .Select(e => (e.Id, e.ArrivalTick, U: urgency(e.Id)))
                .OrderBy(x => x.U.Emergency ? 0 : 1)
                .ThenBy(x => x.U.RemainingTicks)
                .ThenBy(x => x.ArrivalTick)
                .ThenBy(x => x.Id.Value)
                .Select(x => x.Id)
                .ToList();

        /// <summary>Nimmt den dringendsten Eintrag heraus.</summary>
        public EntityId? DequeueMostUrgent(Func<EntityId, (bool Emergency, long RemainingTicks)> urgency)
        {
            if (_entries.Count == 0) return null;
            EntityId first = Ordered(urgency)[0];
            Remove(first);
            return first;
        }

        public JsonValue SaveState()
        {
            JsonValue arr = JsonValue.NewArray();
            foreach ((EntityId id, long arrival) in _entries)
                arr.Add(JsonValue.NewObject().Set("id", checked((long)id.Value)).Set("arrival", arrival));
            return arr;
        }

        public void LoadState(JsonValue state)
        {
            _entries.Clear();
            foreach (JsonValue e in state.Items) _entries.Add((new EntityId((ulong)e.GetInt("id")), e.GetInt("arrival")));
        }
    }
}
