using System;
using System.Collections.Generic;
using System.Linq;
using MonsterClinic.Sim.Data;

namespace MonsterClinic.Sim.Clinic
{
    /// <summary>
    /// Typisierte Sicht auf Content/balancing/clinic_loop.json (Meilenstein Spielkreislauf, K3).
    /// Jede Zahl der Spielmechanik kommt von hier, nie aus dem Code (Pflichtenheft 1, Code-Regel 3).
    /// </summary>
    public sealed class LoopBalancing
    {
        public LoopBalancing(JsonValue j)
        {
            StartMoney = j.GetInt("startMoney");

            JsonValue arrival = j.Get("arrival");
            ArrivalPermilleDay = (int)arrival.Get("chancePermillePerMinute").GetInt("day");
            ArrivalPermilleNight = (int)arrival.Get("chancePermillePerMinute").GetInt("night");
            WeightsDay = Weights(arrival.Get("speciesWeights").Get("day"));
            WeightsNight = Weights(arrival.Get("speciesWeights").Get("night"));
            GroupExtraMax = (int)arrival.GetInt("groupExtraMax");
            PrivatePatientPercent = (int)arrival.GetInt("privatePatientPercent");

            JsonValue p = j.Get("patient");
            PatienceStart = (int)p.GetInt("patienceStart");
            PatienceLossPerWaitingMinute = (int)p.GetInt("patienceLossPerWaitingMinute");
            SatisfactionStart = (int)p.GetInt("satisfactionStart");
            SatisfactionLossAfterMinutes = (int)p.GetInt("satisfactionLossPerWaitingMinuteAfter");
            SatisfactionCured = (int)p.GetInt("satisfactionCured");
            SatisfactionFailedTreatment = (int)p.GetInt("satisfactionFailedTreatment");
            SatisfactionWrongDiagnosis = (int)p.GetInt("satisfactionWrongDiagnosis");
            HealthBySeverity = p.Get("healthBySeverity").Fields.ToDictionary(f => f.Key, f => (int)f.Value.AsInt(f.Key), StringComparer.Ordinal);
            HealthLossPerTenMinutes = (int)p.GetInt("healthLossPerTenMinutesUntreated");

            JsonValue d = j.Get("durations");
            RegistrationMinutes = (int)d.GetInt("registration");
            ProcedureMinutes = IntMap(d.Get("procedures"));
            TreatmentMinutes = IntMap(d.Get("treatments"));
            TreatmentRooms = j.Get("treatmentRooms").Fields.ToDictionary(f => f.Key, f => f.Value.AsString(f.Key), StringComparer.Ordinal);

            JsonValue q = j.Get("qualification");
            SpeedPercent = IntArray(q.Get("speedPercent"));
            AccuracyPercent = IntArray(q.Get("accuracyPercent"));
            SuccessBonusPercent = IntArray(q.Get("successBonusPercent"));

            ConfidenceThreshold = (int)j.Get("diagnosis").GetInt("confidenceThreshold");
            MaxExams = (int)j.Get("diagnosis").GetInt("maxExams");
            BaseSuccessPercent = (int)j.Get("treatment").GetInt("baseSuccessPercent");
            MessDurationPercent = (int)j.Get("treatment").GetInt("messDurationPercent");

            Tariffs = IntMap(j.Get("tariffs"));
            PrivateSurchargePercent = (int)j.GetInt("privateSurchargePercent");
            MaterialCosts = IntMap(j.Get("materialCosts"));
            Salaries = j.Get("salariesPerDay").Fields.ToDictionary(f => f.Key, f => IntArray(f.Value), StringComparer.Ordinal);

            JsonValue c = j.Get("cleanliness");
            DirtPerVisit = (int)c.GetInt("dirtPerVisit");
            DirtMess = (int)c.GetInt("dirtMess");
            CleanPerMinute = (int)c.GetInt("cleanPerMinute");
            CleanThreshold = (int)c.GetInt("cleanThreshold");

            EmergencyHealthLoss = (int)j.Get("complications").GetInt("emergencyHealthLoss");
            MessHealthLoss = (int)j.Get("complications").GetInt("messHealthLoss");

            JsonValue r = j.Get("reputation");
            ReputationStart = (int)r.GetInt("start");
            ReputationKeepPercent = (int)r.GetInt("keepPercentPerDay");
            TargetWaitMinutes = (int)r.GetInt("targetWaitMinutes");
            WaitPenaltyPerMinute = (int)r.GetInt("waitPenaltyPerMinute");

            JsonValue f = j.Get("fixedCostsPerDay");
            EnergyBase = (int)f.GetInt("energyBase");
            EnergyPerRoom = IntMap(f.Get("energyPerRoom"));
            RentPerIndoorTile = (int)f.GetInt("rentPerIndoorTile");
            Insurance = (int)f.GetInt("insurance");

            PatientWalkSpeed = (int)j.Get("walkSpeed").GetInt("patient");
            StaffWalkSpeed = (int)j.Get("walkSpeed").GetInt("staff");

            if (SpeedPercent.Length != 5 || AccuracyPercent.Length != 5 || SuccessBonusPercent.Length != 5)
                throw new JsonFormatException("qualification: je 5 Werte fuer die Stufen 1 bis 5 erwartet");
        }

        public long StartMoney { get; }
        public int ArrivalPermilleDay { get; }
        public int ArrivalPermilleNight { get; }
        public IReadOnlyList<(string Species, int Weight)> WeightsDay { get; }
        public IReadOnlyList<(string Species, int Weight)> WeightsNight { get; }
        public int GroupExtraMax { get; }
        public int PrivatePatientPercent { get; }
        public int PatienceStart { get; }
        public int PatienceLossPerWaitingMinute { get; }
        public int SatisfactionStart { get; }
        public int SatisfactionLossAfterMinutes { get; }
        public int SatisfactionCured { get; }
        public int SatisfactionFailedTreatment { get; }
        public int SatisfactionWrongDiagnosis { get; }
        public IReadOnlyDictionary<string, int> HealthBySeverity { get; }
        public int HealthLossPerTenMinutes { get; }
        public int RegistrationMinutes { get; }
        public IReadOnlyDictionary<string, int> ProcedureMinutes { get; }
        public IReadOnlyDictionary<string, int> TreatmentMinutes { get; }
        public IReadOnlyDictionary<string, string> TreatmentRooms { get; }
        public int[] SpeedPercent { get; }
        public int[] AccuracyPercent { get; }
        public int[] SuccessBonusPercent { get; }
        public int ConfidenceThreshold { get; }
        public int MaxExams { get; }
        public int BaseSuccessPercent { get; }
        public int MessDurationPercent { get; }
        public IReadOnlyDictionary<string, int> Tariffs { get; }
        public int PrivateSurchargePercent { get; }
        public IReadOnlyDictionary<string, int> MaterialCosts { get; }
        public IReadOnlyDictionary<string, int[]> Salaries { get; }
        public int DirtPerVisit { get; }
        public int DirtMess { get; }
        public int CleanPerMinute { get; }
        public int CleanThreshold { get; }
        public int EmergencyHealthLoss { get; }
        public int MessHealthLoss { get; }
        public int ReputationStart { get; }
        public int ReputationKeepPercent { get; }
        public int TargetWaitMinutes { get; }
        public int WaitPenaltyPerMinute { get; }
        public int EnergyBase { get; }
        public IReadOnlyDictionary<string, int> EnergyPerRoom { get; }
        public int RentPerIndoorTile { get; }
        public int Insurance { get; }
        public int PatientWalkSpeed { get; }
        public int StaffWalkSpeed { get; }

        /// <summary>Dauer in Minuten nach Ausbildungsstufe (1 bis 5): schlechter ausgebildet dauert laenger (A-04).</summary>
        public int ScaledMinutes(int baseMinutes, int qualification) =>
            Math.Max(1, baseMinutes * SpeedPercent[qualification - 1] / 100);

        private static Dictionary<string, int> IntMap(JsonValue v) =>
            v.Fields.Where(f => !f.Key.StartsWith("_", StringComparison.Ordinal))
                .ToDictionary(f => f.Key, f => (int)f.Value.AsInt(f.Key), StringComparer.Ordinal);

        private static int[] IntArray(JsonValue v) => v.Items.Select(i => (int)i.AsInt()).ToArray();

        private static List<(string, int)> Weights(JsonValue v) =>
            v.Fields.Select(f => (f.Key, (int)f.Value.AsInt(f.Key))).ToList();
    }
}
