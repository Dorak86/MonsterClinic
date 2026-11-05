using System;
using System.Collections.Generic;
using System.Linq;
using MonsterClinic.Sim.Data;
using MonsterClinic.Sim.Kernel;
using MonsterClinic.Sim.World;

namespace MonsterClinic.Sim.Clinic
{
    /// <summary>Eine Buchung (Planung 4.6). Kontostand = Startkapital + Summe aller Buchungen.</summary>
    public readonly struct Transaction
    {
        public Transaction(long tick, long amount, string category, EntityId source)
        {
            Tick = tick;
            Amount = amount;
            Category = category;
            Source = source;
        }

        public long Tick { get; }
        public long Amount { get; }

        /// <summary>z. B. income.patient_bill, expense.salary, expense.material</summary>
        public string Category { get; }
        public EntityId Source { get; }
    }

    /// <summary>Kennzahlen eines Spieltags fuer Bericht und Ruf.</summary>
    public sealed class DayStats
    {
        public long Day { get; set; }
        public int Arrivals { get; set; }
        public int Cured { get; set; }
        public int Abandoned { get; set; }
        public int Died { get; set; }
        public int PermanentlyUncured { get; set; }
        public int Diagnoses { get; set; }
        public int WrongDiagnoses { get; set; }
        public int FailedTreatments { get; set; }
        public int Complications { get; set; }
        public long WaitMinutesSum { get; set; }
        public int WaitCount { get; set; }
        public long Income { get; set; }
        public long Expenses { get; set; }
        public long BalanceAtEnd { get; set; }
        public int Reputation { get; set; }
        public int Cleanliness { get; set; }

        public JsonValue ToJson() => JsonValue.NewObject()
            .Set("day", Day).Set("arrivals", Arrivals).Set("cured", Cured).Set("abandoned", Abandoned).Set("died", Died)
            .Set("permanent", PermanentlyUncured).Set("diagnoses", Diagnoses).Set("wrong", WrongDiagnoses)
            .Set("failed", FailedTreatments).Set("complications", Complications).Set("waitSum", WaitMinutesSum)
            .Set("waitCount", WaitCount).Set("income", Income).Set("expenses", Expenses).Set("balance", BalanceAtEnd)
            .Set("reputation", Reputation).Set("cleanliness", Cleanliness);

        public static DayStats FromJson(JsonValue o) => new DayStats
        {
            Day = o.GetInt("day"), Arrivals = (int)o.GetInt("arrivals"), Cured = (int)o.GetInt("cured"), Abandoned = (int)o.GetInt("abandoned"),
            Died = (int)o.GetInt("died"), PermanentlyUncured = (int)o.GetInt("permanent"), Diagnoses = (int)o.GetInt("diagnoses"),
            WrongDiagnoses = (int)o.GetInt("wrong"), FailedTreatments = (int)o.GetInt("failed"), Complications = (int)o.GetInt("complications"),
            WaitMinutesSum = o.GetInt("waitSum"), WaitCount = (int)o.GetInt("waitCount"), Income = o.GetInt("income"),
            Expenses = o.GetInt("expenses"), BalanceAtEnd = o.GetInt("balance"), Reputation = (int)o.GetInt("reputation"),
            Cleanliness = (int)o.GetInt("cleanliness"),
        };
    }

    public sealed class DayClosed : IDomainEvent
    {
        public DayClosed(long tick, DayStats stats)
        {
            Tick = tick;
            Stats = stats;
        }

        public long Tick { get; }
        public DayStats Stats { get; }
    }

    /// <summary>
    /// Wirtschaft im Spielkreislauf (K3): Hauptbuch, Gehaelter, Kassentarife mit Privatzuschlag (A-09),
    /// Tagesabschluss mit Ruf aus Sauberkeit, Wartezeit, Diagnosequote und Erfolgsquote (A-09).
    /// ZWISCHENSTAND (Regel 6): Kredite, Vertraege, Finanzuebersicht und Folgen schlechter Wirtschaft folgen in Phase 5.
    /// </summary>
    public sealed class EconomySystem : ISimSystem
    {
        private readonly LoopBalancing _b;
        private readonly List<Transaction> _ledger = new List<Transaction>();
        private readonly List<DayStats> _history = new List<DayStats>();

        public EconomySystem(LoopBalancing balancing)
        {
            _b = balancing ?? throw new ArgumentNullException(nameof(balancing));
            Reputation = _b.ReputationStart;
            Today = new DayStats { Day = 1 };
        }

        public string Name => "Economy";

        /// <summary>Tagesabschluss einmal je Spieltag, zum Tick des Spielstarts (06:00).</summary>
        public int IntervalTicks => TimeConfig.TicksPerGameDay;
        public int OffsetTicks => TimeConfig.TicksPerGameDay - 1;

        public long Balance => _b.StartMoney + _ledger.Sum(t => t.Amount);

        /// <summary>Ruf 0 bis 1000; in der Oberflaeche als 0 bis 100 bzw. Kerzenreihe gezeigt.</summary>
        public int Reputation { get; private set; }

        public DayStats Today { get; private set; }
        public IReadOnlyList<DayStats> History => _history;
        public IReadOnlyList<Transaction> Ledger => _ledger;

        public void Post(Simulation sim, long amount, string category, EntityId source)
        {
            _ledger.Add(new Transaction(sim.Tick, amount, category, source));
            if (amount >= 0) Today.Income += amount;
            else Today.Expenses -= amount;
        }

        public void Update(Simulation sim)
        {
            foreach (StaffMember s in sim.GetSystem<StaffSystem>().Members)
            {
                if (_b.Salaries.TryGetValue(s.Profession, out int[]? salary))
                {
                    Post(sim, -salary[s.Qualification - 1], "expense.salary", s.Id);
                }
            }

            BuildingSystem building = sim.GetSystem<BuildingSystem>();
            int cleanliness = sim.GetSystem<HygieneSystem>().Cleanliness(building);
            DayStats d = Today;

            int waitScore = d.WaitCount == 0 ? 1000
                : Clamp(1000 - (int)(d.WaitMinutesSum / d.WaitCount - _b.TargetWaitMinutes) * _b.WaitPenaltyPerMinute);
            int diagnosisScore = d.Diagnoses == 0 ? Reputation : Clamp(1000 * (d.Diagnoses - d.WrongDiagnoses) / d.Diagnoses);
            int finished = d.Cured + d.Abandoned + d.Died + d.PermanentlyUncured;
            int successScore = finished == 0 ? Reputation : Clamp(1000 * d.Cured / finished);
            int score = (cleanliness + waitScore + diagnosisScore + successScore) / 4;
            Reputation = Clamp((Reputation * _b.ReputationKeepPercent + score * (100 - _b.ReputationKeepPercent)) / 100);

            d.Reputation = Reputation;
            d.Cleanliness = cleanliness;
            d.BalanceAtEnd = Balance;
            _history.Add(d);
            sim.Events.Publish(new DayClosed(sim.Tick, d));
            Today = new DayStats { Day = d.Day + 1 };
        }

        private static int Clamp(int v) => Math.Max(0, Math.Min(1000, v));

        public JsonValue SaveState()
        {
            JsonValue ledger = JsonValue.NewArray();
            foreach (Transaction t in _ledger)
                ledger.Add(JsonValue.NewObject().Set("tick", t.Tick).Set("amount", t.Amount).Set("cat", t.Category).Set("src", (long)t.Source.Value));
            JsonValue history = JsonValue.NewArray();
            foreach (DayStats d in _history) history.Add(d.ToJson());
            return JsonValue.NewObject().Set("reputation", Reputation).Set("today", Today.ToJson()).Set("history", history).Set("ledger", ledger);
        }

        public void LoadState(JsonValue state)
        {
            Reputation = (int)state.GetInt("reputation");
            Today = DayStats.FromJson(state.Get("today"));
            _history.Clear();
            foreach (JsonValue d in state.Get("history").Items) _history.Add(DayStats.FromJson(d));
            _ledger.Clear();
            foreach (JsonValue t in state.Get("ledger").Items)
                _ledger.Add(new Transaction(t.GetInt("tick"), t.GetInt("amount"), t.GetString("cat"), new EntityId((ulong)t.GetInt("src"))));
        }
    }
}
