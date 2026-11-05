using System;
using System.Collections.Generic;
using System.Linq;
using MonsterClinic.Sim.Clinic;
using MonsterClinic.Sim.Data;
using MonsterClinic.Sim.Kernel;
using MonsterClinic.Sim.World;

namespace MonsterClinic.Sim.Tests
{
    public sealed class ClinicLoopTests
    {
        private const string Clinic = "clinic.test_clinic";
        private static ContentDb Content => TestWorld.Content;

        private static Simulation Quiet(ulong seed)
        {
            Simulation sim = ClinicSetup.NewGame(Content, Clinic, seed);
            sim.GetSystem<PatientSystem>().ArrivalsEnabled = false;
            return sim;
        }

        /// <summary>Laesst die Simulation laufen, bis der Patient die Klinik verlassen hat; sammelt die Zustaende.</summary>
        private static (List<PatientState> States, List<IDomainEvent> Events) Follow(Simulation sim, EntityId id, int maxMinutes = 24 * 60)
        {
            var states = new List<PatientState>();
            var events = new List<IDomainEvent>();
            PatientSystem ps = sim.GetSystem<PatientSystem>();
            for (int m = 0; m < maxMinutes && ps.Patients.Any(p => p.Id == id); m++)
            {
                sim.Run(TimeConfig.TicksPerGameMinute);
                events.AddRange(sim.Events.Drain());
                Patient? p = ps.Patients.FirstOrDefault(x => x.Id == id);
                if (p != null && (states.Count == 0 || states[^1] != p.State)) states.Add(p.State);
            }
            return (states, events);
        }

        [Test]
        [Requirement("LOOP-01")]
        [Requirement("Kap. 20")]
        [Requirement("K3")]
        public void PatientDurchlaeuftDieKetteAusKapitel20()
        {
            // Startwert so gewaehlt, dass Diagnose und Behandlung beim ersten Versuch gelingen
            for (ulong seed = 1; seed < 50; seed++)
            {
                Simulation sim = Quiet(seed);
                long before = sim.GetSystem<EconomySystem>().Balance;
                Patient p = sim.GetSystem<PatientSystem>().Admit(sim, "species.zombie", "disease.zombie_rot", isPrivate: false)!;
                int health = p.Health;
                (List<PatientState> states, List<IDomainEvent> events) = Follow(sim, p.Id);
                PatientLeft? left = events.OfType<PatientLeft>().SingleOrDefault();
                if (left == null || left.Outcome != PatientOutcome.Cured || events.OfType<PatientDiagnosed>().Any(d => !d.Correct)) continue;

                // Zustaende werden je Spielminute erfasst; kurze Zwischenzustaende (z. B. Warten bei freiem Personal) koennen dazwischen liegen.
                string[] required =
                {
                    "WalkingToReception", "Registering", "WalkingToWaiting", "CalledToRoom", "InSession",
                    "WalkingToWaiting", "CalledToRoom", "InSession", "WalkingToPay", "Leaving",
                };
                int at = 0;
                foreach (PatientState st in states)
                {
                    if (at < required.Length && st.ToString() == required[at]) at++;
                }
                Assert.Equal(required.Length, at, "Kette Ankunft > Anmeldung > Warten > Untersuchung > Behandlung im OP > Bezahlen > Abgang in dieser Reihenfolge: " + string.Join(" > ", states));
                Assert.True(events.OfType<PatientDiagnosed>().Single().Diagnosis == "disease.zombie_rot", "Diagnose gespeichert");
                Assert.True(left.Paid > 0, "Patient bezahlt");
                Assert.True(sim.GetSystem<EconomySystem>().Balance > before, "Finanzen aktualisiert");
                Assert.True(!sim.GetSystem<MovementSystem>().Contains(p.Id), "Patient aus der Simulation entfernt");
                Assert.True(health > 0, "Gesundheit zu Beginn gesetzt");
                return;
            }
            throw new AssertionException("Kein Startwert mit gelungener Behandlung beim ersten Versuch gefunden");
        }

        [Test]
        [Requirement("K3")]
        [Requirement("MED-03")]
        public void JedeBeschriebeneKrankheitIstHeilbar()
        {
            foreach (DiseaseDef d in Content.Diseases.Values.Where(x => !x.Placeholder))
            {
                bool cured = false;
                for (ulong seed = 1; seed <= 20 && !cured; seed++)
                {
                    Simulation sim = Quiet(seed);
                    Patient p = sim.GetSystem<PatientSystem>().Admit(sim, d.SpeciesId, d.Id)!;
                    cured = Follow(sim, p.Id).Events.OfType<PatientLeft>().Any(l => l.Outcome == PatientOutcome.Cured);
                }
                Assert.True(cured, $"{d.Id} ist heilbar");
            }
        }

        [Test]
        [Requirement("A-11")]
        public void FristLaeuftInDerBehandlungHalbSoSchnell()
        {
            Simulation sim = Quiet(3);
            PatientSystem ps = sim.GetSystem<PatientSystem>();
            Patient p = ps.Admit(sim, "species.zombie", "disease.zombie_rot")!;
            int start = p.DeadlineHalfMinutes;
            sim.Run(10 * TimeConfig.TicksPerGameMinute);
            Assert.Equal(start - 20, p.DeadlineHalfMinutes, "10 Minuten ohne Behandlung = 20 halbe Minuten");

            for (int i = 0; i < 24 * 60 && !(p.State == PatientState.InSession && p.Session == SessionKind.Treatment); i++)
                sim.Run(TimeConfig.TicksPerGameMinute);
            Assert.True(p.State == PatientState.InSession && p.Session == SessionKind.Treatment, "Patient in Behandlung");
            int before = p.DeadlineHalfMinutes;
            sim.Run(4 * TimeConfig.TicksPerGameMinute);
            Assert.Equal(before - 4, p.DeadlineHalfMinutes, "4 Minuten in Behandlung = 4 halbe Minuten");
        }

        [Test]
        [Requirement("A-11")]
        [Requirement("A-14")]
        [Requirement("D-07")]
        public void AbgelaufeneFristenLoesenKomplikationenAus()
        {
            Simulation sim = Quiet(5);
            PatientSystem ps = sim.GetSystem<PatientSystem>();
            var ghosts = Enumerable.Range(0, 8).Select(_ => ps.Admit(sim, "species.ghost", "disease.balloon_bloating")!.Id).ToList();
            var goblins = Enumerable.Range(0, 8).Select(_ => ps.Admit(sim, "species.goblin", "disease.goblin_depression")!.Id).ToList();
            long start = sim.Tick;
            var events = new List<IDomainEvent>();
            for (int d = 0; d < 2; d++)
            {
                sim.Run(TimeConfig.TicksPerGameDay);
                events.AddRange(sim.Events.Drain());
            }

            var died = events.OfType<PatientLeft>().Where(l => l.Outcome == PatientOutcome.Died).Select(l => l.Patient).ToList();
            Assert.True(died.Count > 0 && died.All(ghosts.Contains), "Geister platzen nach Fristablauf und sterben (nur Geister)");
            var pink = events.OfType<PatientLeft>().Where(l => l.Outcome == PatientOutcome.PermanentlyUncured).ToList();
            Assert.True(pink.Count > 0 && pink.All(l => goblins.Contains(l.Patient)), "Goblins werden dauerhaft pink");
            int minMinutes = 180 + 60 - 1; // die erste Minute zaehlt bereits beim Eintreffen
            Assert.True(pink.All(l => (l.Tick - start) / TimeConfig.TicksPerGameMinute >= minMinutes), "dauerhaft pink fruehestens nach Frist + zweiter Frist");
            Assert.True(events.OfType<ComplicationOccurred>().Any(c => c.Complication == "complication.turns_pink" && !c.Permanent), "erst pink, ...");
            Assert.True(events.OfType<ComplicationOccurred>().Any(c => c.Complication == "complication.turns_pink" && c.Permanent), "... dann dauerhaft pink");
        }

        [Test]
        [Requirement("A-12")]
        public void GoblinsKommenInGruppenVonMindestensDrei()
        {
            Simulation sim = ClinicSetup.NewGame(Content, Clinic, 11);
            sim.Run(5 * TimeConfig.TicksPerGameDay);
            var goblinArrivals = sim.Events.Drain().OfType<PatientArrived>().Where(a => a.Species == "species.goblin").GroupBy(a => a.Tick).ToList();
            Assert.True(goblinArrivals.Count > 0, "Goblins kommen an");
            Assert.True(goblinArrivals.All(g => g.Count() >= 3), "jede Goblin-Ankunft ist eine Gruppe ab 3");
        }

        [Test]
        [Requirement("A-09")]
        [Requirement("WIR-01")]
        public void PrivatpatientenZahlen20ProzentMehr()
        {
            long Paid(bool isPrivate)
            {
                Simulation sim = Quiet(7);
                Patient p = sim.GetSystem<PatientSystem>().Admit(sim, "species.vampire", "disease.blood_deficiency", isPrivate)!;
                return Follow(sim, p.Id).Events.OfType<PatientLeft>().Single().Paid;
            }

            long normal = Paid(false), privat = Paid(true);
            Assert.True(normal > 0, "Kassenpatient zahlt");
            Assert.Equal(normal * 120 / 100, privat, "Privatpatient zahlt Kassentarif + 20 %");
        }

        [Test]
        [Requirement("WIR-01")]
        [Requirement("WIR-05")]
        public void BuchhaltungIstNachvollziehbar()
        {
            Simulation sim = ClinicSetup.NewGame(Content, Clinic, 2);
            sim.Run(3 * TimeConfig.TicksPerGameDay);
            var events = sim.Events.Drain();
            EconomySystem eco = sim.GetSystem<EconomySystem>();
            long paid = events.OfType<PatientLeft>().Sum(l => l.Paid);
            Assert.Equal(paid, eco.Ledger.Where(t => t.Category == "income.patient_bill").Sum(t => t.Amount), "jede Zahlung ist eine Buchung mit Patient als Ursache");
            int staff = sim.GetSystem<StaffSystem>().Members.Count();
            Assert.Equal(3 * staff, eco.Ledger.Count(t => t.Category == "expense.salary"), "ein Gehalt je Mitarbeiter und Tag");
            Assert.Equal(3, eco.History.Count, "drei Tagesabschluesse");
            foreach (string cat in new[] { "expense.energy", "expense.rent", "expense.insurance" })
                Assert.Equal(3, eco.Ledger.Count(t => t.Category == cat), $"{cat} einmal je Tag");
            Assert.True(eco.History.All(d => d.Reputation >= 0 && d.Reputation <= 1000), "Ruf im Bereich 0 bis 1000");
            Assert.Equal(eco.History.Last().BalanceAtEnd, eco.Balance, "Kontostand am Tagesende");
        }

        [Test]
        [Requirement("A-04")]
        public void BesserAusgebildeteAerzteSindSchnellerUndIrrenSeltener()
        {
            (int Wrong, int Diagnoses, long ExamMinutes) Run(int qualification)
            {
                Simulation sim = ClinicSetup.NewGame(Content, Clinic, 21, hireStaff: false);
                StaffSystem staff = sim.GetSystem<StaffSystem>();
                staff.Hire(sim, "monster_doctor", "radiologist", qualification, "room.examination_room");
                staff.Hire(sim, "monster_doctor", "surgeon", 3, "room.operating_room");
                staff.Hire(sim, "administrator", "none", 3, "room.reception");
                PatientSystem ps = sim.GetSystem<PatientSystem>();
                ps.ArrivalsEnabled = false;
                int wrong = 0, diag = 0;
                for (int i = 0; i < 40; i++)
                {
                    Patient p = ps.Admit(sim, "species.vampire", "disease.blood_deficiency")!;
                    var ev = Follow(sim, p.Id).Events;
                    diag += ev.OfType<PatientDiagnosed>().Count();
                    wrong += ev.OfType<PatientDiagnosed>().Count(d => !d.Correct);
                }
                var b = new LoopBalancing(Content.Balancing("clinic_loop"));
                return (wrong, diag, b.ScaledMinutes(b.ProcedureMinutes["procedure.temperature_blood_pressure"], qualification));
            }

            var weak = Run(1);
            var strong = Run(5);
            Assert.True(weak.ExamMinutes > strong.ExamMinutes, $"Untersuchung dauert bei Stufe 1 laenger ({weak.ExamMinutes} gegen {strong.ExamMinutes} min)");
            Assert.True(weak.Wrong * strong.Diagnoses > strong.Wrong * weak.Diagnoses, $"Stufe 1 irrt haeufiger ({weak.Wrong}/{weak.Diagnoses} gegen {strong.Wrong}/{strong.Diagnoses})");
        }

        [Test]
        [Requirement("K3")]
        [Requirement("Pflichtenheft 7")]
        public void DreissigTageOhneVerletzteInvarianten()
        {
            Simulation sim = ClinicSetup.NewGame(Content, Clinic, 1);
            var arrived = new HashSet<ulong>();
            var left = new HashSet<ulong>();
            for (int d = 0; d < 30; d++)
            {
                sim.Run(TimeConfig.TicksPerGameDay);
                foreach (IDomainEvent e in sim.Events.Drain())
                {
                    if (e is PatientArrived a) arrived.Add(a.Patient.Value);
                    if (e is PatientLeft l) Assert.True(left.Add(l.Patient.Value), $"Patient {l.Patient} verlaesst die Klinik nur einmal");
                }
                PatientSystem ps = sim.GetSystem<PatientSystem>();
                MovementSystem move = sim.GetSystem<MovementSystem>();
                StaffSystem staff = sim.GetSystem<StaffSystem>();
                Assert.Equal(ps.Patients.Count() + staff.Members.Count(), move.Walkers.Count(), $"Tag {d + 1}: jede Figur gehoert zu einem Patienten oder Mitarbeiter");
                foreach (StaffMember s in staff.Members.Where(s => !s.BusyWith.IsNone))
                    Assert.True(ps.Patients.Any(p => p.Id == s.BusyWith && p.StaffId == s.Id), $"Tag {d + 1}: {s.Id} arbeitet an einem vorhandenen Patienten");
                foreach (Patient p in ps.Patients)
                {
                    Assert.True(p.AgeMinutes < 24 * 60, $"Tag {d + 1}: {p.Id} steckt nicht seit ueber einem Tag fest ({p.State})");
                    Assert.True(p.Patience <= 1000 && p.Satisfaction >= 0 && p.Satisfaction <= 1000, $"Werte von {p.Id} im Bereich");
                }
            }
            int stillInside = sim.GetSystem<PatientSystem>().Patients.Count(p => !p.IsFinished);
            Assert.Equal(arrived.Count, left.Count + stillInside + sim.GetSystem<PatientSystem>().Patients.Count(p => p.IsFinished && !left.Contains(p.Id.Value)),
                "jeder angekommene Patient ist gegangen oder noch in der Klinik");
        }

        [Test]
        [Requirement("T1-03")]
        [Requirement("T1-04")]
        public void SpielkreislaufIstDeterministischUndUeberstehtSpeichernUndLaden()
        {
            Simulation a = ClinicSetup.NewGame(Content, Clinic, 9);
            Simulation b = ClinicSetup.NewGame(Content, Clinic, 9);
            a.Run(2 * TimeConfig.TicksPerGameDay + 1234);
            b.Run(2 * TimeConfig.TicksPerGameDay + 1234);
            Assert.Equal(a.Checksum(), b.Checksum(), "gleicher Startwert, gleicher Verlauf");

            Simulation loaded = ClinicSetup.Load(Content, Clinic, JsonValue.Parse(a.SaveState().ToJson()));
            Assert.Equal(a.Checksum(), loaded.Checksum(), "Pruefsumme direkt nach dem Laden");
            a.Run(TimeConfig.TicksPerGameDay);
            loaded.Run(TimeConfig.TicksPerGameDay);
            Assert.Equal(a.Checksum(), loaded.Checksum(), "gleicher Verlauf nach dem Laden mitten im Betrieb");
        }
    }
}
