using System;
using System.IO;
using System.Linq;
using System.Text;
using MonsterClinic.Platform;
using MonsterClinic.Sim.Data;
using MonsterClinic.Sim.Kernel;
using MonsterClinic.Sim.World;

namespace MonsterClinic.SimCli
{
    /// <summary>
    /// simcli map [--clinic clinic.test_clinic]: baut einen festen Grundriss auf und zeichnet ihn als Text.
    /// Waende: | und -, Tueren: :, Eingang: E, Ankunftspunkt: @. Danach die Raumpruefung (BAU-05).
    /// </summary>
    internal static class ClinicMap
    {
        public static int Print(string[] args)
        {
            int i = Array.IndexOf(args, "--clinic");
            string clinicId = i >= 0 && i + 1 < args.Length ? args[i + 1] : "clinic.test_clinic";
            ContentDb content = ContentLoader.Load(ContentLoader.FindContentRoot(Directory.GetCurrentDirectory()));
            if (!content.Clinics.TryGetValue(clinicId, out ClinicLayoutDef? def))
            {
                Console.Error.WriteLine($"Grundriss '{clinicId}' nicht gefunden");
                return 2;
            }

            var building = new BuildingSystem(content, ClinicLayout.LotWidth(def), ClinicLayout.LotHeight(def));
            var sim = new Simulation(new TimeConfig(360, 360, 1200), 1, new ISimSystem[] { building, new MovementSystem() });
            foreach (ICommand c in ClinicLayout.ToCommands(def)) sim.Enqueue(c);
            sim.ProcessPendingCommands();
            foreach (CommandLogEntry e in sim.CommandLog.Where(e => !e.Accepted)) Console.WriteLine($"ABGELEHNT {e}");

            Console.WriteLine(Render(building));
            Console.WriteLine("Raeume:");
            foreach (Room r in building.Rooms) Console.WriteLine($"  {Letter(r.TypeId)}  {r.TypeId,-24} {r.Rect.Width} x {r.Rect.Height} Kacheln");
            var issues = building.ValidateLayout();
            Console.WriteLine(issues.Count == 0 ? "Raumpruefung: keine Befunde" : "Raumpruefung:");
            foreach (LayoutIssue issue in issues) Console.WriteLine($"  {issue}");
            return issues.Count == 0 ? 0 : 1;
        }

        private static string Render(BuildingSystem b)
        {
            var sb = new StringBuilder();
            for (int y = 0; y <= b.LotHeight; y++)
            {
                // Zeile mit Nordkanten
                for (int x = 0; x < b.LotWidth; x++)
                {
                    sb.Append('+');
                    var e = new Edge(x, y, EdgeSide.North);
                    sb.Append(b.IsDoor(e) ? (b.Entrance.Equals(e) ? 'E' : ':') : b.IsWall(e) ? '-' : ' ');
                }
                sb.AppendLine("+");
                if (y == b.LotHeight) break;
                // Zeile mit Kacheln und Westkanten
                for (int x = 0; x <= b.LotWidth; x++)
                {
                    var e = new Edge(x, y, EdgeSide.West);
                    sb.Append(b.IsDoor(e) ? (b.Entrance.Equals(e) ? 'E' : ':') : b.IsWall(e) ? '|' : ' ');
                    if (x == b.LotWidth) break;
                    var t = new Tile(x, y);
                    Room? room = b.RoomAt(t);
                    sb.Append(b.SpawnTile == t ? '@' : room != null ? Letter(room.TypeId) : b.IsIndoor(t) ? '.' : ' ');
                }
                sb.AppendLine();
            }
            return sb.ToString();
        }

        private static char Letter(string typeId) => typeId switch
        {
            "room.reception" => 'R',
            "room.waiting_room" => 'W',
            "room.toilet" => 'T',
            "room.examination_room" => 'U',
            "room.operating_room" => 'O',
            "room.staff_room" => 'P',
            "room.sample_lab" => 'L',
            "room.burn_ward" => 'V',
            "room.research_lab" => 'F',
            _ => '?',
        };
    }
}
