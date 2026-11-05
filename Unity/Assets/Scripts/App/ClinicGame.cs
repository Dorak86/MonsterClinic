#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using MonsterClinic.Platform;
using MonsterClinic.Sim.Clinic;
using MonsterClinic.Sim.Data;
using MonsterClinic.Sim.Diagnostics;
using MonsterClinic.Sim.Kernel;
using UnityEngine;
using UnityEngine.InputSystem;
// Unity 6.6 hat einen eigenen Typ UnityEngine.EntityId; gemeint ist immer der des Kerns.
using EntityId = MonsterClinic.Sim.Kernel.EntityId;
using LogEntry = MonsterClinic.Sim.Diagnostics.LogEntry;
using LogLevel = MonsterClinic.Sim.Diagnostics.LogLevel;

namespace MonsterClinic.App
{
    /// <summary>
    /// Meilenstein K4: Der Spielkreislauf wird in Unity sichtbar. Startet die feste Testklinik, laesst die Simulation
    /// in Echtzeit laufen und zeigt Boeden, Waende, Einrichtung, Patienten, Personal und eine einfache Anzeige.
    /// Startet von selbst beim Druck auf Play in jeder Szene; ein Objekt in der Szene ist nicht noetig.
    /// ZWISCHENSTAND (Regel 6): Anzeige mit IMGUI und Platzhalterfiguren; Bauen, Menues und Speichern folgen.
    /// </summary>
    public sealed class ClinicGame : MonoBehaviour
    {
        private const string ClinicId = "clinic.test_clinic";
        private static readonly float[] ZoomSizes = { 2.5f, 4f, 6f, 8.5f, 12f };
        private static readonly double[] Speeds = { 1, 2, 4, 8 };

        [SerializeField] private ulong seed = 1;
        [SerializeField] private string language = "de";

        private ContentDb _content = null!;
        private ClinicLayoutDef _clinic = null!;
        private Simulation _sim = null!;
        private SimulationRunner _runner = null!;
        private IsoView _view = null!;
        private ArtLibrary _art = null!;
        private ClinicRenderer _renderer = null!;
        private Loc _loc = null!;
        private Camera _cam = null!;
        private FileLogSink? _fileLog;

        private WallMode _walls = WallMode.Low;
        private int _zoom = 2;
        private int _speedIndex;
        private ulong _selected;
        private bool _showTruth;
        private string? _error;
        private Vector3 _dragOrigin;
        private bool _dragging;

        private readonly List<(string Text, float Until)> _toasts = new List<(string, float)>();
        private readonly List<(Vector2 World, string Text, Color Color, float Born)> _floaters = new List<(Vector2, string, Color, float)>();

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            if (FindAnyObjectByType<ClinicGame>() != null) return;
            new GameObject("MonsterClinic").AddComponent<ClinicGame>();
        }

        private void Start()
        {
            try
            {
                string contentRoot = ContentLoader.FindContentRoot(Application.dataPath);
                _content = ContentLoader.Load(contentRoot);
                _clinic = _content.Clinics[ClinicId];
                _loc = new Loc(contentRoot, language);
                _sim = ClinicSetup.NewGame(_content, ClinicId, seed);
                AttachLogging();
                _runner = new SimulationRunner(_sim);

                BuildingSystemInfo(out int w, out int h);
                _view = new IsoView(w, h);
                _art = new ArtLibrary(Application.dataPath);
                _renderer = new ClinicRenderer(_art, transform);
                _renderer.BuildStatic(_sim, _clinic, _view, _walls);

                SetupCamera();
                Debug.Log($"[MonsterClinic] {_loc.Name(ClinicId)} gestartet (Seed {seed}). Kunst aus: {_art.Root ?? "-"}");
            }
            catch (Exception ex)
            {
                _error = ex.Message;
                Debug.LogException(ex);
                enabled = true;
            }
        }

        private void BuildingSystemInfo(out int w, out int h)
        {
            var b = _sim.GetSystem<MonsterClinic.Sim.World.BuildingSystem>();
            w = b.LotWidth;
            h = b.LotHeight;
        }

        private void AttachLogging()
        {
            _sim.Log.AddSink(new UnitySink());
            try
            {
                _fileLog = new FileLogSink(GamePaths.ForCurrentUser().Logs, DateTime.UtcNow);
                _sim.Log.AddSink(_fileLog);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[MonsterClinic] Logdatei nicht moeglich: {ex.Message}");
            }
        }

        private void OnDestroy() => _fileLog?.Dispose();

        private void SetupCamera()
        {
            _cam = Camera.main;
            if (_cam == null)
            {
                _cam = new GameObject("Main Camera").AddComponent<Camera>();
                _cam.tag = "MainCamera";
            }
            _cam.orthographic = true;
            _cam.orthographicSize = ZoomSizes[_zoom];
            _cam.clearFlags = CameraClearFlags.SolidColor;
            _cam.backgroundColor = new Color(0.09f, 0.07f, 0.11f);
            CenterOn(new Vector2(_view.LotWidth / 2f, _view.LotHeight / 2f));
        }

        private void CenterOn(Vector2 world)
        {
            Vector3 p = IsoView.Screen(_view.ToView(world));
            _cam.transform.position = new Vector3(p.x, p.y, -10f);
        }

        private Vector2 CameraWorldPoint() => _view.ToWorld(IsoView.FromScreen(_cam.transform.position));

        // ------------------------------------------------------------------ Ablauf

        private void Update()
        {
            if (_error != null || _sim == null) return;
            HandleInput();

            try
            {
                _runner.Advance(Time.unscaledDeltaTime);
            }
            catch (Exception ex)
            {
                _error = "Simulation angehalten: " + ex.Message;
                Debug.LogException(ex);
                return;
            }

            HandleEvents();
            _renderer.UpdateFigures(_sim, _view, Time.unscaledDeltaTime, _selected, Time.unscaledTime);
            _renderer.EndFrame();
            _cam.backgroundColor = _sim.Now.IsNight ? new Color(0.04f, 0.035f, 0.08f) : new Color(0.09f, 0.07f, 0.11f);
        }

        private void HandleEvents()
        {
            foreach (IDomainEvent e in _sim.Events.Drain())
            {
                switch (e)
                {
                    case DayClosed dc:
                        DayStats d = dc.Stats;
                        _toasts.Add((_loc.Format("ui.report.day_closed",
                            ("day", d.Day), ("income", _loc.Money(d.Income)), ("expenses", _loc.Money(d.Expenses)),
                            ("cured", d.Cured), ("reputation", d.Reputation / 10)), Time.unscaledTime + 10f));
                        break;
                    case PatientLeft pl:
                        if (_renderer.Figures.TryGetValue(pl.Patient.Value, out ClinicRenderer.Figure? f))
                        {
                            string text = pl.Outcome == PatientOutcome.Died ? _loc["ui.float.died"]
                                : pl.Paid > 0 ? "+" + _loc.Money(pl.Paid) : _loc["ui.float.left"];
                            Color col = pl.Outcome == PatientOutcome.Cured ? new Color(1f, 0.85f, 0.3f) : new Color(1f, 0.45f, 0.4f);
                            _floaters.Add((f.World, text, col, Time.unscaledTime));
                        }
                        break;
                    case ComplicationOccurred co:
                        if (_renderer.Figures.TryGetValue(co.Patient.Value, out ClinicRenderer.Figure? g))
                            _floaters.Add((g.World, _loc.Name(co.Complication) + "!", new Color(1f, 0.5f, 0.9f), Time.unscaledTime));
                        break;
                }
            }
        }

        private void HandleInput()
        {
            Keyboard? kb = Keyboard.current;
            Mouse? mouse = Mouse.current;

            if (kb != null)
            {
                Vector2 move = Vector2.zero;
                if (kb.wKey.isPressed || kb.upArrowKey.isPressed) move.y += 1;
                if (kb.sKey.isPressed || kb.downArrowKey.isPressed) move.y -= 1;
                if (kb.aKey.isPressed || kb.leftArrowKey.isPressed) move.x -= 1;
                if (kb.dKey.isPressed || kb.rightArrowKey.isPressed) move.x += 1;
                if (move != Vector2.zero)
                    _cam.transform.position += (Vector3)(move.normalized * _cam.orthographicSize * 1.2f * Time.unscaledDeltaTime);

                if (kb.qKey.wasPressedThisFrame) Rotate(-1);
                if (kb.eKey.wasPressedThisFrame) Rotate(1);
                if (kb.spaceKey.wasPressedThisFrame) _runner.SetPaused(!_runner.IsPaused);
                if (kb.digit1Key.wasPressedThisFrame) SetSpeed(0);
                if (kb.digit2Key.wasPressedThisFrame) SetSpeed(1);
                if (kb.digit3Key.wasPressedThisFrame) SetSpeed(2);
                if (kb.digit4Key.wasPressedThisFrame) SetSpeed(3);
                if (kb.f1Key.wasPressedThisFrame) _showTruth = !_showTruth;
                if (kb.tabKey.wasPressedThisFrame)
                {
                    _walls = (WallMode)(((int)_walls + 1) % 3);
                    _renderer.BuildStatic(_sim, _clinic, _view, _walls);
                }
                if (kb.escapeKey.wasPressedThisFrame) _selected = 0;
            }

            if (mouse != null)
            {
                float scroll = mouse.scroll.ReadValue().y;
                if (scroll > 0.01f) Zoom(-1);
                else if (scroll < -0.01f) Zoom(1);

                Vector3 mouseWorld = _cam.ScreenToWorldPoint(mouse.position.ReadValue());
                if (mouse.middleButton.wasPressedThisFrame || mouse.rightButton.wasPressedThisFrame)
                {
                    _dragOrigin = mouseWorld;
                    _dragging = true;
                }
                if (_dragging && (mouse.middleButton.isPressed || mouse.rightButton.isPressed))
                {
                    _cam.transform.position += _dragOrigin - mouseWorld;
                }
                else
                {
                    _dragging = false;
                }

                if (mouse.leftButton.wasPressedThisFrame && !OverHud(mouse.position.ReadValue()))
                {
                    ClinicRenderer.Figure? f = _renderer.Pick(mouseWorld);
                    _selected = f?.Id ?? 0;
                }
            }
        }

        private void SetSpeed(int index)
        {
            _speedIndex = index;
            _runner.SetSpeed(Speeds[index]);
            _runner.SetPaused(false);
        }

        private void Zoom(int step)
        {
            _zoom = Mathf.Clamp(_zoom + step, 0, ZoomSizes.Length - 1);
            _cam.orthographicSize = ZoomSizes[_zoom];
        }

        private void Rotate(int step)
        {
            Vector2 focus = CameraWorldPoint();
            _view.Rotate(step);
            _renderer.BuildStatic(_sim, _clinic, _view, _walls);
            _renderer.SnapFigures();
            CenterOn(focus);
        }

        // ------------------------------------------------------------------ Anzeige (IMGUI)

        private float UiScale => Mathf.Max(1f, Screen.height / 1000f);

        private Rect _panelRect;

        private bool OverHud(Vector2 mouseScreen)
        {
            var guiPoint = new Vector2(mouseScreen.x, Screen.height - mouseScreen.y) / UiScale;
            return guiPoint.y < 44f || (_selected != 0 && _panelRect.Contains(guiPoint));
        }

        private GUIStyle? _label, _big, _box;

        private void Styles()
        {
            if (_label != null) return;
            _label = new GUIStyle(GUI.skin.label) { fontSize = 15, richText = true };
            _label.normal.textColor = new Color(0.95f, 0.9f, 0.95f);
            _big = new GUIStyle(_label) { fontSize = 18, fontStyle = FontStyle.Bold };
            _box = new GUIStyle(GUI.skin.box);
            _box.normal.background = Texture2D.whiteTexture;
        }

        private void OnGUI()
        {
            Styles();
            float s = UiScale;
            GUI.matrix = Matrix4x4.Scale(new Vector3(s, s, 1f));
            float w = Screen.width / s, h = Screen.height / s;

            if (_error != null)
            {
                Panel(new Rect(20, 20, w - 40, 120), new Color(0.35f, 0.05f, 0.08f, 0.95f));
                GUI.Label(new Rect(34, 30, w - 68, 100), "<b>MonsterClinic konnte nicht starten</b>\n" + _error + "\nDetails in der Konsole.", _label);
                return;
            }
            if (_sim == null) return;

            if (_sim.Now.IsNight)
            {
                GUI.color = new Color(0.1f, 0.12f, 0.35f, 0.22f);
                GUI.DrawTexture(new Rect(0, 0, w, h), Texture2D.whiteTexture);
                GUI.color = Color.white;
            }

            DrawFloaters(s);
            DrawTopBar(w);
            DrawToasts(w);
            DrawSelection(w);
            GUI.Label(new Rect(12, h - 28, w - 24, 24), _loc["ui.hud.help"], _label);
        }

        private void DrawTopBar(float w)
        {
            Panel(new Rect(0, 0, w, 40), new Color(0.12f, 0.08f, 0.14f, 0.92f));
            GameTime now = _sim.Now;
            EconomySystem eco = _sim.GetSystem<EconomySystem>();
            int patients = _sim.GetSystem<PatientSystem>().Patients.Count(p => !p.IsFinished);
            string time = _loc.Format("ui.hud.time", ("day", now.Day), ("time", $"{now.Hour:00}:{now.Minute:00}"))
                + "  " + (now.IsNight ? _loc["ui.hud.night"] : _loc["ui.hud.daytime"]);
            string speed = _runner.IsPaused ? _loc["ui.hud.paused"] : _loc.Format("ui.hud.speed", ("speed", Speeds[_speedIndex]));
            long balance = eco.Balance;
            string money = balance < 0 ? $"<color=#ff7070>{_loc.Money(balance)}</color>" : _loc.Money(balance);

            GUI.Label(new Rect(14, 9, 300, 26), time, _big);
            GUI.Label(new Rect(320, 9, 260, 26), money, _big);
            GUI.Label(new Rect(590, 11, 200, 24), _loc.Format("ui.hud.reputation", ("value", eco.Reputation / 10)), _label);
            GUI.Label(new Rect(760, 11, 200, 24), _loc.Format("ui.hud.patients", ("count", patients)), _label);
            GUI.Label(new Rect(w - 300, 11, 140, 24), _loc[_walls == WallMode.Low ? "ui.hud.walls_low" : _walls == WallMode.Full ? "ui.hud.walls_full" : "ui.hud.walls_off"], _label);
            GUI.Label(new Rect(w - 140, 9, 130, 26), speed, _big);
        }

        private void DrawToasts(float w)
        {
            _toasts.RemoveAll(t => t.Until < Time.unscaledTime);
            float y = 52;
            foreach ((string text, float _) in _toasts)
            {
                Panel(new Rect(w / 2 - 330, y, 660, 34), new Color(0.2f, 0.12f, 0.24f, 0.92f));
                GUI.Label(new Rect(w / 2 - 320, y + 6, 640, 26), text, _label);
                y += 40;
            }
        }

        private void DrawFloaters(float s)
        {
            _floaters.RemoveAll(f => Time.unscaledTime - f.Born > 2.5f);
            foreach ((Vector2 world, string text, Color color, float born) in _floaters)
            {
                float age = Time.unscaledTime - born;
                Vector3 p = IsoView.Screen(_view.ToView(world), 0.5f + age * 0.25f);
                Vector3 sp = _cam.WorldToScreenPoint(p);
                var gp = new Vector2(sp.x, Screen.height - sp.y) / s;
                GUI.color = new Color(color.r, color.g, color.b, Mathf.Clamp01(2.5f - age));
                GUI.Label(new Rect(gp.x - 80, gp.y - 12, 160, 24), "<b>" + text + "</b>", _label);
            }
            GUI.color = Color.white;
        }

        private void DrawSelection(float w)
        {
            if (_selected == 0) return;
            var id = new EntityId(_selected);
            PatientSystem ps = _sim.GetSystem<PatientSystem>();
            StaffSystem ss = _sim.GetSystem<StaffSystem>();
            var lines = new List<string>();
            string title;

            Patient? p = ps.Patients.FirstOrDefault(x => x.Id == id);
            StaffMember? st = p == null ? ss.Members.FirstOrDefault(x => x.Id == id) : null;
            if (p != null)
            {
                title = _loc.Name(p.SpeciesId) + (p.IsPrivate ? "  " + _loc["ui.patient.private"] : "") + (p.Emergency ? "  <color=#ff6060>" + _loc["ui.patient.emergency"] + "</color>" : "");
                lines.Add(_loc["ui.patient.state." + p.State.ToString().ToLowerInvariant()]);
                lines.Add(_loc.Format("ui.patient.diagnosis", ("value", p.IsDiagnosed ? _loc.Name(p.DiagnosedDiseaseId) : _loc.Format("ui.patient.unknown", ("confidence", p.Confidence)))));
                if (_showTruth) lines.Add("<color=#a0a0a0>" + _loc.Format("ui.patient.truth", ("value", _loc.Name(p.DiseaseId))) + "</color>");
                lines.Add(_loc.Format("ui.patient.health", ("value", p.Health / 10)) + "   " + _loc.Format("ui.patient.patience", ("value", p.Patience / 10)));
                lines.Add(_loc.Format("ui.patient.satisfaction", ("value", p.Satisfaction / 10)));
                lines.Add(p.Complicated ? "<color=#ff9ad5>" + _loc["ui.patient.complicated"] + "</color>"
                    : _loc.Format("ui.patient.deadline", ("minutes", Math.Max(0, p.DeadlineHalfMinutes / 2))));
                lines.Add(_loc.Format("ui.patient.waited", ("minutes", p.WaitingMinutes)));
            }
            else if (st != null)
            {
                title = _loc.Name("profession." + st.Profession) + (st.Specialization != "none" ? " (" + _loc.Name("specialization." + st.Specialization) + ")" : "");
                lines.Add(_loc.Format("ui.staff.qualification", ("value", st.Qualification)));
                lines.Add(_loc["ui.staff.task." + st.Task.ToString().ToLowerInvariant()]);
            }
            else
            {
                _selected = 0;
                return;
            }

            float height = 44 + lines.Count * 22;
            _panelRect = new Rect(w - 330, 52, 320, height);
            Panel(_panelRect, new Color(0.12f, 0.08f, 0.14f, 0.94f));
            GUI.Label(new Rect(_panelRect.x + 12, _panelRect.y + 8, 300, 26), title, _big);
            for (int i = 0; i < lines.Count; i++)
                GUI.Label(new Rect(_panelRect.x + 12, _panelRect.y + 38 + i * 22, 300, 22), lines[i], _label);
        }

        private void Panel(Rect r, Color c)
        {
            GUI.color = c;
            GUI.DrawTexture(r, Texture2D.whiteTexture);
            GUI.color = Color.white;
        }

        private sealed class UnitySink : ILogSink
        {
            public void Write(in LogEntry entry)
            {
                if (entry.Level == LogLevel.Error) Debug.LogError(entry.FormatBody());
                else if (entry.Level == LogLevel.Warning) Debug.LogWarning(entry.FormatBody());
            }
        }
    }
}
