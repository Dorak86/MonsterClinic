using System;
using System.Collections.Generic;
using System.Linq;
using MonsterClinic.Sim.Data;
using MonsterClinic.Sim.Kernel;
using MonsterClinic.Sim.World;

namespace MonsterClinic.Sim.Clinic
{
    public enum StaffTask
    {
        Idle,
        Registering,
        Examining,
        Treating,
        Cleaning,
    }

    /// <summary>
    /// Mitarbeiter (Planung 4.2, reduziert auf den Spielkreislauf). ZWISCHENSTAND (Regel 6): Motivation, Muedigkeit,
    /// Pausen, Gehaltsforderung und Persoenlichkeit folgen in Phase 5; Einstellen und Entlassen ebenso.
    /// </summary>
    public sealed class StaffMember
    {
        public StaffMember(EntityId id, string profession, string specialization, int qualification, string roomTypeId, Tile station)
        {
            if (qualification < 1 || qualification > 5) throw new ArgumentOutOfRangeException(nameof(qualification));
            Id = id;
            Profession = profession;
            Specialization = specialization;
            Qualification = qualification;
            RoomTypeId = roomTypeId;
            Station = station;
        }

        public EntityId Id { get; }
        public string Profession { get; }
        public string Specialization { get; }
        public int Qualification { get; }

        /// <summary>Raumtyp, in dem die Person arbeitet (feste Zuordnung im Spielkreislauf).</summary>
        public string RoomTypeId { get; }
        public Tile Station { get; }
        public StaffTask Task { get; internal set; }
        public EntityId BusyWith { get; internal set; }
        public EntityId TaskRoom { get; internal set; }

        public bool IsFree => Task == StaffTask.Idle;
        public bool IsDoctor => Profession == "monster_doctor";

        /// <summary>Darf diese Person eine Untersuchung oder Behandlung mit der genannten Spezialisierung durchfuehren?</summary>
        public bool CanPerform(string requiredSpecialization) =>
            IsDoctor && (requiredSpecialization == "none" || requiredSpecialization == Specialization);
    }

    /// <summary>Personal und Reinigungsarbeit (K3). Aerzte und Verwaltung werden vom Patientensystem eingeteilt.</summary>
    public sealed class StaffSystem : ISimSystem
    {
        private readonly SortedDictionary<ulong, StaffMember> _staff = new SortedDictionary<ulong, StaffMember>();
        private readonly LoopBalancing _b;

        public StaffSystem(LoopBalancing balancing) => _b = balancing ?? throw new ArgumentNullException(nameof(balancing));

        public string Name => "Staff";
        public int IntervalTicks => TimeConfig.TicksPerGameMinute;
        public int OffsetTicks => 1;

        public IEnumerable<StaffMember> Members => _staff.Values;

        public StaffMember Get(EntityId id) => _staff[id.Value];

        public StaffMember Hire(Simulation sim, string profession, string specialization, int qualification, string roomTypeId)
        {
            Room room = sim.GetSystem<BuildingSystem>().Rooms.FirstOrDefault(r => r.TypeId == roomTypeId)
                ?? throw new InvalidOperationException($"Kein Raum vom Typ {roomTypeId} fuer {profession}");
            var member = new StaffMember(sim.Ids.Next(), profession, specialization, qualification, roomTypeId, Places.Center(room));
            _staff[member.Id.Value] = member;
            sim.GetSystem<MovementSystem>().Spawn(member.Id, member.Station, _b.StaffWalkSpeed);
            return member;
        }

        public StaffMember? FreeIn(string roomTypeId, Func<StaffMember, bool> condition) =>
            _staff.Values.FirstOrDefault(s => s.IsFree && s.RoomTypeId == roomTypeId && condition(s));

        internal void Assign(StaffMember s, StaffTask task, EntityId patient)
        {
            s.Task = task;
            s.BusyWith = patient;
        }

        internal void Release(StaffMember s)
        {
            s.Task = StaffTask.Idle;
            s.BusyWith = EntityId.None;
            s.TaskRoom = EntityId.None;
        }

        public void Update(Simulation sim)
        {
            HygieneSystem hygiene = sim.GetSystem<HygieneSystem>();
            MovementSystem move = sim.GetSystem<MovementSystem>();
            BuildingSystem building = sim.GetSystem<BuildingSystem>();
            foreach (StaffMember s in _staff.Values.Where(x => x.Profession == "cleaner"))
            {
                Walker w = move.Get(s.Id);
                if (s.Task == StaffTask.Idle)
                {
                    Room? target = hygiene.DirtiestRoom(building, _b.CleanThreshold);
                    if (target != null && move.SetGoal(sim, s.Id, Places.Center(target)))
                    {
                        s.Task = StaffTask.Cleaning;
                        s.TaskRoom = target.Id;
                    }
                }
                else if (s.Task == StaffTask.Cleaning && !w.IsMoving)
                {
                    Room? room = building.FindRoom(s.TaskRoom);
                    if (room == null || !room.Rect.Contains(w.Tile))
                    {
                        Release(s);
                        continue;
                    }
                    if (hygiene.Clean(room.Id, _b.CleanPerMinute) == 0) Release(s);
                }
            }
        }

        public JsonValue SaveState()
        {
            JsonValue arr = JsonValue.NewArray();
            foreach (StaffMember s in _staff.Values)
            {
                arr.Add(JsonValue.NewObject()
                    .Set("id", (long)s.Id.Value).Set("profession", s.Profession).Set("specialization", s.Specialization)
                    .Set("qualification", s.Qualification).Set("room", s.RoomTypeId)
                    .Set("sx", s.Station.X).Set("sy", s.Station.Y)
                    .Set("task", (long)s.Task).Set("busyWith", (long)s.BusyWith.Value).Set("taskRoom", (long)s.TaskRoom.Value));
            }
            return JsonValue.NewObject().Set("staff", arr);
        }

        public void LoadState(JsonValue state)
        {
            _staff.Clear();
            foreach (JsonValue o in state.Get("staff").Items)
            {
                var s = new StaffMember(new EntityId((ulong)o.GetInt("id")), o.GetString("profession"), o.GetString("specialization"),
                    (int)o.GetInt("qualification"), o.GetString("room"), new Tile((int)o.GetInt("sx"), (int)o.GetInt("sy")))
                {
                    Task = (StaffTask)o.GetInt("task"),
                    BusyWith = new EntityId((ulong)o.GetInt("busyWith")),
                    TaskRoom = new EntityId((ulong)o.GetInt("taskRoom")),
                };
                _staff[s.Id.Value] = s;
            }
        }
    }

    /// <summary>
    /// Sauberkeit je Raum (RAUM-07, Ruf-Faktor nach A-09). Schmutz 0 (sauber) bis 1000.
    /// </summary>
    public sealed class HygieneSystem : ISimSystem
    {
        public const int MaxDirt = 1000;
        private readonly SortedDictionary<ulong, int> _dirt = new SortedDictionary<ulong, int>();

        public string Name => "Hygiene";
        public int IntervalTicks => TimeConfig.TicksPerGameHour;
        public int OffsetTicks => 0;

        public int DirtOf(EntityId room) => _dirt.TryGetValue(room.Value, out int d) ? d : 0;

        public void AddDirt(EntityId room, int amount)
        {
            if (room.IsNone) return;
            _dirt[room.Value] = Math.Min(MaxDirt, DirtOf(room) + amount);
        }

        /// <summary>Reinigt und gibt die tatsaechlich entfernte Menge zurueck.</summary>
        public int Clean(EntityId room, int amount)
        {
            int before = DirtOf(room);
            int after = Math.Max(0, before - amount);
            _dirt[room.Value] = after;
            return before - after;
        }

        public Room? DirtiestRoom(BuildingSystem building, int threshold) =>
            building.Rooms.Where(r => DirtOf(r.Id) >= threshold).OrderByDescending(r => DirtOf(r.Id)).ThenBy(r => r.Id.Value).FirstOrDefault();

        /// <summary>Sauberkeit der Klinik 0 bis 1000 (Durchschnitt aller Raeume).</summary>
        public int Cleanliness(BuildingSystem building) =>
            building.Rooms.Count == 0 ? MaxDirt : MaxDirt - (int)building.Rooms.Average(r => (double)DirtOf(r.Id));

        public void Update(Simulation sim)
        {
        }

        public JsonValue SaveState()
        {
            JsonValue arr = JsonValue.NewArray();
            foreach (KeyValuePair<ulong, int> d in _dirt) arr.Add(JsonValue.NewObject().Set("room", (long)d.Key).Set("dirt", d.Value));
            return JsonValue.NewObject().Set("rooms", arr);
        }

        public void LoadState(JsonValue state)
        {
            _dirt.Clear();
            foreach (JsonValue o in state.Get("rooms").Items) _dirt[(ulong)o.GetInt("room")] = (int)o.GetInt("dirt");
        }
    }

    /// <summary>Feste Stellen in Raeumen, an die Figuren gehen.</summary>
    public static class Places
    {
        public static Tile Center(Room r) => new Tile(r.Rect.X + r.Rect.Width / 2, r.Rect.Y + r.Rect.Height / 2);

        /// <summary>Zufaellige Kachel im Inneren eines Raums (Rand frei), z. B. ein Platz im Wartezimmer.</summary>
        public static Tile RandomInside(Room r, SimRandom rng)
        {
            int x0 = r.Rect.X + (r.Rect.Width > 2 ? 1 : 0), x1 = r.Rect.Right - 1 - (r.Rect.Width > 2 ? 1 : 0);
            int y0 = r.Rect.Y + (r.Rect.Height > 2 ? 1 : 0), y1 = r.Rect.Bottom - 1 - (r.Rect.Height > 2 ? 1 : 0);
            return new Tile((int)rng.Range(x0, x1), (int)rng.Range(y0, y1));
        }
    }
}
