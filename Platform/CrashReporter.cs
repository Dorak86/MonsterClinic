using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace MonsterClinic.Platform
{
    /// <summary>
    /// Schreibt bei einer unbehandelten Ausnahme einen Absturzbericht (Pflichtenheft 5, TEC-02):
    /// Ausnahme, Log-Ende, Startwert, Befehlsprotokoll und Systeminformationen.
    /// Startwert und Befehlsprotokoll liefert ab Phase 1 der Simulationskern.
    /// </summary>
    public sealed class CrashReporter
    {
        private readonly string _crashDirectory;
        private readonly Func<string[]> _logTail;

        public CrashReporter(string crashDirectory, Func<string[]> logTail)
        {
            _crashDirectory = crashDirectory ?? throw new ArgumentNullException(nameof(crashDirectory));
            _logTail = logTail ?? throw new ArgumentNullException(nameof(logTail));
        }

        /// <summary>Startwert der laufenden Simulation, falls bekannt.</summary>
        public ulong? Seed { get; set; }

        /// <summary>Liefert das Befehlsprotokoll der Sitzung, falls vorhanden.</summary>
        public Func<IEnumerable<string>>? CommandLog { get; set; }

        /// <summary>Haengt den Bericht an unbehandelte Ausnahmen der aktuellen AppDomain.</summary>
        public void Install()
        {
            AppDomain.CurrentDomain.UnhandledException += (_, args) =>
            {
                if (args.ExceptionObject is Exception ex)
                {
                    Write(ex);
                }
            };
        }

        /// <summary>Schreibt den Bericht und gibt seinen Pfad zurueck.</summary>
        public string Write(Exception exception)
        {
            Directory.CreateDirectory(_crashDirectory);
            string path = Path.Combine(_crashDirectory, $"crash_{DateTime.UtcNow:yyyyMMdd_HHmmss_fff}.txt");

            var sb = new StringBuilder();
            sb.AppendLine("THE MONSTER CLINIC - Absturzbericht");
            sb.AppendLine($"Zeit (UTC): {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}");
            sb.AppendLine($"Version: {typeof(CrashReporter).Assembly.GetName().Version}");
            sb.AppendLine($"System: {Environment.OSVersion}, 64 Bit: {Environment.Is64BitProcess}, Kerne: {Environment.ProcessorCount}");
            sb.AppendLine($"Startwert: {(Seed.HasValue ? Seed.Value.ToString() : "unbekannt")}");
            sb.AppendLine();
            sb.AppendLine("== Ausnahme ==");
            sb.AppendLine(exception.ToString());
            sb.AppendLine();
            sb.AppendLine("== Letzte Logzeilen ==");
            foreach (string line in _logTail())
            {
                sb.AppendLine(line);
            }
            sb.AppendLine();
            sb.AppendLine("== Befehlsprotokoll ==");
            if (CommandLog == null)
            {
                sb.AppendLine("(nicht verfuegbar)");
            }
            else
            {
                foreach (string command in CommandLog())
                {
                    sb.AppendLine(command);
                }
            }

            File.WriteAllText(path, sb.ToString(), new UTF8Encoding(false));
            return path;
        }
    }
}
