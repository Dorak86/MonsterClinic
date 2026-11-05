#nullable enable
using UnityEngine;

namespace MonsterClinic.App
{
    /// <summary>
    /// Isometrische Projektion 2:1 und Kameradrehung in 90-Grad-Schritten (Pflichtenheft 6, P-01).
    /// Weltkoordinaten sind Kacheln der Simulation (Ecke oben links = (x, y)); Ansichtskoordinaten sind
    /// dieselben Kacheln nach der Drehung. Eine Kachel ist auf dem Bildschirm 1 Einheit breit und 0,5 hoch
    /// (256 x 128 Pixel Arbeitsaufloesung bei 256 Pixel je Einheit).
    /// Gleitkommazahlen sind hier erlaubt: das ist Darstellung, kein Spielzustand.
    /// </summary>
    public sealed class IsoView
    {
        public IsoView(int lotWidth, int lotHeight)
        {
            LotWidth = lotWidth;
            LotHeight = lotHeight;
        }

        public int LotWidth { get; }
        public int LotHeight { get; }

        /// <summary>0 bis 3, je 90 Grad.</summary>
        public int Rotation { get; private set; }

        public void Rotate(int steps) => Rotation = ((Rotation + steps) % 4 + 4) % 4;

        /// <summary>Weltpunkt in Ansichtskoordinaten.</summary>
        public Vector2 ToView(float x, float y)
        {
            switch (Rotation)
            {
                case 1: return new Vector2(LotHeight - y, x);
                case 2: return new Vector2(LotWidth - x, LotHeight - y);
                case 3: return new Vector2(y, LotWidth - x);
                default: return new Vector2(x, y);
            }
        }

        public Vector2 ToView(Vector2 p) => ToView(p.x, p.y);

        /// <summary>Ansichtspunkt zurueck in Weltkoordinaten.</summary>
        public Vector2 ToWorld(Vector2 v)
        {
            switch (Rotation)
            {
                case 1: return new Vector2(v.y, LotHeight - v.x);
                case 2: return new Vector2(LotWidth - v.x, LotHeight - v.y);
                case 3: return new Vector2(LotWidth - v.y, v.x);
                default: return v;
            }
        }

        /// <summary>Richtung in der Welt als Richtung in der Ansicht.</summary>
        public Vector2Int RotateDir(Vector2Int d)
        {
            switch (Rotation)
            {
                case 1: return new Vector2Int(-d.y, d.x);
                case 2: return new Vector2Int(-d.x, -d.y);
                case 3: return new Vector2Int(d.y, -d.x);
                default: return d;
            }
        }

        /// <summary>Ansichtskachel einer Weltkachel (obere Ecke der Raute).</summary>
        public Vector2Int ViewTile(int x, int y)
        {
            Vector2 c = ToView(x + 0.5f, y + 0.5f);
            return new Vector2Int(Mathf.FloorToInt(c.x), Mathf.FloorToInt(c.y));
        }

        /// <summary>Ansichtspunkt mit Hoehe z (in Bildschirmeinheiten) auf dem Bildschirm.</summary>
        public static Vector3 Screen(float vx, float vy, float z = 0f) => new Vector3((vx - vy) * 0.5f, -(vx + vy) * 0.25f + z, 0f);

        public static Vector3 Screen(Vector2 v, float z = 0f) => Screen(v.x, v.y, z);

        /// <summary>Bildschirmpunkt (Hoehe 0) zurueck in Ansichtskoordinaten.</summary>
        public static Vector2 FromScreen(Vector2 s) => new Vector2(s.x - 2f * s.y, -s.x - 2f * s.y);

        /// <summary>Zeichenreihenfolge aus der Tiefe (Summe der Ansichtskoordinaten): weiter vorn = spaeter.</summary>
        public static int Order(float depth) => Mathf.RoundToInt(depth * 20f);
    }
}
