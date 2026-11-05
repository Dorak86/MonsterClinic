using System;
using System.Collections.Generic;

namespace MonsterClinic.Sim.Kernel
{
    /// <summary>Ergebnis der Pruefung eines Befehls. Ein abgelehnter Befehl nennt einen verstaendlichen Grund (UI-05).</summary>
    public readonly struct CommandResult
    {
        private CommandResult(bool accepted, string reasonKey, string reasonText)
        {
            Accepted = accepted;
            ReasonKey = reasonKey;
            ReasonText = reasonText;
        }

        public bool Accepted { get; }

        /// <summary>Sprachschluessel fuer die Meldung im Spiel, z. B. "error.edge_occupied".</summary>
        public string ReasonKey { get; }

        /// <summary>Deutscher Klartext fuer Log und Tests.</summary>
        public string ReasonText { get; }

        public static CommandResult Ok() => new CommandResult(true, string.Empty, string.Empty);
        public static CommandResult Reject(string reasonKey, string reasonText) => new CommandResult(false, reasonKey, reasonText);
    }

    /// <summary>
    /// Ein Befehl an den Kern (Pflichtenheft 3). Spieleraktionen werden nur ueber Befehle ausgefuehrt.
    /// <see cref="Describe"/> muss den Befehl vollstaendig beschreiben, damit das Befehlsprotokoll eine Sitzung nachvollziehbar macht.
    /// </summary>
    public interface ICommand
    {
        string Describe();
        CommandResult Validate(Simulation sim);
        void Execute(Simulation sim);
    }

    /// <summary>Eintrag im Befehlsprotokoll.</summary>
    public readonly struct CommandLogEntry
    {
        public CommandLogEntry(long tick, string description, bool accepted, string reason)
        {
            Tick = tick;
            Description = description;
            Accepted = accepted;
            Reason = reason;
        }

        public long Tick { get; }
        public string Description { get; }
        public bool Accepted { get; }
        public string Reason { get; }

        public override string ToString() =>
            Accepted ? $"[Tick {Tick}] {Description}" : $"[Tick {Tick}] {Description} ABGELEHNT: {Reason}";
    }

    /// <summary>Unveraenderliches Domaenen-Ereignis. Die Darstellung reagiert nur auf Ereignisse.</summary>
    public interface IDomainEvent
    {
        long Tick { get; }
    }

    public sealed class CommandRejected : IDomainEvent
    {
        public CommandRejected(long tick, string command, CommandResult result)
        {
            Tick = tick;
            Command = command;
            Result = result;
        }

        public long Tick { get; }
        public string Command { get; }
        public CommandResult Result { get; }
    }

    /// <summary>Morgens, wenn der Tag beginnt (Balancing: Tagbeginn).</summary>
    public sealed class DayStarted : IDomainEvent
    {
        public DayStarted(long tick, long day)
        {
            Tick = tick;
            Day = day;
        }

        public long Tick { get; }
        public long Day { get; }
    }

    /// <summary>Abends, wenn die Nacht beginnt (Kreaturen der Nacht werden aktiv, D-05).</summary>
    public sealed class NightStarted : IDomainEvent
    {
        public NightStarted(long tick, long day)
        {
            Tick = tick;
            Day = day;
        }

        public long Tick { get; }
        public long Day { get; }
    }

    /// <summary>Um Mitternacht beginnt ein neuer Kalendertag.</summary>
    public sealed class DateChanged : IDomainEvent
    {
        public DateChanged(long tick, long day)
        {
            Tick = tick;
            Day = day;
        }

        public long Tick { get; }
        public long Day { get; }
    }

    /// <summary>Sammelt die Ereignisse eines Ticks fuer die Anwendungsschicht.</summary>
    public sealed class EventBuffer
    {
        private readonly List<IDomainEvent> _pending = new List<IDomainEvent>();

        public void Publish(IDomainEvent e) => _pending.Add(e ?? throw new ArgumentNullException(nameof(e)));

        /// <summary>Gibt alle gesammelten Ereignisse in Entstehungsreihenfolge zurueck und leert den Puffer.</summary>
        public IReadOnlyList<IDomainEvent> Drain()
        {
            IDomainEvent[] result = _pending.ToArray();
            _pending.Clear();
            return result;
        }
    }
}
