using System;
using System.IO;
using MonsterClinic.Platform;
using MonsterClinic.Sim.Diagnostics;

namespace MonsterClinic.SimCli
{
    /// <summary>
    /// simcli &lt;befehl&gt; [--root &lt;ordner&gt;]
    ///   log-test    schreibt Beispielzeilen mit Tick, System und Entitaet (T0-05)
    ///   crash-test  loest eine Ausnahme aus und schreibt einen Absturzbericht (T0-05)
    /// Exitcodes: 0 = ok, 2 = Bedienfehler, 3 = Absturz (Bericht geschrieben)
    /// </summary>
    internal static class Program
    {
        private static int Main(string[] args)
        {
            if (args.Length == 0)
            {
                Console.Error.WriteLine("Aufruf: simcli <log-test|crash-test> [--root <ordner>]");
                return 2;
            }

            GamePaths paths = ResolvePaths(args);
            long tick = 0;
            using var fileSink = new FileLogSink(paths.Logs, DateTime.UtcNow);
            var log = new SimLog(() => tick);
            log.AddSink(fileSink);
            log.AddSink(new ConsoleSink());

            var crash = new CrashReporter(paths.Crashes, fileSink.GetTail);
            crash.Install();

            try
            {
                switch (args[0])
                {
                    case "log-test":
                        tick = 12345;
                        log.Info("Grid", "Wand an Kante (12,7,N) gesetzt", 4711);
                        log.Warning("Kernel", "Testwarnung ohne Entitaet");
                        Console.WriteLine($"Logdatei: {fileSink.FilePath}");
                        return 0;

                    case "crash-test":
                        tick = 42;
                        log.Info("SimCli", "Erzwinge Testabsturz");
                        throw new InvalidOperationException("Absichtlicher Testabsturz (T0-05)");

                    case "map":
                        return ClinicMap.Print(args);

                    case "run":
                        return ClinicRun.Run(args);

                    default:
                        Console.Error.WriteLine($"Unbekannter Befehl: {args[0]}");
                        return 2;
                }
            }
            catch (Exception ex)
            {
                log.Error("SimCli", $"Unbehandelte Ausnahme: {ex.Message}");
                string report = crash.Write(ex);
                Console.Error.WriteLine($"Absturzbericht: {report}");
                return 3;
            }
        }

        private static GamePaths ResolvePaths(string[] args)
        {
            int index = Array.IndexOf(args, "--root");
            return index >= 0 && index + 1 < args.Length
                ? new GamePaths(Path.GetFullPath(args[index + 1]))
                : GamePaths.ForCurrentUser();
        }

        private sealed class ConsoleSink : ILogSink
        {
            public void Write(in LogEntry entry) => Console.WriteLine(entry.FormatBody());
        }
    }
}
