using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using MonsterClinic.Platform;
using MonsterClinic.Sim.Clinic;
using MonsterClinic.Sim.Data;
using MonsterClinic.Sim.Kernel;

namespace MonsterClinic.SimCli
{
    /// <summary>
    /// simcli run [--days 30] [--seed 1] [--clinic clinic.test_clinic]
    /// Laesst den Spielkreislauf ohne Grafik laufen und gibt einen Tagesbericht aus (Meilenstein K3).
    /// </summary>
    internal static class ClinicRun
    {
        public static int Run(string[] args)
        {
            int days = int.Parse(Option(args, "--days") ?? "30");
            ulong seed = ulong.Parse(Option(args, "--seed") ?? "1");
            string clinicId = Option(args, "--clinic") ?? "clinic.test_clinic";
            ContentDb content = ContentLoader.Load(ContentLoader.FindContentRoot(Directory.GetCurrentDirectory()));
            Simulation sim = ClinicSetup.NewGame(content, clinicId, seed);

            var byDisease = new Dictionary<string, (int Arrived, int Cured, int Other)>(StringComparer.Ordinal);
            var diseaseOf = new Dictionary<ulong, string>();
            Console.WriteLine($"THE MONSTER CLINIC - Spielkreislauf, {days} Spieltage, Startwert {seed}");
            Console.WriteLine();
            Console.WriteLine(" Tag  Ankunft Geheilt Abbruch Tot Pink  Diagn. falsch Kompl.  Wartezeit  Einnahmen Ausgaben   Konto   Ruf Sauber");
            for (int d = 0; d < days; d++)
            {
                sim.Run(TimeConfig.TicksPerGameDay);
                foreach (IDomainEvent e in sim.Events.Drain())
                {
                    switch (e)
                    {
                        case PatientArrived a:
                            diseaseOf[a.Patient.Value] = a.Disease;
                            Count(byDisease, a.Disease, arrived: 1);
                            break;
                        case PatientLeft l when diseaseOf.ContainsKey(l.Patient.Value):
                            Count(byDisease, diseaseOf[l.Patient.Value], cured: l.Outcome == PatientOutcome.Cured ? 1 : 0, other: l.Outcome == PatientOutcome.Cured ? 0 : 1);
                            break;
                        case DayClosed c:
                            DayStats s = c.Stats;
                            string wait = s.WaitCount == 0 ? "-" : $"{s.WaitMinutesSum / s.WaitCount} min";
                            Console.WriteLine($"{s.Day,4} {s.Arrivals,8} {s.Cured,7} {s.Abandoned,7} {s.Died,3} {s.PermanentlyUncured,4} {s.Diagnoses,7} {s.WrongDiagnoses,6} {s.Complications,6} {wait,10} {s.Income,10} {s.Expenses,8} {s.BalanceAtEnd,7} {s.Reputation / 10,4} {s.Cleanliness / 10,5}%");
                            break;
                    }
                }
            }

            EconomySystem economy = sim.GetSystem<EconomySystem>();
            IReadOnlyList<DayStats> h = economy.History;
            Console.WriteLine();
            Console.WriteLine($"Summe: {h.Sum(x => x.Arrivals)} Patienten, {h.Sum(x => x.Cured)} geheilt, {h.Sum(x => x.Abandoned)} abgebrochen, {h.Sum(x => x.Died)} gestorben, {h.Sum(x => x.PermanentlyUncured)} dauerhaft pink");
            int diag = h.Sum(x => x.Diagnoses);
            Console.WriteLine($"Diagnosen: {diag}, davon falsch: {h.Sum(x => x.WrongDiagnoses)} ({(diag == 0 ? 0 : 100 * h.Sum(x => x.WrongDiagnoses) / diag)} %), misslungene Behandlungen: {h.Sum(x => x.FailedTreatments)}");
            Console.WriteLine($"Kontostand: {economy.Balance} Infernalien (Start {new LoopBalancing(content.Balancing("clinic_loop")).StartMoney}), Ruf: {economy.Reputation / 10} von 100");
            foreach (IGrouping<string, Transaction> g in economy.Ledger.GroupBy(t => t.Category).OrderBy(g => g.Key, StringComparer.Ordinal))
            {
                Console.WriteLine($"  {g.Key,-22} {g.Sum(t => t.Amount),10} Infernalien");
            }
            Console.WriteLine($"Noch in der Klinik: {sim.GetSystem<PatientSystem>().Patients.Count()}");
            Console.WriteLine();
            Console.WriteLine("Je Krankheit (angekommen / geheilt / anders gegangen):");
            foreach (KeyValuePair<string, (int Arrived, int Cured, int Other)> kv in byDisease.OrderBy(k => k.Key, StringComparer.Ordinal))
            {
                Console.WriteLine($"  {kv.Key,-32} {kv.Value.Arrived,5} {kv.Value.Cured,5} {kv.Value.Other,5}");
            }
            Console.WriteLine();
            Console.WriteLine($"Pruefsumme des Endzustands: {sim.Checksum()}");
            return 0;
        }

        private static void Count(Dictionary<string, (int, int, int)> map, string disease, int arrived = 0, int cured = 0, int other = 0)
        {
            map.TryGetValue(disease, out (int A, int C, int O) v);
            map[disease] = (v.A + arrived, v.C + cured, v.O + other);
        }

        private static string? Option(string[] args, string name)
        {
            int i = Array.IndexOf(args, name);
            return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
        }
    }
}
