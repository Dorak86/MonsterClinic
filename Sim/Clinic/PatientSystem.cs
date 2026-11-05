using System;
using System.Collections.Generic;
using System.Linq;
using MonsterClinic.Sim.Data;
using MonsterClinic.Sim.Kernel;
using MonsterClinic.Sim.World;

namespace MonsterClinic.Sim.Clinic
{
    public enum PatientState
    {
        WalkingToReception,
        WaitingRegistration,
        Registering,
        WalkingToWaiting,
        WaitingCare,
        CalledToRoom,
        InSession,
        WalkingToPay,
        Leaving,
        Gone,
    }

    public enum SessionKind
    {
        None,
        Registration,
        Exam,
        Treatment,
    }

    /// <summary>Wie ein Patient die Klinik verlassen hat.</summary>
    public enum PatientOutcome
    {
        None,
        Cured,
        Abandoned,
        Died,
        PermanentlyUncured,
    }

    /// <summary>
    /// Patient (Planung 4.1, reduziert auf den Spielkreislauf). Zeitwerte in Spielminuten.
    /// Die Frist wird in halben Minuten gefuehrt, damit sie waehrend der Behandlung genau halb so schnell laeuft (A-11).
    /// </summary>
    public sealed class Patient
    {
        public EntityId Id { get; internal set; }
        public string SpeciesId { get; internal set; } = string.Empty;
        public string DiseaseId { get; internal set; } = string.Empty;
        public bool IsPrivate { get; internal set; }
        public PatientState State { get; internal set; }
        public long ArrivalTick { get; internal set; }
        public long QueueSinceTick { get; internal set; }
        public int AgeMinutes { get; internal set; }
        public int Health { get; internal set; }
        public int Patience { get; internal set; }
        public int Satisfaction { get; internal set; }

        /// <summary>Restfrist in halben Spielminuten.</summary>
        public int DeadlineHalfMinutes { get; internal set; }
        public bool Complicated { get; internal set; }

        /// <summary>Zweite Frist bis zur dauerhaften Komplikation in halben Minuten, -1 = keine (A-14).</summary>
        public int PermanentHalfMinutes { get; internal set; } = -1;
        public bool Emergency { get; internal set; }
        public bool Mess { get; internal set; }
        public int ExamsDone { get; internal set; }
        public int Confidence { get; internal set; }
        public string DiagnosedDiseaseId { get; internal set; } = string.Empty;
        public int WaitingMinutes { get; internal set; }
        public int WaitStreakMinutes { get; internal set; }
        public SessionKind Session { get; internal set; }
        public string SessionAction { get; internal set; } = string.Empty;
        public int SessionMinutesLeft { get; internal set; }
        public EntityId StaffId { get; internal set; }
        public EntityId SessionRoom { get; internal set; }
        public long Bill { get; internal set; }
        public PatientOutcome Outcome { get; internal set; }

        public bool IsWaiting => State == PatientState.WaitingRegistration || State == PatientState.WaitingCare;
        public bool IsDiagnosed => DiagnosedDiseaseId.Length > 0;
        public bool IsFinished => Outcome != PatientOutcome.None;
    }

    public sealed class PatientArrived : IDomainEvent
    {
        public PatientArrived(long tick, EntityId patient, string species, string disease)
        {
            Tick = tick; Patient = patient; Species = species; Disease = disease;
        }

        public long Tick { get; }
        public EntityId Patient { get; }
        public string Species { get; }
        public string Disease { get; }
    }

    public sealed class PatientDiagnosed : IDomainEvent
    {
        public PatientDiagnosed(long tick, EntityId patient, string diagnosis, bool correct)
        {
            Tick = tick; Patient = patient; Diagnosis = diagnosis; Correct = correct;
        }

        public long Tick { get; }
        public EntityId Patient { get; }
        public string Diagnosis { get; }
        public bool Correct { get; }
    }

    public sealed class ComplicationOccurred : IDomainEvent
    {
        public ComplicationOccurred(long tick, EntityId patient, string complication, bool permanent)
        {
            Tick = tick; Patient = patient; Complication = complication; Permanent = permanent;
        }

        public long Tick { get; }
        public EntityId Patient { get; }
        public string Complication { get; }
        public bool Permanent { get; }
    }

    public sealed class PatientLeft : IDomainEvent
    {
        public PatientLeft(long tick, EntityId patient, PatientOutcome outcome, long paid)
        {
            Tick = tick; Patient = patient; Outcome = outcome; Paid = paid;
        }

        public long Tick { get; }
        public EntityId Patient { get; }
        public PatientOutcome Outcome { get; }
        public long Paid { get; }
    }

    /// <summary>
    /// Patientenablauf des Meilensteins Spielkreislauf (Planung 6.2, K3):
    /// Ankunft (Goblins in Gruppen) → Anmeldung → Warten → Untersuchung(en) → automatische Diagnose nach Ausbildung (A-04)
    /// → Behandlung → Bezahlung (Kassentarif, Privat +20 %) → Abgang. Fristen mit Komplikationen (A-11, A-14),
    /// Geduld, Zufriedenheit, Gesundheit, Behandlung nach Dringlichkeit (A-11).
    /// ZWISCHENSTAND (Regel 6): feste Raum-Zuordnung des Personals, keine Belegungsgrenzen je Kachel,
    /// falsche Diagnosen waehlen eine andere beschriebene Krankheit (je Spezies gibt es bisher nur eine).
    /// </summary>
    public sealed class PatientSystem : ISimSystem
    {
        private const string Reception = "room.reception";
        private const string WaitingRoom = "room.waiting_room";
        private const string ExamRoom = "room.examination_room";

        private readonly ContentDb _content;
        private readonly LoopBalancing _b;
        private readonly SortedDictionary<ulong, Patient> _patients = new SortedDictionary<ulong, Patient>();

        public PatientSystem(ContentDb content, LoopBalancing balancing)
        {
            _content = content ?? throw new ArgumentNullException(nameof(content));
            _b = balancing ?? throw new ArgumentNullException(nameof(balancing));
        }

        public string Name => "Patients";
        public int IntervalTicks => TimeConfig.TicksPerGameMinute;
        public int OffsetTicks => 0;

        /// <summary>Neue Ankuenfte; im Test abschaltbar, um einzelne Patienten gezielt zu verfolgen.</summary>
        public bool ArrivalsEnabled { get; set; } = true;

        public IEnumerable<Patient> Patients => _patients.Values;

        public Patient Get(EntityId id) => _patients[id.Value];

        // ---------------- Ablauf je Spielminute ----------------

        public void Update(Simulation sim)
        {
            if (ArrivalsEnabled) RollArrivals(sim);

            var finished = new List<ulong>();
            foreach (Patient p in _patients.Values)
            {
                HandleMovement(sim, p);
                if (p.State != PatientState.Gone) Tick(sim, p);
                if (p.State == PatientState.Gone) finished.Add(p.Id.Value);
            }
            foreach (ulong id in finished) _patients.Remove(id);

            DispatchRegistration(sim);
            DispatchCare(sim, ExamRoom);
            foreach (string room in _b.TreatmentRooms.Values.Distinct().Where(r => r != ExamRoom).OrderBy(r => r, StringComparer.Ordinal))
            {
                DispatchCare(sim, room);
            }
        }

        private void RollArrivals(Simulation sim)
        {
            SimRandom rng = sim.Random.Get(Name);
            bool night = sim.Now.IsNight;
            if (!rng.ChancePermille(night ? _b.ArrivalPermilleNight : _b.ArrivalPermilleDay)) return;

            IReadOnlyList<(string Species, int Weight)> weights = night ? _b.WeightsNight : _b.WeightsDay;
            int total = weights.Sum(w => w.Weight);
            long roll = rng.NextLong(total);
            string speciesId = weights.Last().Species;
            foreach ((string s, int w) in weights)
            {
                if (roll < w) { speciesId = s; break; }
                roll -= w;
            }

            SpeciesDef species = _content.Species[speciesId];
            int count = species.GroupSizeMin > 1 ? species.GroupSizeMin + (int)rng.Range(0, _b.GroupExtraMax) : 1;
            for (int i = 0; i < count; i++) Admit(sim, speciesId, null);
        }

        /// <summary>Laesst einen Patienten ankommen. Ohne Krankheitsangabe wird eine beschriebene Krankheit der Spezies gewaehlt.</summary>
        public Patient? Admit(Simulation sim, string speciesId, string? diseaseId, bool? isPrivate = null)
        {
            SimRandom rng = sim.Random.Get(Name);
            List<DiseaseDef> candidates = _content.Diseases.Values.Where(d => !d.Placeholder && d.SpeciesId == speciesId).OrderBy(d => d.Id, StringComparer.Ordinal).ToList();
            DiseaseDef? disease = diseaseId != null ? _content.Diseases[diseaseId]
                : candidates.Count == 0 ? null : candidates[(int)rng.NextLong(candidates.Count)];
            if (disease == null)
            {
                sim.Log.Warning(Name, $"Keine beschriebene Krankheit fuer {speciesId}; Ankunft entfaellt");
                return null;
            }

            BuildingSystem building = sim.GetSystem<BuildingSystem>();
            var p = new Patient
            {
                Id = sim.Ids.Next(),
                SpeciesId = speciesId,
                DiseaseId = disease.Id,
                IsPrivate = isPrivate ?? rng.Range(1, 100) <= _b.PrivatePatientPercent,
                State = PatientState.WalkingToReception,
                ArrivalTick = sim.Tick,
                Health = _b.HealthBySeverity[disease.Severity],
                Patience = _b.PatienceStart,
                Satisfaction = _b.SatisfactionStart,
                DeadlineHalfMinutes = disease.DeadlineMinutes * 2,
            };
            _patients[p.Id.Value] = p;
            MovementSystem move = sim.GetSystem<MovementSystem>();
            move.Spawn(p.Id, building.SpawnTile ?? throw new InvalidOperationException("Klinik hat keinen Eingang"), _b.PatientWalkSpeed);
            GoTo(sim, p, RoomOf(building, Reception), center: true);
            sim.GetSystem<EconomySystem>().Today.Arrivals++;
            sim.Events.Publish(new PatientArrived(sim.Tick, p.Id, speciesId, disease.Id));
            return p;
        }

        private void HandleMovement(Simulation sim, Patient p)
        {
            Walker w = sim.GetSystem<MovementSystem>().Get(p.Id);
            if (w.IsMoving) return;
            switch (p.State)
            {
                case PatientState.WalkingToReception:
                    p.State = PatientState.WaitingRegistration;
                    p.QueueSinceTick = sim.Tick;
                    break;
                case PatientState.WalkingToWaiting:
                    p.State = PatientState.WaitingCare;
                    p.QueueSinceTick = sim.Tick;
                    break;
                case PatientState.CalledToRoom:
                    Room? room = sim.GetSystem<BuildingSystem>().FindRoom(p.SessionRoom);
                    if (room != null && room.Rect.Contains(w.Tile))
                    {
                        p.State = PatientState.InSession;
                    }
                    else if (room == null || !GoTo(sim, p, room, center: true))
                    {
                        EndSession(sim, p);
                        Leave(sim, p, PatientOutcome.Abandoned);
                    }
                    break;
                case PatientState.WalkingToPay:
                    Pay(sim, p);
                    break;
                case PatientState.Leaving:
                    sim.GetSystem<MovementSystem>().Remove(p.Id);
                    DayStats today = sim.GetSystem<EconomySystem>().Today;
                    today.WaitMinutesSum += p.WaitingMinutes;
                    today.WaitCount++;
                    p.State = PatientState.Gone;
                    break;
            }
        }

        private void Tick(Simulation sim, Patient p)
        {
            if (p.State == PatientState.Leaving || p.State == PatientState.WalkingToPay || p.IsFinished) return;
            p.AgeMinutes++;

            bool inTreatment = p.State == PatientState.InSession && p.Session == SessionKind.Treatment;
            int step = inTreatment ? 1 : 2;
            if (!p.Complicated)
            {
                p.DeadlineHalfMinutes -= step;
                if (p.DeadlineHalfMinutes <= 0) ApplyComplication(sim, p);
            }
            else if (p.PermanentHalfMinutes >= 0)
            {
                p.PermanentHalfMinutes -= step;
                if (p.PermanentHalfMinutes <= 0)
                {
                    string comp = _content.Diseases[p.DiseaseId].Complications.FirstOrDefault() ?? string.Empty;
                    sim.Events.Publish(new ComplicationOccurred(sim.Tick, p.Id, comp, permanent: true));
                    EndSession(sim, p);
                    Leave(sim, p, PatientOutcome.PermanentlyUncured);
                    return;
                }
            }
            if (p.State == PatientState.Gone || p.IsFinished) return;

            if (!inTreatment && p.AgeMinutes % 10 == 0) p.Health -= _b.HealthLossPerTenMinutes;
            if (p.Health <= 0)
            {
                Die(sim, p);
                return;
            }

            if (p.IsWaiting)
            {
                p.WaitingMinutes++;
                p.WaitStreakMinutes++;
                p.Patience -= _b.PatienceLossPerWaitingMinute;
                if (p.WaitStreakMinutes > _b.SatisfactionLossAfterMinutes) p.Satisfaction = Math.Max(0, p.Satisfaction - 1);
                if (p.Patience <= 0)
                {
                    Leave(sim, p, PatientOutcome.Abandoned);
                    return;
                }
            }

            if (p.State == PatientState.InSession || p.State == PatientState.Registering)
            {
                p.SessionMinutesLeft--;
                if (p.SessionMinutesLeft <= 0) CompleteSession(sim, p);
            }
        }

        // ---------------- Komplikationen (A-11, A-14) ----------------

        private void ApplyComplication(Simulation sim, Patient p)
        {
            p.Complicated = true;
            sim.GetSystem<EconomySystem>().Today.Complications++;
            string compId = _content.Diseases[p.DiseaseId].Complications.FirstOrDefault() ?? string.Empty;
            sim.Events.Publish(new ComplicationOccurred(sim.Tick, p.Id, compId, permanent: false));
            if (!_content.Complications.TryGetValue(compId, out ComplicationDef? comp)) return;

            switch (comp.Effect)
            {
                case "death":
                    Die(sim, p);
                    break;
                case "permanent_uncured":
                    p.PermanentHalfMinutes = Math.Max(0, comp.PermanentAfterMinutes * 2);
                    break;
                case "emergency":
                    p.Emergency = true;
                    p.Health -= _b.EmergencyHealthLoss;
                    break;
                case "extra_damage_and_mess":
                    p.Mess = true;
                    p.Health -= _b.MessHealthLoss;
                    Room? here = sim.GetSystem<BuildingSystem>().RoomAt(sim.GetSystem<MovementSystem>().Get(p.Id).Tile);
                    if (here != null) sim.GetSystem<HygieneSystem>().AddDirt(here.Id, _b.DirtMess);
                    break;
            }
        }

        // ---------------- Einteilung (Behandlung nach Dringlichkeit, A-11) ----------------

        private (bool, long) Urgency(EntityId id)
        {
            Patient p = _patients[id.Value];
            long remaining = p.Complicated && p.PermanentHalfMinutes >= 0 ? p.PermanentHalfMinutes : p.Complicated ? 0 : p.DeadlineHalfMinutes;
            return (p.Emergency, remaining);
        }

        private void DispatchRegistration(Simulation sim)
        {
            StaffSystem staff = sim.GetSystem<StaffSystem>();
            while (true)
            {
                StaffMember? admin = staff.FreeIn(Reception, s => s.Profession == "administrator");
                if (admin == null) return;
                var queue = new RoomQueue();
                foreach (Patient c in _patients.Values.Where(x => x.State == PatientState.WaitingRegistration)) queue.Enqueue(c.Id, c.QueueSinceTick);
                EntityId? next = queue.DequeueMostUrgent(Urgency);
                if (next == null) return;
                Patient p = _patients[next.Value.Value];
                staff.Assign(admin, StaffTask.Registering, p.Id);
                p.State = PatientState.Registering;
                p.Session = SessionKind.Registration;
                p.StaffId = admin.Id;
                p.SessionMinutesLeft = _b.ScaledMinutes(_b.RegistrationMinutes, admin.Qualification);
                p.WaitStreakMinutes = 0;
            }
        }

        private void DispatchCare(Simulation sim, string roomType)
        {
            StaffSystem staff = sim.GetSystem<StaffSystem>();
            BuildingSystem building = sim.GetSystem<BuildingSystem>();
            Room? room = building.Rooms.FirstOrDefault(r => r.TypeId == roomType);
            if (room == null) return;

            foreach (StaffMember doctor in staff.Members.Where(s => s.IsFree && s.IsDoctor && s.RoomTypeId == roomType).ToList())
            {
                var queue = new RoomQueue();
                foreach (Patient c in _patients.Values.Where(x => x.State == PatientState.WaitingCare && NextAction(x, roomType, doctor) != null))
                {
                    queue.Enqueue(c.Id, c.QueueSinceTick);
                }
                EntityId? next = queue.DequeueMostUrgent(Urgency);
                if (next == null) continue;

                Patient p = _patients[next.Value.Value];
                (SessionKind kind, string action, int minutes) = NextAction(p, roomType, doctor)!.Value;
                staff.Assign(doctor, kind == SessionKind.Exam ? StaffTask.Examining : StaffTask.Treating, p.Id);
                p.Session = kind;
                p.SessionAction = action;
                p.SessionMinutesLeft = minutes;
                p.StaffId = doctor.Id;
                p.SessionRoom = room.Id;
                p.State = PatientState.CalledToRoom;
                p.WaitStreakMinutes = 0;
                if (!GoTo(sim, p, room, center: true))
                {
                    EndSession(sim, p);
                    Leave(sim, p, PatientOutcome.Abandoned);
                }
            }
        }

        /// <summary>Was als Naechstes mit dem Patienten in diesem Raum durch diesen Arzt geschehen kann, oder null.</summary>
        private (SessionKind, string, int)? NextAction(Patient p, string roomType, StaffMember doctor)
        {
            if (p.IsDiagnosed)
            {
                string treatment = _content.Diseases[p.DiagnosedDiseaseId].TreatmentId;
                if (!_b.TreatmentRooms.TryGetValue(treatment, out string? treatmentRoom) || treatmentRoom != roomType) return null;
                if (!doctor.CanPerform(_content.Treatments[treatment].Specialization)) return null;
                int minutes = _b.ScaledMinutes(_b.TreatmentMinutes[treatment], doctor.Qualification);
                if (p.Mess) minutes = minutes * _b.MessDurationPercent / 100;
                return (SessionKind.Treatment, treatment, minutes);
            }

            if (roomType != ExamRoom) return null;
            IReadOnlyList<DiagnosisStep> steps = _content.Diseases[p.DiseaseId].Diagnosis;
            DiagnosisStep step = steps[Math.Min(p.ExamsDone, steps.Count - 1)];
            if (!doctor.CanPerform(_content.Procedures[step.ProcedureId].Specialization)) return null;
            return (SessionKind.Exam, step.ProcedureId, _b.ScaledMinutes(_b.ProcedureMinutes[step.ProcedureId], doctor.Qualification));
        }

        // ---------------- Abschluss von Anmeldung, Untersuchung, Behandlung ----------------

        private void CompleteSession(Simulation sim, Patient p)
        {
            StaffMember staff = sim.GetSystem<StaffSystem>().Get(p.StaffId);
            SessionKind kind = p.Session;
            string action = p.SessionAction;
            EntityId room = p.SessionRoom;
            EndSession(sim, p);
            if (!room.IsNone) sim.GetSystem<HygieneSystem>().AddDirt(room, _b.DirtPerVisit);

            switch (kind)
            {
                case SessionKind.Registration:
                    BackToWaiting(sim, p);
                    break;
                case SessionKind.Exam:
                    CompleteExam(sim, p, staff, action);
                    break;
                case SessionKind.Treatment:
                    CompleteTreatment(sim, p, staff, action);
                    break;
            }
        }

        private void CompleteExam(Simulation sim, Patient p, StaffMember doctor, string procedure)
        {
            int accuracy = _b.AccuracyPercent[doctor.Qualification - 1];
            DiseaseDef disease = _content.Diseases[p.DiseaseId];
            DiagnosisStep step = disease.Diagnosis[Math.Min(p.ExamsDone, disease.Diagnosis.Count - 1)];
            p.Confidence += step.PowerPercent * accuracy / 100;
            p.ExamsDone++;
            p.Bill += _b.Tariffs.TryGetValue(procedure, out int tariff) ? tariff : 0;

            if (p.Confidence >= _b.ConfidenceThreshold || p.ExamsDone >= _b.MaxExams)
            {
                int chance = Math.Max(5, Math.Min(99, accuracy + (p.Confidence - _b.ConfidenceThreshold) / 2));
                SimRandom rng = sim.Random.Get("Medical");
                bool correct = rng.Range(1, 100) <= chance;
                List<string> others = _content.Diseases.Values.Where(d => !d.Placeholder && d.Id != p.DiseaseId).Select(d => d.Id).OrderBy(d => d, StringComparer.Ordinal).ToList();
                if (others.Count == 0) correct = true;
                p.DiagnosedDiseaseId = correct ? p.DiseaseId : others[(int)rng.NextLong(others.Count)];

                DayStats today = sim.GetSystem<EconomySystem>().Today;
                today.Diagnoses++;
                if (!correct) today.WrongDiagnoses++;
                sim.Events.Publish(new PatientDiagnosed(sim.Tick, p.Id, p.DiagnosedDiseaseId, correct));
            }
            BackToWaiting(sim, p);
        }

        private void CompleteTreatment(Simulation sim, Patient p, StaffMember doctor, string treatment)
        {
            EconomySystem economy = sim.GetSystem<EconomySystem>();
            if (_b.MaterialCosts.TryGetValue(treatment, out int material)) economy.Post(sim, -material, "expense.material", p.Id);

            if (p.DiagnosedDiseaseId != p.DiseaseId)
            {
                // Falsche Diagnose: Behandlung wirkt nicht, wird nicht bezahlt, Patient muss neu untersucht werden (Kap. 8).
                p.Satisfaction = Math.Max(0, p.Satisfaction - _b.SatisfactionWrongDiagnosis);
                p.DiagnosedDiseaseId = string.Empty;
                p.Confidence = 0;
                p.ExamsDone = 0;
                economy.Today.FailedTreatments++;
                BackToWaiting(sim, p);
                return;
            }

            int chance = _b.BaseSuccessPercent + _b.SuccessBonusPercent[doctor.Qualification - 1] - (1000 - Math.Max(0, p.Health)) / 40;
            chance = Math.Max(5, Math.Min(99, chance));
            if (sim.Random.Get("Medical").Range(1, 100) <= chance)
            {
                p.Bill += _b.Tariffs.TryGetValue(treatment, out int tariff) ? tariff : 0;
                p.Satisfaction = Math.Min(1000, p.Satisfaction + _b.SatisfactionCured);
                p.Outcome = PatientOutcome.Cured;
                p.Emergency = false;
                economy.Today.Cured++;
                p.State = PatientState.WalkingToPay;
                GoTo(sim, p, RoomOf(sim.GetSystem<BuildingSystem>(), Reception), center: true);
            }
            else
            {
                p.Satisfaction = Math.Max(0, p.Satisfaction - _b.SatisfactionFailedTreatment);
                economy.Today.FailedTreatments++;
                BackToWaiting(sim, p);
            }
        }

        private void EndSession(Simulation sim, Patient p)
        {
            if (!p.StaffId.IsNone)
            {
                StaffSystem staff = sim.GetSystem<StaffSystem>();
                StaffMember s = staff.Get(p.StaffId);
                if (s.BusyWith == p.Id) staff.Release(s);
            }
            p.StaffId = EntityId.None;
            p.Session = SessionKind.None;
            p.SessionAction = string.Empty;
            p.SessionMinutesLeft = 0;
            p.SessionRoom = EntityId.None;
        }

        private void BackToWaiting(Simulation sim, Patient p)
        {
            p.State = PatientState.WalkingToWaiting;
            BuildingSystem building = sim.GetSystem<BuildingSystem>();
            Room waiting = RoomOf(building, WaitingRoom);
            if (!GoTo(sim, p, waiting, center: false)) Leave(sim, p, PatientOutcome.Abandoned);
        }

        private void Pay(Simulation sim, Patient p)
        {
            long amount = p.Bill * (100 + (p.IsPrivate ? _b.PrivateSurchargePercent : 0)) / 100;
            if (amount > 0) sim.GetSystem<EconomySystem>().Post(sim, amount, "income.patient_bill", p.Id);
            sim.Events.Publish(new PatientLeft(sim.Tick, p.Id, p.Outcome, amount));
            p.State = PatientState.Leaving;
            sim.GetSystem<MovementSystem>().SetGoal(sim, p.Id, sim.GetSystem<BuildingSystem>().SpawnTile!.Value);
        }

        /// <summary>Verlaesst die Klinik ohne zu bezahlen (Abbruch, dauerhafte Komplikation). Wirkt auf Ruf und Einnahmen (PAT-11).</summary>
        private void Leave(Simulation sim, Patient p, PatientOutcome outcome)
        {
            EndSession(sim, p);
            p.Outcome = outcome;
            DayStats today = sim.GetSystem<EconomySystem>().Today;
            if (outcome == PatientOutcome.Abandoned) today.Abandoned++;
            if (outcome == PatientOutcome.PermanentlyUncured) today.PermanentlyUncured++;
            sim.Events.Publish(new PatientLeft(sim.Tick, p.Id, outcome, 0));
            p.State = PatientState.Leaving;
            if (!sim.GetSystem<MovementSystem>().SetGoal(sim, p.Id, sim.GetSystem<BuildingSystem>().SpawnTile!.Value))
            {
                sim.GetSystem<MovementSystem>().Remove(p.Id);
                p.State = PatientState.Gone;
            }
        }

        private void Die(Simulation sim, Patient p)
        {
            EndSession(sim, p);
            p.Outcome = PatientOutcome.Died;
            DayStats today = sim.GetSystem<EconomySystem>().Today;
            today.Died++;
            today.WaitMinutesSum += p.WaitingMinutes;
            today.WaitCount++;
            sim.Events.Publish(new PatientLeft(sim.Tick, p.Id, PatientOutcome.Died, 0));
            sim.GetSystem<MovementSystem>().Remove(p.Id);
            p.State = PatientState.Gone;
        }

        private static Room RoomOf(BuildingSystem building, string type) =>
            building.Rooms.FirstOrDefault(r => r.TypeId == type) ?? throw new InvalidOperationException($"Klinik hat keinen Raum {type}");

        private bool GoTo(Simulation sim, Patient p, Room room, bool center)
        {
            Tile target = center ? Places.Center(room) : Places.RandomInside(room, sim.Random.Get(Name));
            return sim.GetSystem<MovementSystem>().SetGoal(sim, p.Id, target);
        }

        // ---------------- Speichern ----------------

        public JsonValue SaveState()
        {
            JsonValue arr = JsonValue.NewArray();
            foreach (Patient p in _patients.Values)
            {
                arr.Add(JsonValue.NewObject()
                    .Set("id", (long)p.Id.Value).Set("species", p.SpeciesId).Set("disease", p.DiseaseId).Set("private", p.IsPrivate)
                    .Set("state", (long)p.State).Set("arrival", p.ArrivalTick).Set("queueSince", p.QueueSinceTick).Set("age", p.AgeMinutes)
                    .Set("health", p.Health).Set("patience", p.Patience).Set("satisfaction", p.Satisfaction)
                    .Set("deadline", p.DeadlineHalfMinutes).Set("complicated", p.Complicated).Set("permanent", p.PermanentHalfMinutes)
                    .Set("emergency", p.Emergency).Set("mess", p.Mess).Set("exams", p.ExamsDone).Set("confidence", p.Confidence)
                    .Set("diagnosed", p.DiagnosedDiseaseId).Set("waiting", p.WaitingMinutes).Set("streak", p.WaitStreakMinutes)
                    .Set("session", (long)p.Session).Set("action", p.SessionAction).Set("left", p.SessionMinutesLeft)
                    .Set("staff", (long)p.StaffId.Value).Set("room", (long)p.SessionRoom.Value).Set("bill", p.Bill).Set("outcome", (long)p.Outcome));
            }
            return JsonValue.NewObject().Set("arrivals", ArrivalsEnabled).Set("patients", arr);
        }

        public void LoadState(JsonValue state)
        {
            ArrivalsEnabled = state.GetBool("arrivals");
            _patients.Clear();
            foreach (JsonValue o in state.Get("patients").Items)
            {
                var p = new Patient
                {
                    Id = new EntityId((ulong)o.GetInt("id")), SpeciesId = o.GetString("species"), DiseaseId = o.GetString("disease"),
                    IsPrivate = o.GetBool("private"), State = (PatientState)o.GetInt("state"), ArrivalTick = o.GetInt("arrival"),
                    QueueSinceTick = o.GetInt("queueSince"), AgeMinutes = (int)o.GetInt("age"), Health = (int)o.GetInt("health"),
                    Patience = (int)o.GetInt("patience"), Satisfaction = (int)o.GetInt("satisfaction"), DeadlineHalfMinutes = (int)o.GetInt("deadline"),
                    Complicated = o.GetBool("complicated"), PermanentHalfMinutes = (int)o.GetInt("permanent"), Emergency = o.GetBool("emergency"),
                    Mess = o.GetBool("mess"), ExamsDone = (int)o.GetInt("exams"), Confidence = (int)o.GetInt("confidence"),
                    DiagnosedDiseaseId = o.GetString("diagnosed"), WaitingMinutes = (int)o.GetInt("waiting"), WaitStreakMinutes = (int)o.GetInt("streak"),
                    Session = (SessionKind)o.GetInt("session"), SessionAction = o.GetString("action"), SessionMinutesLeft = (int)o.GetInt("left"),
                    StaffId = new EntityId((ulong)o.GetInt("staff")), SessionRoom = new EntityId((ulong)o.GetInt("room")), Bill = o.GetInt("bill"),
                    Outcome = (PatientOutcome)o.GetInt("outcome"),
                };
                _patients[p.Id.Value] = p;
            }
        }
    }
}
