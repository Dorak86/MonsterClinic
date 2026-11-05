using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using MonsterClinic.Platform;
using MonsterClinic.Sim.Data;
using MonsterClinic.Sim.Kernel;
using MonsterClinic.Sim.World;

namespace MonsterClinic.Sim.Tests
{
    /// <summary>Hilfen: echte Inhalte laden und die feste Testklinik aufbauen.</summary>
    internal static class TestWorld
    {
        private static ContentDb? _content;

        public static ContentDb Content => _content ??= ContentLoader.Load(ContentLoader.FindContentRoot(AppContext.BaseDirectory));

        public static TimeConfig Time() => new TimeConfig(360, 360, 1200);

        public static Simulation Empty(int w = 32, int h = 24) =>
            new Simulation(Time(), 1, new ISimSystem[] { new BuildingSystem(Content, w, h), new MovementSystem() });

        public static Simulation TestClinic()
        {
            ClinicLayoutDef def = Content.Clinics["clinic.test_clinic"];
            var sim = new Simulation(Time(), 1, new ISimSystem[]
            {
                new BuildingSystem(Content, ClinicLayout.LotWidth(def), ClinicLayout.LotHeight(def)),
                new MovementSystem(),
            });
            foreach (ICommand c in ClinicLayout.ToCommands(def)) sim.Enqueue(c);
            sim.ProcessPendingCommands();
            return sim;
        }

        public static CommandResult Run(Simulation sim, ICommand c)
        {
            CommandResult r = c.Validate(sim);
            sim.Enqueue(c);
            sim.ProcessPendingCommands();
            return r;
        }

        public static Tile Center(Room r) => new Tile(r.Rect.X + r.Rect.Width / 2, r.Rect.Y + r.Rect.Height / 2);
    }

    public sealed class BuildingTests
    {
        [Test]
        [Requirement("K2")]
        [Requirement("BAU-05")]
        public void TestklinikWirdFehlerfreiAufgebaut()
        {
            Simulation sim = TestWorld.TestClinic();
            Assert.True(sim.CommandLog.All(e => e.Accepted), "alle Baubefehle angenommen: " + string.Join("; ", sim.CommandLog.Where(e => !e.Accepted)));
            BuildingSystem b = sim.GetSystem<BuildingSystem>();
            Assert.Equal(5, b.Rooms.Count, "Raeume in der Testklinik");
            Assert.Equal(0, b.ValidateLayout().Count, "Befunde der Raumpruefung: " + string.Join("; ", b.ValidateLayout()));
        }

        [Test]
        [Requirement("BAU-04")]
        public void WaendeEntstehenAnRaumgrenzenUndTuerenOeffnenSie()
        {
            Simulation sim = TestWorld.TestClinic();
            BuildingSystem b = sim.GetSystem<BuildingSystem>();
            Assert.True(b.IsWall(new Edge(4, 6, EdgeSide.West)), "Aussenwand links");
            Assert.True(!b.CanPass(new Tile(3, 6), new Tile(4, 6)), "durch Aussenwand gehen");
            Assert.True(b.CanPass(new Tile(3, 10), new Tile(4, 10)), "durch den Eingang gehen");
            Assert.True(b.IsWall(new Edge(10, 5, EdgeSide.West)), "Wand zwischen Empfang und Wartezimmer");
            Assert.True(!b.IsWall(new Edge(8, 11, EdgeSide.North)), "keine Wand mitten im Flur");
            Assert.True(b.CanPass(new Tile(7, 9), new Tile(7, 10)), "Tuer Empfang zum Flur");
        }

        [Test]
        [Requirement("BAU-06")]
        [Requirement("UI-05")]
        public void UngueltigeBauauftraegeWerdenMitGrundAbgelehnt()
        {
            Simulation sim = TestWorld.TestClinic();
            Assert.Equal("error.room.too_small", TestWorld.Run(sim, new CreateRoomCommand("room.operating_room", new TileRect(20, 12, 3, 3))).ReasonKey, "zu kleiner OP");
            Assert.Equal("error.room.overlap", TestWorld.Run(sim, new CreateRoomCommand("room.staff_room", new TileRect(16, 4, 4, 4))).ReasonKey, "Ueberschneidung");
            Assert.Equal("error.room.outside_building", TestWorld.Run(sim, new CreateRoomCommand("room.staff_room", new TileRect(25, 2, 4, 4))).ReasonKey, "ausserhalb");
            Assert.Equal("error.room.unknown_type", TestWorld.Run(sim, new CreateRoomCommand("room.ballroom", new TileRect(20, 12, 5, 5))).ReasonKey, "unbekannter Typ");
            Assert.Equal("error.door.no_wall", TestWorld.Run(sim, new PlaceDoorCommand(new Edge(8, 11, EdgeSide.North))).ReasonKey, "Tuer ohne Wand");
            Assert.Equal("error.build.outside_lot", TestWorld.Run(sim, new BuildFootprintCommand(new TileRect(0, 0, 5, 5))).ReasonKey, "Gebaeude am Rand");
            Assert.Equal(5, sim.GetSystem<BuildingSystem>().Rooms.Count, "nichts wurde gebaut");
        }

        [Test]
        [Requirement("BAU-03")]
        [Requirement("BAU-09")]
        [Requirement("BAU-05")]
        public void RaumAnlegenUndAbreissen()
        {
            Simulation sim = TestWorld.TestClinic();
            BuildingSystem b = sim.GetSystem<BuildingSystem>();
            var create = new CreateRoomCommand("room.staff_room", new TileRect(22, 4, 5, 6));
            Assert.True(TestWorld.Run(sim, create).Accepted, "Personalraum anlegen");
            Assert.Equal("warning.room.no_door", b.ValidateLayout().Single().ReasonKey, "neuer Raum ohne Tuer wird gemeldet");
            Assert.True(TestWorld.Run(sim, new PlaceDoorCommand(new Edge(24, 10, EdgeSide.North))).Accepted, "Tuer setzen");
            Assert.Equal(0, b.ValidateLayout().Count, "nach Tuer keine Befunde");

            Assert.True(TestWorld.Run(sim, new RemoveRoomCommand(create.CreatedId)).Accepted, "abreissen");
            Assert.True(!b.IsWall(new Edge(24, 10, EdgeSide.North)), "Wand verschwindet mit dem Raum");
            Assert.True(!b.IsDoor(new Edge(24, 10, EdgeSide.North)), "Tuer verschwindet mit der Wand");
            Assert.Equal(5, b.Rooms.Count, "Raumzahl nach Abriss");
        }

        [Test]
        [Requirement("BAU-05")]
        public void AbgeschnittenerRaumWirdGemeldet()
        {
            Simulation sim = TestWorld.TestClinic();
            BuildingSystem b = sim.GetSystem<BuildingSystem>();
            // Zwei Raeume, die nur untereinander eine Tuer haben, aber keine zum Flur
            Assert.True(TestWorld.Run(sim, new CreateRoomCommand("room.staff_room", new TileRect(19, 12, 4, 4))).Accepted, "Personalraum anlegen");
            Assert.True(TestWorld.Run(sim, new CreateRoomCommand("room.toilet", new TileRect(23, 12, 3, 4))).Accepted, "Toilette anlegen");
            Assert.True(TestWorld.Run(sim, new PlaceDoorCommand(new Edge(23, 13, EdgeSide.West))).Accepted, "Tuer zwischen den beiden");
            IReadOnlyList<LayoutIssue> issues = b.ValidateLayout();
            Assert.True(issues.Count == 2 && issues.All(i => i.ReasonKey == "warning.room.unreachable"), "zwei unerreichbare Raeume: " + string.Join("; ", issues));
        }

        [Test]
        [Requirement("T1-04")]
        public void GebaeudeUeberstehtSpeichernUndLaden()
        {
            Simulation sim = TestWorld.TestClinic();
            string path = Path.Combine(Path.GetTempPath(), "mc-tests", Guid.NewGuid().ToString("N") + ".mcsave");
            SaveFile.Write(path, sim.SaveState(), "test");
            ClinicLayoutDef def = TestWorld.Content.Clinics["clinic.test_clinic"];
            Simulation loaded = Simulation.LoadState(SaveFile.Read(path), TestWorld.Time(), new ISimSystem[]
            {
                new BuildingSystem(TestWorld.Content, ClinicLayout.LotWidth(def), ClinicLayout.LotHeight(def)),
                new MovementSystem(),
            });
            Assert.Equal(sim.Checksum(), loaded.Checksum(), "Pruefsumme");
            Assert.True(loaded.GetSystem<BuildingSystem>().CanPass(new Tile(7, 9), new Tile(7, 10)), "Tuer nach dem Laden offen");
        }
    }

    public sealed class NavigationTests
    {
        [Test]
        [Requirement("K2")]
        [Requirement("PAT-06")]
        public void VomEingangIstJederRaumErreichbar()
        {
            Simulation sim = TestWorld.TestClinic();
            BuildingSystem b = sim.GetSystem<BuildingSystem>();
            var finder = new Pathfinder(b);
            foreach (Room room in b.Rooms)
            {
                IReadOnlyList<Tile>? path = finder.FindPath(b.SpawnTile!.Value, TestWorld.Center(room));
                Assert.True(path != null, $"Weg zu {room.TypeId}");
                for (int i = 1; i < path!.Count; i++)
                {
                    Tile a = path[i - 1], c = path[i];
                    Assert.True(finder.CanStep(a, c.X - a.X, c.Y - a.Y), $"gueltiger Schritt {a} -> {c} auf dem Weg zu {room.TypeId}");
                }
            }
        }

        [Test]
        [Requirement("Pflichtenheft 7")]
        public void KeineEckenSchneidenUndNichtSchraegDurchTueren()
        {
            Simulation sim = TestWorld.TestClinic();
            var finder = new Pathfinder(sim.GetSystem<BuildingSystem>());
            Assert.True(!finder.CanStep(new Tile(6, 9), 1, 1), "schraeg durch die Empfangstuer");
            Assert.True(finder.CanStep(new Tile(7, 9), 0, 1), "gerade durch die Empfangstuer");
            Assert.True(!finder.CanStep(new Tile(3, 9), 1, 1), "schraeg um die Hausecke in den Eingang");
        }

        [Test]
        [Requirement("TEC-01")]
        public void WegeSindDeterministischUndWerdenNachUmbauNeuGesucht()
        {
            Simulation a = TestWorld.TestClinic(), c = TestWorld.TestClinic();
            BuildingSystem ba = a.GetSystem<BuildingSystem>();
            var fa = new Pathfinder(ba);
            var fc = new Pathfinder(c.GetSystem<BuildingSystem>());
            Tile goal = TestWorld.Center(ba.Rooms.Single(r => r.TypeId == "room.operating_room"));
            Assert.Equal(string.Join(",", fa.FindPath(ba.SpawnTile!.Value, goal)!), string.Join(",", fc.FindPath(ba.SpawnTile!.Value, goal)!), "gleicher Weg in zwei Simulationen");

            fa.FindPath(ba.SpawnTile!.Value, goal);
            Assert.Equal(1L, fa.Searches, "zweite Anfrage kommt aus dem Zwischenspeicher");
            TestWorld.Run(a, new CreateRoomCommand("room.staff_room", new TileRect(22, 4, 5, 6)));
            fa.FindPath(ba.SpawnTile!.Value, goal);
            Assert.Equal(2L, fa.Searches, "nach Umbau wird neu gesucht");
        }

        [Test]
        [Requirement("K2")]
        [Requirement("PAT-03")]
        public void FigurenLaufenZuAllenRaeumenUndZurueck()
        {
            Simulation sim = TestWorld.TestClinic();
            BuildingSystem b = sim.GetSystem<BuildingSystem>();
            MovementSystem move = sim.GetSystem<MovementSystem>();
            var ids = new List<(EntityId Id, Room Target)>();
            foreach (Room room in b.Rooms)
            {
                EntityId id = sim.Ids.Next();
                move.Spawn(id, b.SpawnTile!.Value, speed: 40);
                Assert.True(move.SetGoal(sim, id, TestWorld.Center(room)), $"Ziel {room.TypeId} gesetzt");
                ids.Add((id, room));
            }

            sim.Run(TimeConfig.TicksPerGameHour);
            var arrived = sim.Events.Drain().OfType<WalkerArrived>().Select(e => e.Walker).ToHashSet();
            foreach ((EntityId id, Room room) in ids)
            {
                Assert.True(arrived.Contains(id), $"Figur erreicht {room.TypeId}");
                Assert.True(room.Rect.Contains(move.Get(id).Tile), $"Figur steht im Raum {room.TypeId}");
                move.SetGoal(sim, id, b.SpawnTile!.Value);
            }
            sim.Run(TimeConfig.TicksPerGameHour);
            Assert.True(move.Walkers.All(w => w.Tile == b.SpawnTile!.Value), "alle wieder am Ankunftspunkt");
        }

        [Test]
        [Requirement("Pflichtenheft 7")]
        public void ZugemauertesZielMeldetSteckenbleiben()
        {
            Simulation sim = TestWorld.TestClinic();
            BuildingSystem b = sim.GetSystem<BuildingSystem>();
            MovementSystem move = sim.GetSystem<MovementSystem>();
            Room op = b.Rooms.Single(r => r.TypeId == "room.operating_room");
            EntityId id = sim.Ids.Next();
            move.Spawn(id, b.SpawnTile!.Value, 40);
            move.SetGoal(sim, id, TestWorld.Center(op));
            sim.Run(5);
            TestWorld.Run(sim, new RemoveRoomCommand(op.Id));
            TestWorld.Run(sim, new CreateRoomCommand("room.operating_room", op.Rect)); // neu gebaut, aber ohne Tuer
            sim.Run(1);
            Assert.True(sim.Events.Drain().OfType<WalkerStuck>().Any(e => e.Walker == id), "Steckenbleiben gemeldet");
            Assert.True(!move.Get(id).IsMoving, "Figur bleibt stehen statt durch Waende zu laufen");
        }

        [Test]
        [Requirement("T1-04")]
        public void LaufendeFigurenUeberstehenSpeichernUndLaden()
        {
            Simulation sim = TestWorld.TestClinic();
            BuildingSystem b = sim.GetSystem<BuildingSystem>();
            MovementSystem move = sim.GetSystem<MovementSystem>();
            EntityId id = sim.Ids.Next();
            move.Spawn(id, b.SpawnTile!.Value, 37);
            move.SetGoal(sim, id, TestWorld.Center(b.Rooms.Single(r => r.TypeId == "room.operating_room")));
            sim.Run(123);

            ClinicLayoutDef def = TestWorld.Content.Clinics["clinic.test_clinic"];
            Simulation loaded = Simulation.LoadState(JsonValue.Parse(sim.SaveState().ToJson()), TestWorld.Time(), new ISimSystem[]
            {
                new BuildingSystem(TestWorld.Content, ClinicLayout.LotWidth(def), ClinicLayout.LotHeight(def)),
                new MovementSystem(),
            });
            sim.Run(500);
            loaded.Run(500);
            Assert.Equal(sim.Checksum(), loaded.Checksum(), "gleicher Verlauf nach dem Laden mitten im Weg");
        }
    }

    public sealed class QueueTests
    {
        [Test]
        [Requirement("A-11")]
        [Requirement("Pflichtenheft 7")]
        public void WarteschlangeNachDringlichkeit()
        {
            var q = new RoomQueue();
            EntityId a = new EntityId(1), b = new EntityId(2), c = new EntityId(3), d = new EntityId(4), e = new EntityId(5);
            q.Enqueue(a, 10); q.Enqueue(b, 20); q.Enqueue(c, 30); q.Enqueue(d, 5); q.Enqueue(e, 5);
            var urgency = new Dictionary<EntityId, (bool, long)>
            {
                [a] = (false, 500), [b] = (false, 100), [c] = (true, 900), [d] = (false, 500), [e] = (false, 500),
            };
            string order = string.Join(",", q.Ordered(id => urgency[id]).Select(id => id.Value));
            Assert.Equal("3,2,4,5,1", order, "Notfall, dann kuerzeste Restfrist, dann Ankunft, dann ID");
            Assert.Equal(3UL, q.DequeueMostUrgent(id => urgency[id])!.Value.Value, "Notfall zuerst");
            Assert.Equal(4, q.Count, "einer weniger in der Schlange");
            Assert.Throws<InvalidOperationException>(() => q.Enqueue(a, 99), "doppelt einreihen");
        }
    }
}
