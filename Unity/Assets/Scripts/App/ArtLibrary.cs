#nullable enable
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace MonsterClinic.App
{
    /// <summary>
    /// Laedt die Grafiken aus dem Ordner Art neben dem Unity-Projekt zur Laufzeit und schneidet daraus Sprites.
    /// ZWISCHENSTAND (Regel 6): Fuer K4 werden die PNGs direkt gelesen, damit Grafiken ohne Import-Schritt
    /// sofort im Spiel erscheinen. Fuer ein ausgeliefertes Spiel kommen sie spaeter als Unity-Assets in einen Sprite-Atlas.
    /// Fehlt eine Datei, liefert die Bibliothek null und das Spiel zeichnet einen Platzhalter.
    /// </summary>
    public sealed class ArtLibrary
    {
        public const float PixelsPerUnit = 256f;
        public const int TileWidth = 256;
        public const int TileHeight = 128;

        private readonly string? _root;
        private readonly Dictionary<string, Texture2D?> _textures = new Dictionary<string, Texture2D?>();
        private readonly Dictionary<string, Sprite?> _sprites = new Dictionary<string, Sprite?>();

        public ArtLibrary(string startDirectory)
        {
            for (DirectoryInfo? d = new DirectoryInfo(startDirectory); d != null; d = d.Parent)
            {
                string candidate = Path.Combine(d.FullName, "Art");
                if (Directory.Exists(Path.Combine(candidate, "Floors")))
                {
                    _root = candidate;
                    break;
                }
            }
            if (_root == null) Debug.LogWarning($"[Art] Kein Ordner Art/Floors oberhalb von {startDirectory} gefunden – es werden Platzhalter gezeichnet.");
        }

        public string? Root => _root;

        /// <summary>Textur aus Art/&lt;relativePath&gt; oder null, wenn die Datei fehlt.</summary>
        public Texture2D? Texture(string relativePath)
        {
            if (_textures.TryGetValue(relativePath, out Texture2D? cached)) return cached;
            Texture2D? tex = null;
            string? file = _root == null ? null : Path.Combine(_root, relativePath);
            if (file != null && File.Exists(file))
            {
                byte[] bytes = File.ReadAllBytes(file);
                if (bytes.Length > 200 && bytes[0] == 0x89)
                {
                    tex = new Texture2D(2, 2, TextureFormat.RGBA32, true);
                    if (tex.LoadImage(bytes, false))
                    {
                        tex.name = Path.GetFileNameWithoutExtension(file);
                        tex.wrapMode = TextureWrapMode.Clamp;
                        tex.filterMode = FilterMode.Bilinear;
                        tex.anisoLevel = 1;
                        tex.Apply(true, true);
                    }
                    else
                    {
                        Object.Destroy(tex);
                        tex = null;
                    }
                }
                if (tex == null) Debug.LogWarning($"[Art] {relativePath} ist kein lesbares PNG (Git LFS: 'git lfs pull' ausfuehren?).");
            }
            else
            {
                Debug.LogWarning($"[Art] {relativePath} fehlt – Platzhalter wird gezeichnet.");
            }
            _textures[relativePath] = tex;
            return tex;
        }

        /// <summary>
        /// Bodenkachel aus einem Atlas von Floor_to_iso.py: Rauten 256 x 128, Spalte = x, Zeile = y (oben beginnend).
        /// Drehpunkt ist die Rautenmitte.
        /// </summary>
        public Sprite? FloorTile(string relativePath, int tx, int ty)
        {
            string key = $"{relativePath}#{tx},{ty}";
            if (_sprites.TryGetValue(key, out Sprite? s)) return s;
            Texture2D? tex = Texture(relativePath);
            Sprite? sprite = null;
            if (tex != null)
            {
                int n = tex.width / TileWidth;
                tx = ((tx % n) + n) % n;
                ty = ((ty % n) + n) % n;
                var rect = new Rect(tx * TileWidth, tex.height - (ty + 1) * TileHeight, TileWidth, TileHeight);
                sprite = Sprite.Create(tex, rect, new Vector2(0.5f, 0.5f), PixelsPerUnit, 0, SpriteMeshType.FullRect);
            }
            _sprites[key] = sprite;
            return sprite;
        }

        /// <summary>Kantenlaenge eines Bodenatlas in Kacheln (4 oder 8); 0, wenn die Datei fehlt.</summary>
        public int FloorBlockSize(string relativePath)
        {
            Texture2D? tex = Texture(relativePath);
            return tex == null ? 0 : tex.width / TileWidth;
        }

        /// <summary>Eine von vier Ansichten eines Objekts (Reihenfolge vl, vr, hl, hr), Drehpunkt unten mittig.</summary>
        public Sprite? ObjectView(string relativePath, int view)
        {
            string key = $"{relativePath}#v{view}";
            if (_sprites.TryGetValue(key, out Sprite? s)) return s;
            Texture2D? tex = Texture(relativePath);
            Sprite? sprite = null;
            if (tex != null)
            {
                int w = tex.width / 4;
                sprite = Sprite.Create(tex, new Rect(view * w, 0, w, tex.height), new Vector2(0.5f, 0f), PixelsPerUnit, 0, SpriteMeshType.Tight);
            }
            _sprites[key] = sprite;
            return sprite;
        }

        /// <summary>Einfarbige Platzhalterfigur (Kapsel mit Rand und Augen), Drehpunkt unten mittig.</summary>
        public static Sprite MakeFigure(Color body, Color outline, bool eyes)
        {
            const int w = 48, h = 80;
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            var px = new Color32[w * h];
            float r = w / 2f - 1f;
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    float cx = x + 0.5f - w / 2f;
                    float cy = Mathf.Clamp(y + 0.5f, r + 1f, h - r - 1f);
                    float d = Mathf.Sqrt(cx * cx + (y + 0.5f - cy) * (y + 0.5f - cy));
                    Color c = d > r ? Color.clear : d > r - 3f ? outline : body;
                    if (d <= r && d > r - 1f) c.a *= r - d;
                    if (eyes && d < r - 3f && (y > h - 30 && y < h - 20) && (Mathf.Abs(cx + 8f) < 3.5f || Mathf.Abs(cx - 8f) < 3.5f))
                        c = new Color(0.1f, 0.06f, 0.1f, 1f);
                    px[y * w + x] = c;
                }
            tex.SetPixels32(px);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, w, h), new Vector2(0.5f, 0f), 200f);
        }

        /// <summary>Weicher ovaler Schatten unter Figuren.</summary>
        public static Sprite MakeShadow()
        {
            const int w = 64, h = 32;
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            var px = new Color32[w * h];
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    float dx = (x + 0.5f - w / 2f) / (w / 2f), dy = (y + 0.5f - h / 2f) / (h / 2f);
                    float a = Mathf.Clamp01(1f - Mathf.Sqrt(dx * dx + dy * dy));
                    px[y * w + x] = new Color(0f, 0f, 0f, a * 0.45f);
                }
            tex.SetPixels32(px);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, w, h), new Vector2(0.5f, 0.5f), 256f);
        }

        /// <summary>Unbeleuchtetes Material fuer Sprites und Wandflaechen (URP 2D, sonst eingebauter Sprite-Shader).</summary>
        public static Material MakeUnlitMaterial()
        {
            Shader? shader = Shader.Find("Universal Render Pipeline/2D/Sprite-Unlit-Default") ?? Shader.Find("Sprites/Default");
            var m = new Material(shader) { name = "MonsterClinicUnlit" };
            m.mainTexture = Texture2D.whiteTexture;
            return m;
        }
    }
}
