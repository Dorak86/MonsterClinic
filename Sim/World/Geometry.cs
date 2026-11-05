using System;
using MonsterClinic.Sim.Data;

namespace MonsterClinic.Sim.World
{
    /// <summary>Kachel im Quadratraster (Pflichtenheft 2). x waechst nach rechts unten, y nach links unten.</summary>
    public readonly struct Tile : IEquatable<Tile>
    {
        public Tile(int x, int y)
        {
            X = x;
            Y = y;
        }

        public int X { get; }
        public int Y { get; }

        public Tile Offset(int dx, int dy) => new Tile(X + dx, Y + dy);

        public bool Equals(Tile other) => X == other.X && Y == other.Y;
        public override bool Equals(object? obj) => obj is Tile t && Equals(t);
        public override int GetHashCode() => (X * 397) ^ Y;
        public override string ToString() => $"({X},{Y})";
        public static bool operator ==(Tile a, Tile b) => a.Equals(b);
        public static bool operator !=(Tile a, Tile b) => !a.Equals(b);
    }

    /// <summary>Seite einer Kachel, auf der eine Kante liegt. Jede Kachel besitzt ihre Nord- und Westkante (Pflichtenheft 2).</summary>
    public enum EdgeSide
    {
        North = 0,
        West = 1,
    }

    /// <summary>
    /// Kante zwischen zwei Kacheln. Nordkante von (x,y) trennt (x,y) und (x,y-1); Westkante trennt (x,y) und (x-1,y).
    /// Schraege Waende nach dem MVP erhalten eine eigene Kantenart (A-07); das Format laesst dafuer Platz.
    /// </summary>
    public readonly struct Edge : IEquatable<Edge>, IComparable<Edge>
    {
        public Edge(int x, int y, EdgeSide side)
        {
            X = x;
            Y = y;
            Side = side;
        }

        public int X { get; }
        public int Y { get; }
        public EdgeSide Side { get; }

        /// <summary>Die beiden Kacheln, die die Kante trennt.</summary>
        public Tile A => new Tile(X, Y);
        public Tile B => Side == EdgeSide.North ? new Tile(X, Y - 1) : new Tile(X - 1, Y);

        /// <summary>Kante zwischen zwei orthogonal benachbarten Kacheln.</summary>
        public static Edge Between(Tile a, Tile b)
        {
            int dx = b.X - a.X, dy = b.Y - a.Y;
            if (dx == 0 && dy == -1) return new Edge(a.X, a.Y, EdgeSide.North);
            if (dx == 0 && dy == 1) return new Edge(b.X, b.Y, EdgeSide.North);
            if (dx == -1 && dy == 0) return new Edge(a.X, a.Y, EdgeSide.West);
            if (dx == 1 && dy == 0) return new Edge(b.X, b.Y, EdgeSide.West);
            throw new ArgumentException($"Kacheln {a} und {b} sind nicht orthogonal benachbart");
        }

        public bool Equals(Edge other) => X == other.X && Y == other.Y && Side == other.Side;
        public override bool Equals(object? obj) => obj is Edge e && Equals(e);
        public override int GetHashCode() => (((X * 397) ^ Y) * 3) + (int)Side;
        public int CompareTo(Edge other)
        {
            int c = Y.CompareTo(other.Y);
            if (c != 0) return c;
            c = X.CompareTo(other.X);
            return c != 0 ? c : Side.CompareTo(other.Side);
        }

        public override string ToString() => $"({X},{Y},{(Side == EdgeSide.North ? "N" : "W")})";

        public JsonValue ToJson() => JsonValue.NewObject().Set("x", X).Set("y", Y).Set("side", Side == EdgeSide.North ? "N" : "W");

        public static Edge FromJson(JsonValue v)
        {
            string side = v.GetString("side");
            if (side != "N" && side != "W") throw new JsonFormatException($"Kantenseite '{side}' ungueltig, erlaubt: N, W");
            return new Edge(checked((int)v.GetInt("x")), checked((int)v.GetInt("y")), side == "N" ? EdgeSide.North : EdgeSide.West);
        }
    }

    /// <summary>Rechteck aus Kacheln (Räume sind im MVP rechteckig, A-07).</summary>
    public readonly struct TileRect
    {
        public TileRect(int x, int y, int width, int height)
        {
            if (width < 1 || height < 1) throw new ArgumentException("Rechteck braucht Breite und Hoehe von mindestens 1");
            X = x;
            Y = y;
            Width = width;
            Height = height;
        }

        public int X { get; }
        public int Y { get; }
        public int Width { get; }
        public int Height { get; }
        public int Right => X + Width;   // exklusiv
        public int Bottom => Y + Height; // exklusiv

        public bool Contains(Tile t) => t.X >= X && t.X < Right && t.Y >= Y && t.Y < Bottom;
        public bool Contains(TileRect r) => r.X >= X && r.Y >= Y && r.Right <= Right && r.Bottom <= Bottom;
        public bool Overlaps(TileRect r) => X < r.Right && r.X < Right && Y < r.Bottom && r.Y < Bottom;

        public override string ToString() => $"[{X},{Y} {Width}x{Height}]";

        public JsonValue ToJson() => JsonValue.NewObject().Set("x", X).Set("y", Y).Set("w", Width).Set("h", Height);

        public static TileRect FromJson(JsonValue v) =>
            new TileRect(checked((int)v.GetInt("x")), checked((int)v.GetInt("y")), checked((int)v.GetInt("w")), checked((int)v.GetInt("h")));
    }
}
