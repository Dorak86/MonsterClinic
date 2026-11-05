#nullable enable
using System.Collections.Generic;
using MonsterClinic.Sim.Clinic;
using MonsterClinic.Sim.Data;
using MonsterClinic.Sim.Kernel;
using MonsterClinic.Sim.World;
using UnityEngine;

namespace MonsterClinic.App
{
    public enum WallMode
    {
        Low,
        Full,
        Off,
    }

    /// <summary>
    /// Zeichnet die Klinik aus dem Zustand der Simulation (Meilenstein K4): Boeden je Raumtyp, Waende aus den
    /// Raumgrenzen, Einrichtung und Figuren. Liest nur, schreibt nie in die Simulation (Pflichtenheft 3).
    /// ZWISCHENSTAND (Regel 6): Figuren sind farbige Platzhalter, Waende einfache Quader, Tueren nur Rahmen.
    /// </summary>
    public sealed class ClinicRenderer
    {
        private const int FloorOrder = -30000;
        private const int ShadowOrder = -29000;
        private const float FullWallHeight = 0.72f;
        private const float LowWallHeight = 0.16f;
        private const float WallThickness = 0.14f;

        private static readonly Color WallTop = new Color(0.47f, 0.33f, 0.45f);
        private static readonly Color WallFrontY = new Color(0.32f, 0.21f, 0.31f);
        private static readonly Color WallFrontX = new Color(0.24f, 0.15f, 0.24f);
        private static readonly Color DoorFrame = new Color(0.55f, 0.38f, 0.22f);

        private readonly ArtLibrary _art;
        private readonly Material _material;
        private readonly Transform _root;
        private readonly Sprite _shadow;
        private readonly Dictionary<string, Sprite> _figureSprites = new Dictionary<string, Sprite>();
        private readonly Dictionary<ulong, Figure> _figures = new Dictionary<ulong, Figure>();
        private readonly List<ulong> _gone = new List<ulong>();
        private Transform? _static;

        public ClinicRenderer(ArtLibrary art, Transform root)
        {
            _art = art;
            _root = root;
            _material = ArtLibrary.MakeUnlitMaterial();
            _shadow = ArtLibrary.MakeShadow();
        }

        public IReadOnlyDictionary<ulong, Figure> Figures => _figures;

        public sealed class Figure
        {
            public ulong Id;
            public bool IsPatient;
            public GameObject Go = null!;
            public SpriteRenderer Body = null!;
            public SpriteRenderer Shadow = null!;
            public Vector2 World;      // geglaettete Position in Weltkacheln
            public Vector2 Jitter;     // kleiner fester Versatz, damit Figuren auf derselben Kachel nicht verschmelzen
            public bool Seen;
            public Color BaseColor = Color.white;
        }

        // ------------------------------------------------------------------ Statische Teile

        /// <summary>Baut Boeden, Waende und Einrichtung neu (beim Start, nach einer Drehung, beim Wechsel der Wandhoehe).</summary>
        public void BuildStatic(Simulation sim, ClinicLayoutDef clinic, IsoView view, WallMode walls)
        {
            if (_static != null) Object.Destroy(_static.gameObject);
            _static = new GameObject("Static").transform;
            _static.SetParent(_root, false);

            BuildingSystem b = sim.GetSystem<BuildingSystem>();
            BuildFloors(b, view);
            if (walls != WallMode.Off) BuildWalls(b, view, walls == WallMode.Full ? FullWallHeight : LowWallHeight);
            BuildDecor(clinic, view);
        }

        private void BuildFloors(BuildingSystem b, IsoView view)
        {
            var parent = new GameObject("Floors").transform;
            parent.SetParent(_static, false);
            for (int y = 0; y < b.LotHeight; y++)
                for (int x = 0; x < b.LotWidth; x++)
                {
                    var t = new Tile(x, y);
                    Vector2Int v = view.ViewTile(x, y);
                    string file = FloorFile(b, t, v);
                    int n = _art.FloorBlockSize(file);
                    Sprite? sprite = n > 0 ? _art.FloorTile(file, v.x, v.y) : null;

                    var go = new GameObject($"Floor {x},{y}");
                    go.transform.SetParent(parent, false);
                    go.transform.localPosition = IsoView.Screen(v.x + 0.5f, v.y + 0.5f);
                    var sr = go.AddComponent<SpriteRenderer>();
                    sr.sharedMaterial = _material;
                    sr.sortingOrder = FloorOrder;
                    if (sprite != null)
                    {
                        sr.sprite = sprite;
                        go.transform.localScale = new Vector3(1.02f, 1.02f, 1f); // schliesst haarfeine Fugen zwischen den Rauten
                    }
                    else
                    {
                        sr.sprite = Diamond();
                        sr.color = b.IsIndoor(t) ? new Color(0.45f, 0.4f, 0.42f) : new Color(0.25f, 0.3f, 0.22f);
                    }
                }
        }

        /// <summary>Bodenart je Raumtyp; Varianten wechseln blockweise ueber einen festen Hash (Art-Direction).</summary>
        private static string FloorFile(BuildingSystem b, Tile t, Vector2Int v)
        {
            if (!b.IsIndoor(t))
            {
                string[] ground = { "A", "B", "C" };
                return $"Floors/floor_ground_{ground[BlockHash(v, 8, ground.Length)]}.png";
            }
            Room? room = b.RoomAt(t);
            switch (room?.TypeId)
            {
                case "room.reception":
                case "room.waiting_room":
                case "room.staff_room":
                    return "Floors/floor_wood_A.png";
                case "room.examination_room":
                    return BlockHash(v, 4, 2) == 0 ? "Floors/floor_examination_A.png" : "Floors/floor_examination_B.png";
                case "room.operating_room":
                    return "Floors/floor_marble_A.png";
                case "room.toilet":
                    return "Floors/floor_toilet_A.png";
                default:
                    return "Floors/floor_stone_A.png";
            }
        }

        private static int BlockHash(Vector2Int v, int block, int sets)
        {
            int bx = Mathf.FloorToInt(v.x / (float)block), by = Mathf.FloorToInt(v.y / (float)block);
            unchecked
            {
                int h = (bx * 73856093) ^ (by * 19349663);
                return ((h % sets) + sets) % sets;
            }
        }

        private void BuildWalls(BuildingSystem b, IsoView view, float height)
        {
            var parent = new GameObject("Walls").transform;
            parent.SetParent(_static, false);
            for (int y = 0; y <= b.LotHeight; y++)
                for (int x = 0; x <= b.LotWidth; x++)
                {
                    foreach (EdgeSide side in new[] { EdgeSide.North, EdgeSide.West })
                    {
                        var e = new Edge(x, y, side);
                        if (!b.IsWall(e)) continue;
                        Vector2 p0 = new Vector2(x, y);
                        Vector2 p1 = side == EdgeSide.North ? new Vector2(x + 1, y) : new Vector2(x, y + 1);
                        Vector2 a = view.ToView(p0), c = view.ToView(p1);
                        if (b.IsDoor(e))
                        {
                            // Tuerrahmen: zwei Pfosten an den Enden
                            Post(parent, a, c, 0.0f, height + 0.08f);
                            Post(parent, a, c, 1.0f, height + 0.08f);
                            continue;
                        }
                        WallBox(parent, $"Wall {e}", a, c, height, WallTop, WallFrontY, WallFrontX);
                    }
                }
        }

        private void Post(Transform parent, Vector2 a, Vector2 c, float at, float height)
        {
            Vector2 p = Vector2.Lerp(a, c, at);
            Vector2 d = (c - a).normalized * 0.06f;
            WallBox(parent, "DoorPost", p - d, p + d, Mathf.Max(height, 0.3f), DoorFrame * 1.15f, DoorFrame, DoorFrame * 0.8f);
        }

        /// <summary>Quader entlang der Strecke a-c (Ansichtskoordinaten) mit Wanddicke; sichtbar sind Deckel, +y- und +x-Seite.</summary>
        private void WallBox(Transform parent, string name, Vector2 a, Vector2 c, float height, Color top, Color faceY, Color faceX)
        {
            float h = WallThickness / 2f;
            float ax = Mathf.Min(a.x, c.x) - h, bx = Mathf.Max(a.x, c.x) + h;
            float ay = Mathf.Min(a.y, c.y) - h, by = Mathf.Max(a.y, c.y) + h;

            var verts = new List<Vector3>();
            var cols = new List<Color>();
            var tris = new List<int>();
            void Quad(Vector3 q0, Vector3 q1, Vector3 q2, Vector3 q3, Color col)
            {
                int i = verts.Count;
                verts.Add(q0); verts.Add(q1); verts.Add(q2); verts.Add(q3);
                cols.Add(col); cols.Add(col); cols.Add(col); cols.Add(col);
                tris.Add(i); tris.Add(i + 1); tris.Add(i + 2);
                tris.Add(i); tris.Add(i + 2); tris.Add(i + 3);
                tris.Add(i); tris.Add(i + 2); tris.Add(i + 1); // beidseitig, damit die Wicklung egal ist
                tris.Add(i); tris.Add(i + 3); tris.Add(i + 2);
            }
            Quad(IsoView.Screen(ax, by), IsoView.Screen(bx, by), IsoView.Screen(bx, by, height), IsoView.Screen(ax, by, height), faceY);
            Quad(IsoView.Screen(bx, ay), IsoView.Screen(bx, by), IsoView.Screen(bx, by, height), IsoView.Screen(bx, ay, height), faceX);
            Quad(IsoView.Screen(ax, ay, height), IsoView.Screen(bx, ay, height), IsoView.Screen(bx, by, height), IsoView.Screen(ax, by, height), top);

            var mesh = new Mesh { name = name };
            mesh.SetVertices(verts);
            mesh.SetColors(cols);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateBounds();

            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = _material;
            mr.sortingOrder = IsoView.Order((a.x + c.x) / 2f + (a.y + c.y) / 2f);
        }

        /// <summary>
        /// Einrichtung aus dem optionalen Feld "decor" der Klinikdatei. ZWISCHENSTAND (Regel 6): reine Darstellung,
        /// die Simulation kennt die Objekte noch nicht (Objektsystem folgt in Phase 2); Figuren laufen hindurch.
        /// </summary>
        private void BuildDecor(ClinicLayoutDef clinic, IsoView view)
        {
            if (!clinic.Raw.TryGet("decor", out JsonValue list)) return;
            var parent = new GameObject("Decor").transform;
            parent.SetParent(_static, false);
            foreach (JsonValue d in list.Items)
            {
                string id = d.GetString("object");
                int x = (int)d.GetInt("x"), y = (int)d.GetInt("y"), len = (int)d.GetInt("length");
                Vector2Int facing = ParseFacing(d.GetString("facing"));
                bool alongX = facing.y != 0; // Sitzflaeche zeigt nach +-y, also liegt das Objekt laengs der x-Achse
                var rectMin = new Vector2(x, y);
                var rectMax = alongX ? new Vector2(x + len, y + 1) : new Vector2(x + 1, y + len);

                Vector2 v0 = view.ToView(rectMin), v1 = view.ToView(rectMax);
                Vector2 vMin = Vector2.Min(v0, v1), vMax = Vector2.Max(v0, v1);
                Vector2 vc = (vMin + vMax) / 2f;

                Vector2Int vf = view.RotateDir(facing);
                int viewIndex = vf.y > 0 ? 0 : vf.x > 0 ? 1 : vf.x < 0 ? 2 : 3; // vl, vr, hl, hr

                var go = new GameObject($"Decor {id} {x},{y}");
                go.transform.SetParent(parent, false);
                go.transform.localPosition = new Vector3(IsoView.Screen(vc).x, IsoView.Screen(vMax).y + 0.04f, 0f);
                var sr = go.AddComponent<SpriteRenderer>();
                sr.sharedMaterial = _material;
                sr.sortingOrder = IsoView.Order(vc.x + vc.y);
                Sprite? sprite = _art.ObjectView("Objects/" + id.Replace("object.", "object_") + ".png", viewIndex);
                if (sprite != null)
                {
                    sr.sprite = sprite;
                }
                else
                {
                    sr.sprite = Diamond();
                    sr.color = new Color(0.6f, 0.2f, 0.5f, 0.8f);
                    go.transform.localPosition = IsoView.Screen(vc);
                    go.transform.localScale = new Vector3(vMax.x - vMin.x, vMax.y - vMin.y, 1f);
                }
            }
        }

        private static Vector2Int ParseFacing(string f)
        {
            switch (f)
            {
                case "+x": return new Vector2Int(1, 0);
                case "-x": return new Vector2Int(-1, 0);
                case "-y": return new Vector2Int(0, -1);
                default: return new Vector2Int(0, 1);
            }
        }

        private Sprite? _diamond;

        /// <summary>Weisse Raute fuer Platzhalterboden.</summary>
        private Sprite Diamond()
        {
            if (_diamond != null) return _diamond;
            const int w = 64, h = 32;
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear };
            var px = new Color32[w * h];
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    float dx = Mathf.Abs(x + 0.5f - w / 2f) / (w / 2f), dy = Mathf.Abs(y + 0.5f - h / 2f) / (h / 2f);
                    px[y * w + x] = dx + dy <= 1f ? new Color32(255, 255, 255, 255) : new Color32(0, 0, 0, 0);
                }
            tex.SetPixels32(px);
            tex.Apply();
            _diamond = Sprite.Create(tex, new Rect(0, 0, w, h), new Vector2(0.5f, 0.5f), 64f);
            return _diamond;
        }

        // ------------------------------------------------------------------ Figuren

        /// <summary>Gleicht die Figuren mit Patienten und Personal ab und bewegt sie weich zwischen den Kacheln.</summary>
        public void UpdateFigures(Simulation sim, IsoView view, float dt, ulong selected, float time)
        {
            MovementSystem move = sim.GetSystem<MovementSystem>();
            foreach (Figure f in _figures.Values) f.Seen = false;

            foreach (Patient p in sim.GetSystem<PatientSystem>().Patients)
            {
                if (p.State == PatientState.Gone || !move.Contains(p.Id)) continue;
                Figure f = GetFigure(p.Id.Value, true, "p:" + p.SpeciesId, SpeciesColor(p.SpeciesId));
                Place(f, move.Get(p.Id), view, dt);
                Color c = f.BaseColor;
                if (p.Emergency) c = Color.Lerp(c, new Color(1f, 0.15f, 0.1f, c.a), 0.5f + 0.5f * Mathf.Sin(time * 8f));
                f.Body.color = c;
            }
            foreach (StaffMember s in sim.GetSystem<StaffSystem>().Members)
            {
                if (!move.Contains(s.Id)) continue;
                Figure f = GetFigure(s.Id.Value, false, "s:" + s.Profession, StaffColor(s.Profession));
                Place(f, move.Get(s.Id), view, dt);
                f.Body.color = f.BaseColor;
            }

            _gone.Clear();
            foreach (Figure f in _figures.Values)
            {
                if (!f.Seen) _gone.Add(f.Id);
            }
            foreach (ulong id in _gone)
            {
                Object.Destroy(_figures[id].Go);
                _figures.Remove(id);
            }

            foreach (Figure f in _figures.Values)
            {
                f.Go.transform.localScale = f.Id == selected ? new Vector3(1.18f, 1.18f, 1f) : Vector3.one;
            }
        }

        /// <summary>Nach einer Drehung springen die Figuren sofort an ihren Platz.</summary>
        public void SnapFigures() => _snap = true;

        private bool _snap;

        private void Place(Figure f, Walker w, IsoView view, float dt)
        {
            Vector2 target = WalkerPosition(w) + f.Jitter;
            if (_snap || (f.World - target).sqrMagnitude > 4f) f.World = target;
            else f.World = Vector2.Lerp(f.World, target, 1f - Mathf.Exp(-14f * dt));
            Vector2 v = view.ToView(f.World);
            f.Go.transform.localPosition = IsoView.Screen(v);
            int order = IsoView.Order(v.x + v.y);
            f.Body.sortingOrder = order;
            f.Shadow.sortingOrder = ShadowOrder;
            f.Seen = true;
        }

        public void EndFrame() => _snap = false;

        /// <summary>Position einer Figur in Weltkacheln (Kachelmitte plus Anteil des laufenden Schritts).</summary>
        public static Vector2 WalkerPosition(Walker w)
        {
            var a = new Vector2(w.Tile.X + 0.5f, w.Tile.Y + 0.5f);
            if (w.NextTile is Tile n)
            {
                int len = n.X != w.Tile.X && n.Y != w.Tile.Y ? MovementSystem.DiagonalUnits : MovementSystem.UnitsPerTile;
                float t = Mathf.Clamp01(w.Progress / (float)len);
                return Vector2.Lerp(a, new Vector2(n.X + 0.5f, n.Y + 0.5f), t);
            }
            return a;
        }

        private Figure GetFigure(ulong id, bool patient, string spriteKey, Color color)
        {
            if (_figures.TryGetValue(id, out Figure? f)) return f;
            if (!_figureSprites.TryGetValue(spriteKey, out Sprite? sprite))
            {
                sprite = ArtLibrary.MakeFigure(Color.white, new Color(0.15f, 0.1f, 0.15f), true);
                _figureSprites[spriteKey] = sprite;
            }
            var go = new GameObject((patient ? "Patient " : "Staff ") + id);
            go.transform.SetParent(_root, false);

            var shadowGo = new GameObject("Shadow");
            shadowGo.transform.SetParent(go.transform, false);
            var shadow = shadowGo.AddComponent<SpriteRenderer>();
            shadow.sprite = _shadow;
            shadow.sharedMaterial = _material;

            var bodyGo = new GameObject("Body");
            bodyGo.transform.SetParent(go.transform, false);
            var body = bodyGo.AddComponent<SpriteRenderer>();
            body.sprite = sprite;
            body.sharedMaterial = _material;
            if (!patient) bodyGo.transform.localScale = new Vector3(1.08f, 1.08f, 1f);

            unchecked
            {
                uint h = (uint)id * 2654435761u;
                f = new Figure
                {
                    Id = id,
                    IsPatient = patient,
                    Go = go,
                    Body = body,
                    Shadow = shadow,
                    BaseColor = color,
                    Jitter = new Vector2(((h & 0xFF) / 255f - 0.5f) * 0.4f, (((h >> 8) & 0xFF) / 255f - 0.5f) * 0.4f),
                    World = new Vector2(-100f, -100f),
                };
            }
            _figures[id] = f;
            return f;
        }

        /// <summary>Figur unter einem Bildschirmpunkt (Welteinheiten der Kamera), bevorzugt Patienten.</summary>
        public Figure? Pick(Vector2 point)
        {
            Figure? best = null;
            float bestDist = 0.3f * 0.3f;
            foreach (Figure f in _figures.Values)
            {
                Vector2 center = (Vector2)f.Go.transform.position + new Vector2(0f, 0.2f);
                float d = (center - point).sqrMagnitude * (f.IsPatient ? 0.7f : 1f);
                if (d < bestDist)
                {
                    bestDist = d;
                    best = f;
                }
            }
            return best;
        }

        public static Color SpeciesColor(string species)
        {
            switch (species)
            {
                case "species.vampire": return new Color(0.62f, 0.12f, 0.2f);
                case "species.ghost": return new Color(0.78f, 0.92f, 0.98f, 0.72f);
                case "species.zombie": return new Color(0.45f, 0.62f, 0.32f);
                case "species.goblin": return new Color(0.85f, 0.55f, 0.2f);
                default: return new Color(0.7f, 0.7f, 0.7f);
            }
        }

        public static Color StaffColor(string profession)
        {
            switch (profession)
            {
                case "monster_doctor": return new Color(0.96f, 0.96f, 0.93f);
                case "administrator": return new Color(0.42f, 0.4f, 0.85f);
                case "cleaner": return new Color(0.95f, 0.85f, 0.25f);
                case "janitor": return new Color(0.45f, 0.3f, 0.2f);
                default: return Color.gray;
            }
        }
    }
}
