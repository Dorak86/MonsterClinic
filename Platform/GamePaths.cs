using System;
using System.IO;

namespace MonsterClinic.Platform
{
    /// <summary>
    /// Speicherorte (Pflichtenheft 4 und 5). Unter Windows:
    /// %USERPROFILE%\AppData\LocalLow\LeviaStudios\MonsterClinic.
    /// Auf anderen Systemen (Entwicklung, CI) ein gleichwertiger Ordner im Benutzerverzeichnis.
    /// </summary>
    public sealed class GamePaths
    {
        public GamePaths(string root)
        {
            Root = root ?? throw new ArgumentNullException(nameof(root));
        }

        public string Root { get; }
        public string Logs => Path.Combine(Root, "logs");
        public string Saves => Path.Combine(Root, "saves");
        public string Crashes => Path.Combine(Root, "crashes");

        public static GamePaths ForCurrentUser()
        {
            string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            string root = OperatingSystemIsWindows()
                ? Path.Combine(home, "AppData", "LocalLow", "LeviaStudios", "MonsterClinic")
                : Path.Combine(home, ".local", "share", "LeviaStudios", "MonsterClinic");
            return new GamePaths(root);
        }

        private static bool OperatingSystemIsWindows() =>
            Environment.OSVersion.Platform == PlatformID.Win32NT;
    }
}
