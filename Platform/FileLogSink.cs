using System;
using System.IO;
using System.Linq;
using System.Text;
using MonsterClinic.Sim.Diagnostics;

namespace MonsterClinic.Platform
{
    /// <summary>
    /// Schreibt Protokolleintraege mit Zeitstempel in eine Datei je Sitzung.
    /// Die letzten <see cref="SessionsKept"/> Sitzungen bleiben erhalten (Pflichtenheft 5).
    /// Haelt die letzten Zeilen fuer den Absturzbericht im Speicher.
    /// </summary>
    public sealed class FileLogSink : ILogSink, IDisposable
    {
        public const int SessionsKept = 5;
        private const int TailLines = 200;

        private readonly StreamWriter _writer;
        private readonly string[] _tail = new string[TailLines];
        private int _tailCount;
        private int _tailNext;
        private readonly object _lock = new object();

        public FileLogSink(string logDirectory, DateTime sessionStartUtc)
        {
            Directory.CreateDirectory(logDirectory);
            RemoveOldSessions(logDirectory);
            FilePath = Path.Combine(logDirectory, $"session_{sessionStartUtc:yyyyMMdd_HHmmss_fff}_{System.Diagnostics.Process.GetCurrentProcess().Id}.log");
            _writer = new StreamWriter(FilePath, append: false, new UTF8Encoding(false)) { AutoFlush = true };
        }

        public string FilePath { get; }

        public void Write(in LogEntry entry)
        {
            string line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {LevelTag(entry.Level)} {entry.FormatBody()}";
            lock (_lock)
            {
                _writer.WriteLine(line);
                _tail[_tailNext] = line;
                _tailNext = (_tailNext + 1) % TailLines;
                _tailCount = Math.Min(_tailCount + 1, TailLines);
            }
        }

        /// <summary>Die letzten Zeilen in zeitlicher Reihenfolge.</summary>
        public string[] GetTail()
        {
            lock (_lock)
            {
                var result = new string[_tailCount];
                int start = (_tailNext - _tailCount + TailLines) % TailLines;
                for (int i = 0; i < _tailCount; i++)
                {
                    result[i] = _tail[(start + i) % TailLines];
                }
                return result;
            }
        }

        public void Dispose() => _writer.Dispose();

        private static string LevelTag(LogLevel level) => level switch
        {
            LogLevel.Error => "FEHLER ",
            LogLevel.Warning => "WARNUNG",
            LogLevel.Info => "INFO   ",
            _ => "DETAIL ",
        };

        private static void RemoveOldSessions(string logDirectory)
        {
            // Platz fuer die neue Sitzung schaffen: hoechstens SessionsKept - 1 alte Dateien behalten.
            var old = new DirectoryInfo(logDirectory)
                .GetFiles("session_*.log")
                .OrderByDescending(f => f.Name, StringComparer.Ordinal)
                .Skip(SessionsKept - 1);
            foreach (FileInfo file in old)
            {
                file.Delete();
            }
        }
    }
}
