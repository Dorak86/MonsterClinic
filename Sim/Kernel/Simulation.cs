using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using MonsterClinic.Sim.Data;
using MonsterClinic.Sim.Diagnostics;

namespace MonsterClinic.Sim.Kernel
{
    /// <summary>
    /// Ein Teilsystem der Simulation (Raster, Patienten, Wirtschaft ...).
    /// Jedes System meldet seinen Takt und Versatz und kann seinen Zustand vollstaendig speichern.
    /// </summary>
    public interface ISimSystem
    {
        /// <summary>Eindeutiger, stabiler Name; dient auch als Name des Zufallsstroms und als Schluessel im Spielstand.</summary>
        string Name { get; }

        /// <summary>Takt in Ticks: 1 = jeder Tick, 5 = jede Spielminute, 300 = jede Spielstunde.</summary>
        int IntervalTicks { get; }

        /// <summary>Versatz in Ticks, damit nicht alle langsamen Systeme im selben Tick rechnen.</summary>
        int OffsetTicks { get; }

        void Update(Simulation sim);

        JsonValue SaveState();

        void LoadState(JsonValue state);
    }

    /// <summary>
    /// Der Simulationskern (Pflichtenheft 3). Deterministisch: gleicher Startwert und gleiche Befehle
    /// ergeben denselben Verlauf und dieselbe Pruefsumme.
    /// </summary>
    public sealed class Simulation
    {
        public const int StateFormatVersion = 1;

        private readonly List<ISimSystem> _systems;
        private readonly Queue<ICommand> _pending = new Queue<ICommand>();
        private readonly List<CommandLogEntry> _commandLog = new List<CommandLogEntry>();

        public Simulation(TimeConfig time, ulong seed, IEnumerable<ISimSystem> systems)
            : this(time, new RandomStreams(seed), new IdAllocator(), 0, systems)
        {
        }

        private Simulation(TimeConfig time, RandomStreams random, IdAllocator ids, long tick, IEnumerable<ISimSystem> systems)
        {
            Time = time ?? throw new ArgumentNullException(nameof(time));
            Random = random;
            Ids = ids;
            Tick = tick;
            _systems = systems?.ToList() ?? throw new ArgumentNullException(nameof(systems));

            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (ISimSystem s in _systems)
            {
                if (!names.Add(s.Name)) throw new ArgumentException($"System '{s.Name}' ist doppelt registriert");
                if (s.IntervalTicks < 1) throw new ArgumentException($"System '{s.Name}': Takt muss mindestens 1 sein");
                if (s.OffsetTicks < 0 || s.OffsetTicks >= s.IntervalTicks) throw new ArgumentException($"System '{s.Name}': Versatz muss zwischen 0 und Takt-1 liegen");
            }

            Log = new SimLog(() => Tick);
        }

        /// <summary>Nummer des naechsten auszufuehrenden Ticks (= Anzahl bereits ausgefuehrter Ticks).</summary>
        public long Tick { get; private set; }

        public TimeConfig Time { get; }
        public GameTime Now => new GameTime(Tick, Time);
        public RandomStreams Random { get; }
        public IdAllocator Ids { get; }
        public EventBuffer Events { get; } = new EventBuffer();
        public SimLog Log { get; }
        public IReadOnlyList<CommandLogEntry> CommandLog => _commandLog;
        public IReadOnlyList<ISimSystem> Systems => _systems;

        public T GetSystem<T>() where T : class, ISimSystem =>
            _systems.OfType<T>().FirstOrDefault() ?? throw new InvalidOperationException($"System {typeof(T).Name} ist nicht registriert");

        /// <summary>Reiht einen Befehl ein. Er wird zu Beginn des naechsten Ticks oder sofort bei <see cref="ProcessPendingCommands"/> ausgefuehrt.</summary>
        public void Enqueue(ICommand command) => _pending.Enqueue(command ?? throw new ArgumentNullException(nameof(command)));

        /// <summary>
        /// Fuehrt alle eingereihten Befehle aus, ohne die Zeit weiterzudrehen.
        /// So wirken Bau- und Verwaltungsbefehle auch in der Pause (LOOP-06).
        /// </summary>
        public void ProcessPendingCommands()
        {
            while (_pending.Count > 0)
            {
                ICommand command = _pending.Dequeue();
                string description = command.Describe();
                CommandResult result = command.Validate(this);
                if (result.Accepted)
                {
                    command.Execute(this);
                    _commandLog.Add(new CommandLogEntry(Tick, description, true, string.Empty));
                }
                else
                {
                    _commandLog.Add(new CommandLogEntry(Tick, description, false, result.ReasonText));
                    Events.Publish(new CommandRejected(Tick, description, result));
                    Log.Info("Kernel", $"Befehl abgelehnt: {description} ({result.ReasonText})");
                }
            }
        }

        /// <summary>Fuehrt genau einen Tick aus.</summary>
        public void Step()
        {
            ProcessPendingCommands();
            PublishTimeEvents();

            foreach (ISimSystem system in _systems)
            {
                if (Tick >= system.OffsetTicks && (Tick - system.OffsetTicks) % system.IntervalTicks == 0)
                {
                    system.Update(this);
                }
            }

            Tick++;
        }

        public void Run(long ticks)
        {
            for (long i = 0; i < ticks; i++) Step();
        }

        private void PublishTimeEvents()
        {
            GameTime now = Now;
            if (!now.IsMinuteStart) return;
            if (now.MinuteOfDay == 0) Events.Publish(new DateChanged(Tick, now.Day));
            if (now.MinuteOfDay == Time.DayStartMinute) Events.Publish(new DayStarted(Tick, now.Day));
            if (now.MinuteOfDay == Time.NightStartMinute) Events.Publish(new NightStarted(Tick, now.Day));
        }

        /// <summary>Gesamtzustand als kanonisches JSON. Grundlage fuer Spielstand und Pruefsumme.</summary>
        public JsonValue SaveState()
        {
            if (_pending.Count > 0)
            {
                throw new InvalidOperationException("Speichern mit unausgefuehrten Befehlen ist nicht erlaubt; zuerst ProcessPendingCommands aufrufen");
            }

            JsonValue systems = JsonValue.NewObject();
            foreach (ISimSystem s in _systems)
            {
                systems.Set(s.Name, s.SaveState());
            }

            return JsonValue.NewObject()
                .Set("formatVersion", StateFormatVersion)
                .Set("tick", Tick)
                .Set("random", Random.SaveState())
                .Set("ids", Ids.SaveState())
                .Set("systems", systems);
        }

        /// <summary>
        /// Stellt eine Simulation aus einem gespeicherten Zustand wieder her.
        /// Die Systeme werden vom Aufrufer frisch erzeugt und muessen zu denen im Spielstand passen.
        /// </summary>
        public static Simulation LoadState(JsonValue state, TimeConfig time, IEnumerable<ISimSystem> systems)
        {
            long version = state.GetInt("formatVersion");
            if (version != StateFormatVersion)
            {
                throw new JsonFormatException($"Spielstand hat Formatversion {version}, erwartet {StateFormatVersion}");
            }

            var ids = new IdAllocator();
            ids.LoadState(state.Get("ids"));
            var sim = new Simulation(time, RandomStreams.LoadState(state.Get("random")), ids, state.GetInt("tick"), systems);

            JsonValue saved = state.Get("systems");
            var savedNames = saved.Fields.Select(f => f.Key).ToList();
            var expectedNames = sim._systems.Select(s => s.Name).ToList();
            if (!savedNames.SequenceEqual(expectedNames, StringComparer.Ordinal))
            {
                throw new JsonFormatException(
                    $"Systeme im Spielstand ({string.Join(", ", savedNames)}) passen nicht zu den erwarteten ({string.Join(", ", expectedNames)})");
            }

            foreach (ISimSystem s in sim._systems)
            {
                s.LoadState(saved.Get(s.Name));
            }

            return sim;
        }

        /// <summary>SHA-256 des kanonischen Gesamtzustands, als Hex-Text.</summary>
        public string Checksum() => Sha256Hex(SaveState().ToJson());

        internal static string Sha256Hex(string text)
        {
            using (SHA256 sha = SHA256.Create())
            {
                byte[] hash = sha.ComputeHash(Encoding.UTF8.GetBytes(text));
                var sb = new StringBuilder(hash.Length * 2);
                foreach (byte b in hash) sb.Append(b.ToString("x2"));
                return sb.ToString();
            }
        }
    }
}
