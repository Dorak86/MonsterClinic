using System;
using System.Collections.Generic;
using System.Linq;
using MonsterClinic.Sim.Data;
using MonsterClinic.Sim.Kernel;

namespace MonsterClinic.Sim.World
{
    /// <summary>Ein Raum (Zustand, Planung 4.5). Im MVP rechteckig.</summary>
    public sealed class Room
    {
        public Room(EntityId id, string typeId, TileRect rect)
        {
            Id = id;
            TypeId = typeId;
            Rect = rect;
        }

        public EntityId Id { get; }
        public string TypeId { get; }
        public TileRect Rect { get; }
    }

    /// <summary>Befund der Raumpruefung (BAU-05): z. B. Raum ohne Tuer oder nicht erreichbar.</summary>
    public readonly struct LayoutIssue
    {
        public LayoutIssue(EntityId roomId, string reasonKey, string reasonText)
        {
            RoomId = roomId;
            ReasonKey = reasonKey;
            ReasonText = reasonText;
        }

        public EntityId RoomId { get; }
        public string ReasonKey { get; }
        public string ReasonText { get; }
        public override string ToString() => $"{RoomId}: {ReasonText}";
    }

    public sealed class BuildingChanged : IDomainEvent
    {
        public BuildingChanged(long tick, long version)
        {
            Tick = tick;
            Version = version;
        }

        public long Tick { get; }
        public long Version { get; }
    }

    /// <summary>
    /// Grundstueck, Gebaeudeflaeche, Raeume, Waende und Tueren (Pflichtenheft 2, BAU-01 bis BAU-09).
    /// Waende werden nicht einzeln gespeichert, sondern aus den Flaechen abgeleitet: Zwischen zwei Kacheln
    /// steht eine Wand, wenn sie zu verschiedenen Bereichen gehoeren (Raum, Flur, draussen).
    /// Eine Tuer oeffnet eine solche Wandkante.
    /// </summary>
    public sealed class BuildingSystem : ISimSystem
    {
        private const int Outside = -2;
        private const int Corridor = -1;

        private readonly ContentDb _content;
        private readonly List<TileRect> _footprints = new List<TileRect>();
        private readonly List<Room> _rooms = new List<Room>();
        private readonly SortedSet<Edge> _doors = new SortedSet<Edge>();
        private readonly HashSet<Edge> _walls = new HashSet<Edge>();
        private int[] _area = Array.Empty<int>();       // je Kachel: Index in _rooms, Corridor oder Outside
        private bool[] _footprint = Array.Empty<bool>();

        public BuildingSystem(ContentDb content, int lotWidth, int lotHeight)
        {
            _content = content ?? throw new ArgumentNullException(nameof(content));
            if (lotWidth < 4 || lotHeight < 4) throw new ArgumentException("Grundstueck zu klein");
            LotWidth = lotWidth;
            LotHeight = lotHeight;
            Rebuild();
        }

        public string Name => "Building";
        public int IntervalTicks => 1;
        public int OffsetTicks => 0;

        public int LotWidth { get; private set; }
        public int LotHeight { get; private set; }

        /// <summary>Steigt bei jeder baulichen Aenderung; Wegfindung verwirft damit zwischengespeicherte Wege.</summary>
        public long Version { get; private set; }

        public Edge? Entrance { get; private set; }
        public Tile? SpawnTile { get; private set; }
        public IReadOnlyList<Room> Rooms => _rooms;
        public IReadOnlyCollection<Edge> Doors => _doors;
        public IReadOnlyCollection<TileRect> Footprints => _footprints;

        public void Update(Simulation sim)
        {
            // Bau ist rein befehlsgesteuert; laufende Bauzeiten folgen mit dem Bausystem in Phase 2.
        }

        // ---------- Abfragen ----------

        public bool InLot(Tile t) => t.X >= 0 && t.Y >= 0 && t.X < LotWidth && t.Y < LotHeight;

        public bool IsIndoor(Tile t) => InLot(t) && _footprint[Index(t)];

        public Room? RoomAt(Tile t)
        {
            if (!InLot(t)) return null;
            int a = _area[Index(t)];
            return a >= 0 ? _rooms[a] : null;
        }

        public Room? FindRoom(EntityId id) => _rooms.FirstOrDefault(r => r.Id == id);

        public bool IsWall(Edge e) => _walls.Contains(e);

        public bool IsDoor(Edge e) => _doors.Contains(e);

        /// <summary>Kann man orthogonal von a nach b gehen?</summary>
        public bool CanPass(Tile a, Tile b)
        {
            if (!InLot(a) || !InLot(b)) return false;
            Edge e = Edge.Between(a, b);
            return !_walls.Contains(e) || _doors.Contains(e);
        }

        // ---------- Aenderungen (nur ueber Befehle aufrufen) ----------

        internal CommandResult CheckFootprint(TileRect rect)
        {
            if (rect.X < 1 || rect.Y < 1 || rect.Right > LotWidth - 1 || rect.Bottom > LotHeight - 1)
                return CommandResult.Reject("error.build.outside_lot", "Gebaeude muss mit mindestens einer Kachel Abstand auf dem Grundstueck liegen");
            return CommandResult.Ok();
        }

        internal void AddFootprint(TileRect rect) { _footprints.Add(rect); Changed(); }

        internal CommandResult CheckRoom(string typeId, TileRect rect)
        {
            if (!_content.RoomTypes.TryGetValue(typeId, out RoomTypeDef? def))
                return CommandResult.Reject("error.room.unknown_type", $"Unbekannter Raumtyp '{typeId}'");
            bool fits = (rect.Width >= def.MinWidth && rect.Height >= def.MinHeight) || (rect.Width >= def.MinHeight && rect.Height >= def.MinWidth);
            if (!fits)
                return CommandResult.Reject("error.room.too_small", $"Raum zu klein: mindestens {def.MinWidth} x {def.MinHeight} Kacheln");
            for (int y = rect.Y; y < rect.Bottom; y++)
                for (int x = rect.X; x < rect.Right; x++)
                {
                    var t = new Tile(x, y);
                    if (!IsIndoor(t)) return CommandResult.Reject("error.room.outside_building", $"Raum liegt teilweise ausserhalb des Gebaeudes (Kachel {t})");
                    if (RoomAt(t) != null) return CommandResult.Reject("error.room.overlap", $"Raum ueberschneidet einen anderen Raum (Kachel {t})");
                }
            return CommandResult.Ok();
        }

        internal Room AddRoom(EntityId id, string typeId, TileRect rect)
        {
            var room = new Room(id, typeId, rect);
            _rooms.Add(room);
            Changed();
            return room;
        }

        internal CommandResult CheckRemoveRoom(EntityId id) =>
            FindRoom(id) != null ? CommandResult.Ok() : CommandResult.Reject("error.room.not_found", $"Raum {id} existiert nicht");

        internal void RemoveRoom(EntityId id)
        {
            _rooms.RemoveAll(r => r.Id == id);
            Changed();
        }

        internal CommandResult CheckDoor(Edge e)
        {
            if (!InLot(e.A) || !InLot(e.B)) return CommandResult.Reject("error.door.outside_lot", "Tuer liegt ausserhalb des Grundstuecks");
            if (!_walls.Contains(e)) return CommandResult.Reject("error.door.no_wall", $"An Kante {e} steht keine Wand");
            if (_doors.Contains(e)) return CommandResult.Reject("error.door.exists", $"An Kante {e} ist bereits eine Tuer");
            return CommandResult.Ok();
        }

        internal void AddDoor(Edge e) { _doors.Add(e); Changed(); }

        internal CommandResult CheckEntrance(Edge e, Tile spawn)
        {
            CommandResult door = CheckDoor(e);
            if (!door.Accepted && !_doors.Contains(e)) return door;
            if (IsIndoor(e.A) == IsIndoor(e.B)) return CommandResult.Reject("error.entrance.not_outer_wall", "Eingang muss in einer Aussenwand liegen");
            if (!InLot(spawn) || IsIndoor(spawn)) return CommandResult.Reject("error.entrance.bad_spawn", "Ankunftspunkt muss draussen auf dem Grundstueck liegen");
            return CommandResult.Ok();
        }

        internal void SetEntrance(Edge e, Tile spawn)
        {
            _doors.Add(e);
            Entrance = e;
            SpawnTile = spawn;
            Changed();
        }

        /// <summary>Prueft, ob jeder Raum eine Tuer hat und vom Ankunftspunkt aus erreichbar ist (BAU-05).</summary>
        public IReadOnlyList<LayoutIssue> ValidateLayout()
        {
            var issues = new List<LayoutIssue>();
            HashSet<int> reachable = SpawnTile.HasValue ? ReachableTiles(SpawnTile.Value) : new HashSet<int>();
            foreach (Room room in _rooms)
            {
                bool hasDoor = _doors.Any(d => room.Rect.Contains(d.A) != room.Rect.Contains(d.B));
                if (!hasDoor)
                {
                    issues.Add(new LayoutIssue(room.Id, "warning.room.no_door", $"{room.TypeId} hat keine Tuer"));
                    continue;
                }
                if (!reachable.Contains(Index(new Tile(room.Rect.X, room.Rect.Y))))
                {
                    issues.Add(new LayoutIssue(room.Id, "warning.room.unreachable", $"{room.TypeId} ist vom Eingang aus nicht erreichbar"));
                }
            }
            if (!SpawnTile.HasValue)
            {
                issues.Add(new LayoutIssue(EntityId.None, "warning.building.no_entrance", "Die Klinik hat keinen Eingang"));
            }
            return issues;
        }

        private HashSet<int> ReachableTiles(Tile start)
        {
            var seen = new HashSet<int> { Index(start) };
            var queue = new Queue<Tile>();
            queue.Enqueue(start);
            while (queue.Count > 0)
            {
                Tile t = queue.Dequeue();
                foreach (Tile n in new[] { t.Offset(1, 0), t.Offset(-1, 0), t.Offset(0, 1), t.Offset(0, -1) })
                {
                    if (CanPass(t, n) && seen.Add(Index(n))) queue.Enqueue(n);
                }
            }
            return seen;
        }

        // ---------- Ableitung ----------

        private void Changed()
        {
            Version++;
            Rebuild();
        }

        private void Rebuild()
        {
            int n = LotWidth * LotHeight;
            _area = new int[n];
            _footprint = new bool[n];
            for (int i = 0; i < n; i++) _area[i] = Outside;

            foreach (TileRect f in _footprints)
                for (int y = f.Y; y < f.Bottom; y++)
                    for (int x = f.X; x < f.Right; x++)
                    {
                        _footprint[y * LotWidth + x] = true;
                        _area[y * LotWidth + x] = Corridor;
                    }

            for (int r = 0; r < _rooms.Count; r++)
            {
                TileRect rect = _rooms[r].Rect;
                for (int y = rect.Y; y < rect.Bottom; y++)
                    for (int x = rect.X; x < rect.Right; x++)
                        _area[y * LotWidth + x] = r;
            }

            _walls.Clear();
            for (int y = 0; y < LotHeight; y++)
                for (int x = 0; x < LotWidth; x++)
                {
                    int here = _area[y * LotWidth + x];
                    if (y > 0 && here != _area[(y - 1) * LotWidth + x]) _walls.Add(new Edge(x, y, EdgeSide.North));
                    if (x > 0 && here != _area[y * LotWidth + x - 1]) _walls.Add(new Edge(x, y, EdgeSide.West));
                }

            // Tueren ohne Wand (z. B. nach Abriss eines Raums) entfallen.
            _doors.RemoveWhere(d => !_walls.Contains(d));
            if (Entrance.HasValue && !_doors.Contains(Entrance.Value))
            {
                Entrance = null;
                SpawnTile = null;
            }
        }

        private int Index(Tile t) => t.Y * LotWidth + t.X;

        // ---------- Speichern ----------

        public JsonValue SaveState()
        {
            JsonValue footprints = JsonValue.NewArray();
            foreach (TileRect f in _footprints) footprints.Add(f.ToJson());
            JsonValue rooms = JsonValue.NewArray();
            foreach (Room r in _rooms)
                rooms.Add(JsonValue.NewObject().Set("id", checked((long)r.Id.Value)).Set("type", r.TypeId).Set("rect", r.Rect.ToJson()));
            JsonValue doors = JsonValue.NewArray();
            foreach (Edge d in _doors) doors.Add(d.ToJson());

            JsonValue state = JsonValue.NewObject()
                .Set("lotWidth", LotWidth).Set("lotHeight", LotHeight).Set("version", Version)
                .Set("footprints", footprints).Set("rooms", rooms).Set("doors", doors);
            state.Set("entrance", Entrance.HasValue ? Entrance.Value.ToJson() : JsonValue.Null);
            state.Set("spawn", SpawnTile.HasValue ? JsonValue.NewObject().Set("x", SpawnTile.Value.X).Set("y", SpawnTile.Value.Y) : JsonValue.Null);
            return state;
        }

        public void LoadState(JsonValue state)
        {
            LotWidth = checked((int)state.GetInt("lotWidth"));
            LotHeight = checked((int)state.GetInt("lotHeight"));
            _footprints.Clear();
            _rooms.Clear();
            _doors.Clear();
            foreach (JsonValue f in state.Get("footprints").Items) _footprints.Add(TileRect.FromJson(f));
            foreach (JsonValue r in state.Get("rooms").Items)
                _rooms.Add(new Room(new EntityId((ulong)r.GetInt("id")), r.GetString("type"), TileRect.FromJson(r.Get("rect"))));
            foreach (JsonValue d in state.Get("doors").Items) _doors.Add(Edge.FromJson(d));
            JsonValue entrance = state.Get("entrance");
            JsonValue spawn = state.Get("spawn");
            Entrance = entrance.Kind == JsonKind.Null ? (Edge?)null : Edge.FromJson(entrance);
            SpawnTile = spawn.Kind == JsonKind.Null ? (Tile?)null : new Tile(checked((int)spawn.GetInt("x")), checked((int)spawn.GetInt("y")));
            Rebuild();
            Version = state.GetInt("version");
        }
    }
}
