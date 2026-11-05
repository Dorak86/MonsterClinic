using System.Collections.Generic;
using MonsterClinic.Sim.Data;
using MonsterClinic.Sim.Kernel;

namespace MonsterClinic.Sim.World
{
    /// <summary>Gemeinsame Basis: fuehrt die Aenderung aus und meldet <see cref="BuildingChanged"/>.</summary>
    public abstract class BuildingCommand : ICommand
    {
        public abstract string Describe();
        public CommandResult Validate(Simulation sim) => Check(sim.GetSystem<BuildingSystem>(), sim);

        public void Execute(Simulation sim)
        {
            BuildingSystem b = sim.GetSystem<BuildingSystem>();
            Apply(b, sim);
            sim.Events.Publish(new BuildingChanged(sim.Tick, b.Version));
        }

        protected abstract CommandResult Check(BuildingSystem b, Simulation sim);
        protected abstract void Apply(BuildingSystem b, Simulation sim);
    }

    /// <summary>Legt eine Gebaeudeflaeche an; Aussenwaende entstehen automatisch (BAU-08).</summary>
    public sealed class BuildFootprintCommand : BuildingCommand
    {
        public BuildFootprintCommand(TileRect rect) => Rect = rect;
        public TileRect Rect { get; }
        public override string Describe() => $"BuildFootprint {Rect}";
        protected override CommandResult Check(BuildingSystem b, Simulation sim) => b.CheckFootprint(Rect);
        protected override void Apply(BuildingSystem b, Simulation sim) => b.AddFootprint(Rect);
    }

    /// <summary>Legt einen Raum an; Waende zum Flur und zu Nachbarraeumen entstehen automatisch (BAU-03, BAU-06).</summary>
    public sealed class CreateRoomCommand : BuildingCommand
    {
        public CreateRoomCommand(string typeId, TileRect rect)
        {
            TypeId = typeId;
            Rect = rect;
        }

        public string TypeId { get; }
        public TileRect Rect { get; }

        /// <summary>ID des angelegten Raums nach erfolgreicher Ausfuehrung.</summary>
        public EntityId CreatedId { get; private set; }

        public override string Describe() => $"CreateRoom {TypeId} {Rect}";
        protected override CommandResult Check(BuildingSystem b, Simulation sim) => b.CheckRoom(TypeId, Rect);
        protected override void Apply(BuildingSystem b, Simulation sim) => CreatedId = b.AddRoom(sim.Ids.Next(), TypeId, Rect).Id;
    }

    /// <summary>Reisst einen Raum ab; seine Waende und Tueren verschwinden (BAU-09).</summary>
    public sealed class RemoveRoomCommand : BuildingCommand
    {
        public RemoveRoomCommand(EntityId roomId) => RoomId = roomId;
        public EntityId RoomId { get; }
        public override string Describe() => $"RemoveRoom {RoomId}";
        protected override CommandResult Check(BuildingSystem b, Simulation sim) => b.CheckRemoveRoom(RoomId);
        protected override void Apply(BuildingSystem b, Simulation sim) => b.RemoveRoom(RoomId);
    }

    /// <summary>Setzt eine Tuer in eine vorhandene Wand (BAU-04).</summary>
    public sealed class PlaceDoorCommand : BuildingCommand
    {
        public PlaceDoorCommand(Edge edge) => Edge = edge;
        public Edge Edge { get; }
        public override string Describe() => $"PlaceDoor {Edge}";
        protected override CommandResult Check(BuildingSystem b, Simulation sim) => b.CheckDoor(Edge);
        protected override void Apply(BuildingSystem b, Simulation sim) => b.AddDoor(Edge);
    }

    /// <summary>Legt den Haupteingang in einer Aussenwand und den Ankunftspunkt der Patienten fest.</summary>
    public sealed class SetEntranceCommand : BuildingCommand
    {
        public SetEntranceCommand(Edge edge, Tile spawn)
        {
            Edge = edge;
            Spawn = spawn;
        }

        public Edge Edge { get; }
        public Tile Spawn { get; }
        public override string Describe() => $"SetEntrance {Edge} spawn {Spawn}";
        protected override CommandResult Check(BuildingSystem b, Simulation sim) => b.CheckEntrance(Edge, Spawn);
        protected override void Apply(BuildingSystem b, Simulation sim) => b.SetEntrance(Edge, Spawn);
    }

    /// <summary>
    /// Fester Grundriss aus Content/clinics (Meilenstein K2). Wird als Folge normaler Baubefehle ausgefuehrt,
    /// damit fuer die feste Testklinik dieselben Pruefungen gelten wie spaeter beim Bauen durch den Spieler.
    /// ZWISCHENSTAND (Regel 6): Im Spielkreislauf ist das Gebaeude vorgegeben; freies Bauen folgt in Phase 2.
    /// </summary>
    public static class ClinicLayout
    {
        public static int LotWidth(ClinicLayoutDef def) => checked((int)def.Raw.Get("lot").GetInt("w"));
        public static int LotHeight(ClinicLayoutDef def) => checked((int)def.Raw.Get("lot").GetInt("h"));

        public static IReadOnlyList<ICommand> ToCommands(ClinicLayoutDef def)
        {
            JsonValue raw = def.Raw;
            var commands = new List<ICommand>();
            foreach (JsonValue f in raw.Get("footprints").Items) commands.Add(new BuildFootprintCommand(TileRect.FromJson(f)));
            foreach (JsonValue r in raw.Get("rooms").Items) commands.Add(new CreateRoomCommand(r.GetString("type"), TileRect.FromJson(r)));
            foreach (JsonValue d in raw.Get("doors").Items) commands.Add(new PlaceDoorCommand(Edge.FromJson(d)));
            JsonValue entrance = raw.Get("entrance");
            JsonValue spawn = raw.Get("spawn");
            commands.Add(new SetEntranceCommand(Edge.FromJson(entrance), new Tile(checked((int)spawn.GetInt("x")), checked((int)spawn.GetInt("y")))));
            return commands;
        }
    }
}
