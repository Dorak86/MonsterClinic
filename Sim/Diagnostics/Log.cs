using System;
using System.Collections.Generic;

namespace MonsterClinic.Sim.Diagnostics
{
    /// <summary>Protokollstufen (Pflichtenheft 5). Detail wird nur im Entwickler-Build ausgegeben.</summary>
    public enum LogLevel
    {
        Detail = 0,
        Info = 1,
        Warning = 2,
        Error = 3,
    }

    /// <summary>
    /// Ein Protokolleintrag. Der Kern kennt keine Systemzeit (Code-Regel 1);
    /// den Zeitstempel ergaenzt die Senke des Gastgebers (Spiel oder Werkzeug).
    /// </summary>
    public readonly struct LogEntry
    {
        public LogEntry(LogLevel level, long tick, string system, ulong? entityId, string message)
        {
            Level = level;
            Tick = tick;
            System = system ?? throw new ArgumentNullException(nameof(system));
            EntityId = entityId;
            Message = message ?? throw new ArgumentNullException(nameof(message));
        }

        public LogLevel Level { get; }
        public long Tick { get; }
        public string System { get; }
        public ulong? EntityId { get; }
        public string Message { get; }

        /// <summary>Format ohne Zeitstempel: "[Tick 12345] [Grid] [E#4711] Nachricht".</summary>
        public string FormatBody()
        {
            string entity = EntityId.HasValue ? $" [E#{EntityId.Value}]" : string.Empty;
            return $"[Tick {Tick}] [{System}]{entity} {Message}";
        }
    }

    /// <summary>Ziel fuer Protokolleintraege (Datei, Konsole, Test).</summary>
    public interface ILogSink
    {
        void Write(in LogEntry entry);
    }

    /// <summary>
    /// Protokoll einer Simulation. Jede Instanz gehoert zu genau einer Simulation;
    /// es gibt bewusst keinen statischen Zustand (Code-Regel 1).
    /// </summary>
    public sealed class SimLog
    {
        private readonly List<ILogSink> _sinks = new List<ILogSink>();
        private readonly Func<long> _currentTick;

        public SimLog(Func<long> currentTick, LogLevel minimumLevel = LogLevel.Info)
        {
            _currentTick = currentTick ?? throw new ArgumentNullException(nameof(currentTick));
            MinimumLevel = minimumLevel;
        }

        public LogLevel MinimumLevel { get; set; }

        public void AddSink(ILogSink sink) => _sinks.Add(sink ?? throw new ArgumentNullException(nameof(sink)));

        public void Write(LogLevel level, string system, string message, ulong? entityId = null)
        {
            if (level < MinimumLevel)
            {
                return;
            }

            var entry = new LogEntry(level, _currentTick(), system, entityId, message);
            foreach (ILogSink sink in _sinks)
            {
                sink.Write(entry);
            }
        }

        public void Detail(string system, string message, ulong? entityId = null) => Write(LogLevel.Detail, system, message, entityId);
        public void Info(string system, string message, ulong? entityId = null) => Write(LogLevel.Info, system, message, entityId);
        public void Warning(string system, string message, ulong? entityId = null) => Write(LogLevel.Warning, system, message, entityId);
        public void Error(string system, string message, ulong? entityId = null) => Write(LogLevel.Error, system, message, entityId);
    }
}
