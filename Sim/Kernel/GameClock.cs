using System;

namespace MonsterClinic.Sim.Kernel
{
    /// <summary>
    /// Einstellungen der Spielzeit. Die Tick-Laenge ist Teil der Architektur (Pflichtenheft 3: 1 Tick = 12 Spielsekunden),
    /// Tag- und Nachtbeginn sowie die Startuhrzeit sind Balancing-Werte aus Content/balancing/time.json.
    /// </summary>
    public sealed class TimeConfig
    {
        public const int GameSecondsPerTick = 12;
        public const int TicksPerGameMinute = 60 / GameSecondsPerTick;          // 5
        public const int TicksPerGameHour = TicksPerGameMinute * 60;            // 300
        public const int TicksPerGameDay = TicksPerGameHour * 24;               // 7200
        public const int TicksPerRealSecondAtNormalSpeed = 10;                  // 1 Spieltag = 12 Minuten bei 1x

        public TimeConfig(int startMinuteOfDay, int dayStartMinute, int nightStartMinute)
        {
            CheckMinute(startMinuteOfDay, nameof(startMinuteOfDay));
            CheckMinute(dayStartMinute, nameof(dayStartMinute));
            CheckMinute(nightStartMinute, nameof(nightStartMinute));
            if (dayStartMinute >= nightStartMinute)
            {
                throw new ArgumentException("Tagbeginn muss vor Nachtbeginn liegen");
            }
            StartMinuteOfDay = startMinuteOfDay;
            DayStartMinute = dayStartMinute;
            NightStartMinute = nightStartMinute;
        }

        /// <summary>Uhrzeit beim Spielstart (Tick 0), Minuten seit Mitternacht.</summary>
        public int StartMinuteOfDay { get; }
        public int DayStartMinute { get; }
        public int NightStartMinute { get; }

        private static void CheckMinute(int minute, string name)
        {
            if (minute < 0 || minute >= 24 * 60) throw new ArgumentOutOfRangeException(name, "Minute muss zwischen 0 und 1439 liegen");
        }
    }

    /// <summary>Uhrzeit zu einem Tick. Die Zeit ergibt sich allein aus der Tick-Nummer (Pflichtenheft 3).</summary>
    public readonly struct GameTime
    {
        public GameTime(long tick, TimeConfig config)
        {
            Tick = tick;
            long ticksSinceMidnightOfDay1 = config.StartMinuteOfDay * (long)TimeConfig.TicksPerGameMinute + tick;
            Day = 1 + ticksSinceMidnightOfDay1 / TimeConfig.TicksPerGameDay;
            long tickOfDay = ticksSinceMidnightOfDay1 % TimeConfig.TicksPerGameDay;
            MinuteOfDay = (int)(tickOfDay / TimeConfig.TicksPerGameMinute);
            IsNight = MinuteOfDay < config.DayStartMinute || MinuteOfDay >= config.NightStartMinute;
            IsMinuteStart = tickOfDay % TimeConfig.TicksPerGameMinute == 0;
        }

        public long Tick { get; }
        public long Day { get; }
        public int MinuteOfDay { get; }
        public int Hour => MinuteOfDay / 60;
        public int Minute => MinuteOfDay % 60;
        public bool IsNight { get; }

        /// <summary>Wahr, wenn dieser Tick der erste einer Spielminute ist.</summary>
        public bool IsMinuteStart { get; }

        public override string ToString() => $"Tag {Day}, {Hour:00}:{Minute:00}";
    }
}
