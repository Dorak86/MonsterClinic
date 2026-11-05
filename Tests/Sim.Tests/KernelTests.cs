using System;
using System.IO;
using System.Linq;
using MonsterClinic.Platform;
using MonsterClinic.Sim.Data;
using MonsterClinic.Sim.Kernel;

namespace MonsterClinic.Sim.Tests
{
    /// <summary>Testsystem: zieht jeden Takt eine Zufallszahl und summiert sie auf.</summary>
    internal sealed class CounterSystem : ISimSystem
    {
        public CounterSystem(string name = "TestCounter", int interval = 1, int offset = 0)
        {
            Name = name;
            IntervalTicks = interval;
            OffsetTicks = offset;
        }

        public string Name { get; }
        public int IntervalTicks { get; }
        public int OffsetTicks { get; }
        public long Updates { get; private set; }
        public long Sum { get; set; }

        public void Update(Simulation sim)
        {
            Updates++;
            Sum += sim.Random.Get(Name).Range(1, 100);
        }

        public JsonValue SaveState() => JsonValue.NewObject().Set("updates", Updates).Set("sum", Sum);

        public void LoadState(JsonValue state)
        {
            Updates = state.GetInt("updates");
            Sum = state.GetInt("sum");
        }
    }

    internal sealed class AddCommand : ICommand
    {
        private readonly long _amount;

        public AddCommand(long amount) => _amount = amount;

        public string Describe() => $"Add {_amount}";

        public CommandResult Validate(Simulation sim) =>
            _amount > 0 ? CommandResult.Ok() : CommandResult.Reject("error.test_amount", "Betrag muss positiv sein");

        public void Execute(Simulation sim) => sim.GetSystem<CounterSystem>().Sum += _amount * 1000;
    }

    public sealed class KernelTests
    {
        // Balancing-Standardwerte aus Content/balancing/time.json (Start 06:00, Tag 06:00, Nacht 20:00)
        private static TimeConfig Time() => new TimeConfig(6 * 60, 6 * 60, 20 * 60);

        private static Simulation NewSim(ulong seed) => new Simulation(Time(), seed, new ISimSystem[] { new CounterSystem() });

        [Test]
        [Requirement("T1-01")]
        public void SpieltagHat7200Ticks()
        {
            var t0 = new GameTime(0, Time());
            var t1 = new GameTime(TimeConfig.TicksPerGameDay, Time());
            Assert.Equal(1L, t0.Day, "Tag bei Tick 0");
            Assert.Equal("06:00", $"{t0.Hour:00}:{t0.Minute:00}", "Uhrzeit bei Tick 0");
            Assert.Equal(2L, t1.Day, "Tag nach 7200 Ticks");
            Assert.Equal(t0.MinuteOfDay, t1.MinuteOfDay, "Uhrzeit nach genau einem Spieltag");
            Assert.Equal(7200, TimeConfig.TicksPerGameDay, "Ticks pro Spieltag");
            Assert.Equal(TimeConfig.TicksPerGameDay / TimeConfig.TicksPerRealSecondAtNormalSpeed, 12 * 60, "Echtzeit-Sekunden pro Spieltag bei 1x");
        }

        [Test]
        [Requirement("T1-01")]
        [Requirement("D-05")]
        public void TagUndNachtBeginnenZumRichtigenTick()
        {
            Simulation sim = NewSim(1);
            sim.Run(TimeConfig.TicksPerGameDay + 1);
            var events = sim.Events.Drain();
            long[] dayStarts = events.OfType<DayStarted>().Select(e => e.Tick).ToArray();
            long[] nightStarts = events.OfType<NightStarted>().Select(e => e.Tick).ToArray();
            long[] dateChanges = events.OfType<DateChanged>().Select(e => e.Tick).ToArray();

            Assert.Equal("0,7200", string.Join(",", dayStarts), "Tagbeginn (06:00)");
            Assert.Equal("4200", string.Join(",", nightStarts), "Nachtbeginn (20:00 = 14 Stunden nach Start)");
            Assert.Equal("5400", string.Join(",", dateChanges), "Mitternacht (18 Stunden nach Start)");
            Assert.True(new GameTime(4199, Time()).IsNight == false, "19:59 ist Tag");
            Assert.True(new GameTime(4200, Time()).IsNight, "20:00 ist Nacht");
            Assert.True(new GameTime(7199, Time()).IsNight, "05:59 ist Nacht");
        }

        [Test]
        [Requirement("T1-02")]
        [Requirement("LOOP-04")]
        [Requirement("LOOP-05")]
        public void GeschwindigkeitenFuehrenErwarteteTickzahlAus()
        {
            foreach ((double speed, int expected) in new[] { (0.5, 5), (1.0, 10), (2.0, 20), (4.0, 40), (8.0, 80) })
            {
                Simulation sim = NewSim(1);
                var runner = new SimulationRunner(sim);
                runner.SetSpeed(speed);
                int total = 0;
                for (int frame = 0; frame < 60; frame++) total += runner.Advance(1.0 / 60.0);
                Assert.True(Math.Abs(total - expected) <= 1, $"Geschwindigkeit {speed}: erwartet {expected} Ticks pro Sekunde, waren {total}");
                Assert.Equal((long)total, sim.Tick, $"Tick-Zaehler bei {speed}x");
            }

            Simulation paused = NewSim(1);
            var pausedRunner = new SimulationRunner(paused);
            pausedRunner.SetPaused(true);
            Assert.Equal(0, pausedRunner.Advance(10.0), "Ticks in der Pause");
            Assert.Throws<ArgumentOutOfRangeException>(() => pausedRunner.SetSpeed(9.0), "Geschwindigkeit ueber 8x");
        }

        [Test]
        [Requirement("T1-02")]
        public void LangsamerRechnerSenktGeschwindigkeitStattTicksZuUeberspringen()
        {
            Simulation sim = NewSim(1);
            var runner = new SimulationRunner(sim, maxTicksPerFrame: 20);
            runner.SetSpeed(8.0);
            int ticks = runner.Advance(2.0); // ein Bild von 2 Sekunden: 160 Ticks waeren faellig
            Assert.Equal(20, ticks, "Ticks im ueberlangen Bild");
            Assert.True(runner.ActualSpeed < runner.Speed, "Tatsaechliche Geschwindigkeit wird kleiner angezeigt");
            Assert.Equal(1, runner.Advance(0.02), "Rueckstand wurde verworfen, nicht nachgeholt (0,02 s bei 8x = 1,6 Ticks)");
        }

        [Test]
        [Requirement("T1-03")]
        [Requirement("TEC-01")]
        public void GleicherStartwertErgibtGleichePruefsumme()
        {
            string a = RunScenario(42), b = RunScenario(42), c = RunScenario(43);
            Assert.Equal(a, b, "Pruefsumme bei gleichem Startwert");
            Assert.NotEqual(a, c, "Pruefsumme bei anderem Startwert");
        }

        private static string RunScenario(ulong seed)
        {
            Simulation sim = new Simulation(Time(), seed, new ISimSystem[]
            {
                new CounterSystem("Schnell", 1, 0),
                new CounterSystem("Minuetlich", TimeConfig.TicksPerGameMinute, 2),
            });
            for (int i = 0; i < 10; i++)
            {
                sim.Run(1000);
                sim.Enqueue(new AddCommand(i + 1));
            }
            sim.ProcessPendingCommands();
            return sim.Checksum();
        }

        [Test]
        [Requirement("Pflichtenheft 3")]
        public void NeuerZufallsstromAendertAndereFolgenNicht()
        {
            var a = new RandomStreams(7);
            var b = new RandomStreams(7);
            b.Get("NeuesSystem").NextULong();
            Assert.Equal(a.Get("Patienten").NextULong(), b.Get("Patienten").NextULong(), "Folge des Stroms 'Patienten'");
        }

        [Test]
        [Requirement("Pflichtenheft 3")]
        public void SystemeLaufenImEigenenTaktMitVersatz()
        {
            var minute = new CounterSystem("Minute", 5, 2);
            var sim = new Simulation(Time(), 1, new ISimSystem[] { minute });
            sim.Run(20);
            Assert.Equal(4L, minute.Updates, "Ausfuehrungen in 20 Ticks bei Takt 5 (Ticks 2, 7, 12, 17)");
            Assert.Throws<ArgumentException>(() => new Simulation(Time(), 1, new ISimSystem[] { new CounterSystem("X", 5, 5) }), "Versatz gleich Takt");
            Assert.Throws<ArgumentException>(() => new Simulation(Time(), 1, new ISimSystem[] { new CounterSystem("X"), new CounterSystem("X") }), "doppelter Systemname");
        }

        [Test]
        [Requirement("UI-05")]
        public void AbgelehnterBefehlNenntGrundUndAendertNichts()
        {
            Simulation sim = NewSim(1);
            string before = sim.Checksum();
            sim.Enqueue(new AddCommand(-5));
            sim.ProcessPendingCommands();
            CommandLogEntry entry = sim.CommandLog.Single();
            Assert.True(!entry.Accepted, "Befehl abgelehnt");
            Assert.Equal("Betrag muss positiv sein", entry.Reason, "Grund im Protokoll");
            Assert.Equal("error.test_amount", sim.Events.Drain().OfType<CommandRejected>().Single().Result.ReasonKey, "Sprachschluessel der Meldung");
            Assert.Equal(before, sim.Checksum(), "Zustand unveraendert");
        }

        [Test]
        [Requirement("T1-14")]
        [Requirement("LOOP-06")]
        public void BefehleWirkenInDerPause()
        {
            Simulation sim = NewSim(1);
            var runner = new SimulationRunner(sim);
            runner.SetPaused(true);
            sim.Enqueue(new AddCommand(3));
            runner.Advance(0.5);
            Assert.Equal(3000L, sim.GetSystem<CounterSystem>().Sum, "Befehl in der Pause ausgefuehrt");
            Assert.Equal(0L, sim.Tick, "Zeit in der Pause angehalten");
        }

        [Test]
        [Requirement("T1-04")]
        [Requirement("SAV-01")]
        public void SpeichernUndLadenErgibtIdentischenVerlauf()
        {
            Simulation original = NewSim(99);
            original.Run(5000);
            string path = TempFile();
            SaveFile.Write(path, original.SaveState(), "test");

            Simulation loaded = Simulation.LoadState(SaveFile.Read(path), Time(), new ISimSystem[] { new CounterSystem() });
            Assert.Equal(original.Checksum(), loaded.Checksum(), "Pruefsumme direkt nach dem Laden");
            Assert.Equal(original.Tick, loaded.Tick, "Tick nach dem Laden");

            original.Run(1000);
            loaded.Run(1000);
            Assert.Equal(original.Checksum(), loaded.Checksum(), "Pruefsumme nach weiteren 1000 Ticks");
            SaveFile.Write(path, loaded.SaveState(), "test"); // Ueberschreiben eines vorhandenen Stands
            Assert.Equal(loaded.Checksum(), Simulation.LoadState(SaveFile.Read(path), Time(), new ISimSystem[] { new CounterSystem() }).Checksum(), "Pruefsumme nach Ueberschreiben");
        }

        [Test]
        [Requirement("T1-05")]
        [Requirement("SAV-04")]
        public void BeschaedigteSpielstaendeWerdenAbgewiesen()
        {
            Simulation sim = NewSim(5);
            sim.Run(300);
            string path = TempFile();
            SaveFile.Write(path, sim.SaveState(), "test");
            byte[] good = File.ReadAllBytes(path);

            byte[] flipped = (byte[])good.Clone();
            flipped[flipped.Length - 10] ^= 0xFF;
            ExpectRejected(flipped, "veraendertes Byte in den Daten");

            ExpectRejected(good.Take(good.Length / 2).ToArray(), "abgeschnittene Datei");

            byte[] wrongVersion = (byte[])good.Clone();
            wrongVersion[4] = 99;
            ExpectRejected(wrongVersion, "unbekannte Version");

            ExpectRejected(new byte[] { 1, 2, 3 }, "fremde Datei");

            byte[] wrongHash = (byte[])good.Clone();
            int hashOffset = 4 + 4 + 1 + "test".Length;
            wrongHash[hashOffset] ^= 0x01;
            ExpectRejected(wrongHash, "falsche Pruefsumme im Kopfteil");
        }

        private static void ExpectRejected(byte[] content, string what)
        {
            string path = TempFile();
            File.WriteAllBytes(path, content);
            Assert.Throws<SaveFileException>(() => SaveFile.Read(path), what);
        }

        [Test]
        [Requirement("T1-04")]
        public void SpeichernMitOffenenBefehlenIstNichtErlaubt()
        {
            Simulation sim = NewSim(1);
            sim.Enqueue(new AddCommand(1));
            Assert.Throws<InvalidOperationException>(() => sim.SaveState(), "Speichern mit offenem Befehl");
        }

        [Test]
        [Requirement("T1-04")]
        public void LadenMitAnderenSystemenWirdAbgewiesen()
        {
            JsonValue state = NewSim(1).SaveState();
            Assert.Throws<JsonFormatException>(() => Simulation.LoadState(state, Time(), new ISimSystem[] { new CounterSystem("Anders") }), "abweichende Systeme");
        }

        private static string TempFile() =>
            Path.Combine(Path.GetTempPath(), "mc-tests", Guid.NewGuid().ToString("N") + ".mcsave");
    }

    public sealed class JsonTests
    {
        [Test]
        [Requirement("Pflichtenheft 4")]
        public void JsonIstKanonischUndUmkehrbar()
        {
            JsonValue v = JsonValue.NewObject()
                .Set("b", 1).Set("a", "Größe \"x\"\n").Set("c", JsonValue.NewArray().Add(JsonValue.From(true)).Add(JsonValue.Null).Add(JsonValue.From(-9000000000)));
            string text = v.ToJson();
            Assert.Equal("{\"b\":1,\"a\":\"Größe \\\"x\\\"\\n\",\"c\":[true,null,-9000000000]}", text, "kanonische Ausgabe");
            Assert.Equal(text, JsonValue.Parse(text).ToJson(), "Lesen und erneut Schreiben");
        }

        [Test]
        [Requirement("Code-Regel 2")]
        public void GleitkommazahlenUndFehlerWerdenAbgewiesen()
        {
            Assert.Throws<JsonFormatException>(() => JsonValue.Parse("{\"x\":0.5}"), "Gleitkommazahl");
            Assert.Throws<JsonFormatException>(() => JsonValue.Parse("{\"x\":1,\"x\":2}"), "doppeltes Feld");
            Assert.Throws<JsonFormatException>(() => JsonValue.Parse("{\"x\":1"), "unvollstaendig");
            Assert.Throws<JsonFormatException>(() => JsonValue.Parse("{}").GetInt("fehlt"), "fehlendes Pflichtfeld");
        }
    }
}
