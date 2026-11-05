using System;
using System.Collections.Generic;
using System.Linq;
using MonsterClinic.Sim.Data;
using MonsterClinic.Sim.Kernel;
using MonsterClinic.Sim.World;

namespace MonsterClinic.Sim.Clinic
{
    /// <summary>
    /// Baut die Simulation des Meilensteins Spielkreislauf auf: feste Klinik aus Content/clinics mit festem Personal (Planung 6.2).
    /// Die Reihenfolge der Systeme ist Teil des deterministischen Ablaufs und darf nur bewusst geaendert werden.
    /// </summary>
    public static class ClinicSetup
    {
        public static TimeConfig Time(ContentDb content)
        {
            JsonValue t = content.Balancing("time");
            return new TimeConfig((int)t.GetInt("startMinuteOfDay"), (int)t.GetInt("dayStartMinute"), (int)t.GetInt("nightStartMinute"));
        }

        public static ISimSystem[] Systems(ContentDb content, ClinicLayoutDef clinic)
        {
            var balancing = new LoopBalancing(content.Balancing("clinic_loop"));
            return new ISimSystem[]
            {
                new BuildingSystem(content, ClinicLayout.LotWidth(clinic), ClinicLayout.LotHeight(clinic)),
                new MovementSystem(),
                new HygieneSystem(),
                new StaffSystem(balancing),
                new PatientSystem(content, balancing),
                new EconomySystem(balancing),
            };
        }

        /// <summary>Neue Simulation mit fertig gebauter Klinik und eingestelltem Personal.</summary>
        public static Simulation NewGame(ContentDb content, string clinicId, ulong seed, bool hireStaff = true)
        {
            ClinicLayoutDef clinic = content.Clinics[clinicId];
            var sim = new Simulation(Time(content), seed, Systems(content, clinic));
            foreach (ICommand c in ClinicLayout.ToCommands(clinic)) sim.Enqueue(c);
            sim.ProcessPendingCommands();
            List<CommandLogEntry> rejected = sim.CommandLog.Where(e => !e.Accepted).ToList();
            if (rejected.Count > 0)
            {
                throw new InvalidOperationException($"Grundriss {clinicId} ist ungueltig: {string.Join("; ", rejected)}");
            }

            StaffSystem staff = sim.GetSystem<StaffSystem>();
            if (hireStaff && clinic.Raw.TryGet("staff", out JsonValue list))
            {
                foreach (JsonValue s in list.Items)
                {
                    string spec = s.TryGet("specialization", out JsonValue sp) ? sp.AsString() : "none";
                    staff.Hire(sim, s.GetString("profession"), spec, (int)s.GetInt("qualification"), s.GetString("room"));
                }
            }
            return sim;
        }

        /// <summary>Laedt einen gespeicherten Spielstand dieser Klinik.</summary>
        public static Simulation Load(ContentDb content, string clinicId, JsonValue state) =>
            Simulation.LoadState(state, Time(content), Systems(content, content.Clinics[clinicId]));
    }
}
