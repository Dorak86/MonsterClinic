using System;
using System.IO;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using MonsterClinic.Sim.Data;

namespace MonsterClinic.Platform
{
    /// <summary>Spielstand ist beschaedigt oder passt nicht zur Spielversion. Wird nie still geladen (SAV-04).</summary>
    public sealed class SaveFileException : Exception
    {
        public SaveFileException(string message, Exception? inner = null) : base(message, inner)
        {
        }
    }

    /// <summary>
    /// Spielstand-Datei (Pflichtenheft 4): Kennung "MCLS", Formatversion, Spielversion,
    /// SHA-256 der Nutzdaten, danach GZip-komprimiertes JSON.
    /// Geschrieben wird zuerst in eine temporaere Datei, die dann ersetzt, damit ein Absturz keinen Stand zerstoert.
    /// </summary>
    public static class SaveFile
    {
        public const int FileFormatVersion = 1;
        private static readonly byte[] Magic = { (byte)'M', (byte)'C', (byte)'L', (byte)'S' };

        public static void Write(string path, JsonValue state, string gameVersion)
        {
            byte[] payload = Encoding.UTF8.GetBytes(state.ToJson());
            byte[] hash;
            using (SHA256 sha = SHA256.Create()) hash = sha.ComputeHash(payload);

            string fullPath = Path.GetFullPath(path);
            string? dir = Path.GetDirectoryName(fullPath);
            if (dir != null) Directory.CreateDirectory(dir);
            string temp = fullPath + ".tmp";

            using (var file = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None))
            using (var writer = new BinaryWriter(file, Encoding.UTF8))
            {
                writer.Write(Magic);
                writer.Write(FileFormatVersion);
                writer.Write(gameVersion);
                writer.Write(hash);
                writer.Write(payload.Length);
                using (var gzip = new GZipStream(file, CompressionLevel.Optimal, leaveOpen: true))
                {
                    gzip.Write(payload, 0, payload.Length);
                }
                file.Flush(true);
            }

            if (File.Exists(fullPath))
            {
                File.Replace(temp, fullPath, null);
            }
            else
            {
                File.Move(temp, fullPath);
            }
        }

        public static JsonValue Read(string path)
        {
            byte[] payload;
            byte[] expectedHash;
            try
            {
                using (var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read))
                using (var reader = new BinaryReader(file, Encoding.UTF8))
                {
                    byte[] magic = reader.ReadBytes(4);
                    if (magic.Length != 4 || magic[0] != Magic[0] || magic[1] != Magic[1] || magic[2] != Magic[2] || magic[3] != Magic[3])
                    {
                        throw new SaveFileException("Keine Spielstand-Datei von THE MONSTER CLINIC");
                    }

                    int version = reader.ReadInt32();
                    if (version != FileFormatVersion)
                    {
                        throw new SaveFileException($"Unbekannte Spielstand-Version {version} (dieses Spiel liest Version {FileFormatVersion})");
                    }

                    reader.ReadString(); // Spielversion: wird ab Phase 5 fuer Migrationen genutzt
                    expectedHash = reader.ReadBytes(32);
                    int length = reader.ReadInt32();
                    if (expectedHash.Length != 32 || length < 0)
                    {
                        throw new SaveFileException("Spielstand ist abgeschnitten (Kopfteil unvollstaendig)");
                    }

                    payload = new byte[length];
                    using (var gzip = new GZipStream(file, CompressionMode.Decompress, leaveOpen: true))
                    {
                        int read = 0;
                        while (read < length)
                        {
                            int n = gzip.Read(payload, read, length - read);
                            if (n == 0) throw new SaveFileException("Spielstand ist abgeschnitten (Daten unvollstaendig)");
                            read += n;
                        }
                    }
                }
            }
            catch (SaveFileException)
            {
                throw;
            }
            catch (Exception ex) when (ex is EndOfStreamException || ex is InvalidDataException || ex is IOException)
            {
                throw new SaveFileException("Spielstand ist beschaedigt oder abgeschnitten", ex);
            }

            byte[] actualHash;
            using (SHA256 sha = SHA256.Create()) actualHash = sha.ComputeHash(payload);
            for (int i = 0; i < 32; i++)
            {
                if (actualHash[i] != expectedHash[i])
                {
                    throw new SaveFileException("Pruefsumme stimmt nicht: Spielstand ist beschaedigt");
                }
            }

            try
            {
                return JsonValue.Parse(Encoding.UTF8.GetString(payload));
            }
            catch (JsonFormatException ex)
            {
                throw new SaveFileException($"Spielstand-Inhalt ist ungueltig: {ex.Message}", ex);
            }
        }
    }
}
