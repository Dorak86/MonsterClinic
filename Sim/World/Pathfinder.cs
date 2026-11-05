using System;
using System.Collections.Generic;

namespace MonsterClinic.Sim.World
{
    /// <summary>
    /// Wegfindung A* auf dem Kachelraster in 8 Richtungen (Pflichtenheft 7). Ganzzahlige Kosten
    /// (gerade 10, schraeg 14), feste Reihenfolge bei Gleichstand: das Ergebnis ist auf jedem Rechner gleich.
    /// Schraege Schritte sind nur erlaubt, wenn beide gerade Umwege frei sind (keine Ecken schneiden, nie schraeg durch Tueren).
    /// Wege werden zwischengespeichert und bei jeder Bauaenderung verworfen.
    /// ZWISCHENSTAND (Regel 6): einstufige Suche; die zweistufige Suche ueber den Raumgraphen folgt in Phase 3.
    /// </summary>
    public sealed class Pathfinder
    {
        private const int Straight = 10;
        private const int Diagonal = 14;

        private static readonly (int dx, int dy, int cost)[] Steps =
        {
            (1, 0, Straight), (-1, 0, Straight), (0, 1, Straight), (0, -1, Straight),
            (1, 1, Diagonal), (1, -1, Diagonal), (-1, 1, Diagonal), (-1, -1, Diagonal),
        };

        private readonly BuildingSystem _building;
        private readonly Dictionary<(Tile, Tile), IReadOnlyList<Tile>?> _cache = new Dictionary<(Tile, Tile), IReadOnlyList<Tile>?>();
        private long _cacheVersion = -1;

        public Pathfinder(BuildingSystem building) => _building = building ?? throw new ArgumentNullException(nameof(building));

        /// <summary>Anzahl tatsaechlich durchgefuehrter Suchen (fuer Leistungsmessung und Tests).</summary>
        public long Searches { get; private set; }

        public bool CanStep(Tile from, int dx, int dy)
        {
            Tile to = from.Offset(dx, dy);
            if (!_building.InLot(to)) return false;
            if (dx == 0 || dy == 0) return _building.CanPass(from, to);
            Tile viaX = from.Offset(dx, 0), viaY = from.Offset(0, dy);
            return _building.CanPass(from, viaX) && _building.CanPass(viaX, to)
                && _building.CanPass(from, viaY) && _building.CanPass(viaY, to);
        }

        /// <summary>Weg von start nach goal (beide eingeschlossen) oder null, wenn unerreichbar.</summary>
        public IReadOnlyList<Tile>? FindPath(Tile start, Tile goal)
        {
            if (_cacheVersion != _building.Version)
            {
                _cache.Clear();
                _cacheVersion = _building.Version;
            }
            if (_cache.TryGetValue((start, goal), out IReadOnlyList<Tile>? cached)) return cached;
            IReadOnlyList<Tile>? path = Search(start, goal);
            _cache[(start, goal)] = path;
            return path;
        }

        private IReadOnlyList<Tile>? Search(Tile start, Tile goal)
        {
            Searches++;
            if (!_building.InLot(start) || !_building.InLot(goal)) return null;
            if (start == goal) return new[] { start };

            int w = _building.LotWidth, h = _building.LotHeight;
            int n = w * h;
            var g = new int[n];
            var parent = new int[n];
            var closed = new bool[n];
            for (int i = 0; i < n; i++) { g[i] = int.MaxValue; parent[i] = -1; }

            int startIdx = start.Y * w + start.X, goalIdx = goal.Y * w + goal.X;
            g[startIdx] = 0;
            var open = new SortedSet<(int f, int h, int idx)>();
            open.Add((Heuristic(start, goal), Heuristic(start, goal), startIdx));

            while (open.Count > 0)
            {
                var current = open.Min;
                open.Remove(current);
                int ci = current.idx;
                if (closed[ci]) continue;
                closed[ci] = true;
                if (ci == goalIdx) return Rebuild(parent, goalIdx, w);

                var ct = new Tile(ci % w, ci / w);
                foreach ((int dx, int dy, int cost) in Steps)
                {
                    if (!CanStep(ct, dx, dy)) continue;
                    Tile nt = ct.Offset(dx, dy);
                    int ni = nt.Y * w + nt.X;
                    if (closed[ni]) continue;
                    int ng = g[ci] + cost;
                    if (ng < g[ni])
                    {
                        g[ni] = ng;
                        parent[ni] = ci;
                        int hh = Heuristic(nt, goal);
                        open.Add((ng + hh, hh, ni));
                    }
                }
            }
            return null;
        }

        private static IReadOnlyList<Tile> Rebuild(int[] parent, int goalIdx, int w)
        {
            var path = new List<Tile>();
            for (int i = goalIdx; i != -1; i = parent[i]) path.Add(new Tile(i % w, i / w));
            path.Reverse();
            return path;
        }

        private static int Heuristic(Tile a, Tile b)
        {
            int dx = Math.Abs(a.X - b.X), dy = Math.Abs(a.Y - b.Y);
            return Straight * (dx + dy) + (Diagonal - 2 * Straight) * Math.Min(dx, dy);
        }
    }
}
