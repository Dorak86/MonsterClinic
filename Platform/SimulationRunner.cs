using System;
using MonsterClinic.Sim.Kernel;

namespace MonsterClinic.Platform
{
    /// <summary>
    /// Verbindet Echtzeit und Simulation (Pflichtenheft 3): Pause, stufenlos 0,5x bis 8x.
    /// Hoehere Geschwindigkeit fuehrt mehr Ticks aus, nie groessere. Schafft der Rechner die Rate nicht,
    /// sinkt die tatsaechliche Geschwindigkeit, statt Ticks zu ueberspringen.
    /// Gleitkommazahlen sind hier erlaubt, weil dies Zeitsteuerung des Gastgebers ist, nicht Spielzustand.
    /// </summary>
    public sealed class SimulationRunner
    {
        public const double MinSpeed = 0.5;
        public const double MaxSpeed = 8.0;

        private readonly Simulation _sim;
        private double _accumulatedTicks;
        private double _speed = 1.0;

        public SimulationRunner(Simulation sim, int maxTicksPerFrame = 20)
        {
            _sim = sim ?? throw new ArgumentNullException(nameof(sim));
            if (maxTicksPerFrame < 1) throw new ArgumentOutOfRangeException(nameof(maxTicksPerFrame));
            MaxTicksPerFrame = maxTicksPerFrame;
        }

        public int MaxTicksPerFrame { get; }
        public bool IsPaused { get; private set; }

        /// <summary>Eingestellte Geschwindigkeit (0,5 bis 8).</summary>
        public double Speed => _speed;

        /// <summary>Tatsaechlich erreichte Geschwindigkeit des letzten Aufrufs von <see cref="Advance"/>.</summary>
        public double ActualSpeed { get; private set; }

        public void SetSpeed(double speed)
        {
            if (double.IsNaN(speed) || speed < MinSpeed || speed > MaxSpeed)
            {
                throw new ArgumentOutOfRangeException(nameof(speed), $"Geschwindigkeit muss zwischen {MinSpeed} und {MaxSpeed} liegen");
            }
            _speed = speed;
        }

        public void SetPaused(bool paused)
        {
            IsPaused = paused;
            if (paused) _accumulatedTicks = 0;
        }

        /// <summary>
        /// Laesst die Simulation um die vergangene Echtzeit weiterlaufen und gibt die Zahl ausgefuehrter Ticks zurueck.
        /// In der Pause werden nur Befehle ausgefuehrt (LOOP-06).
        /// </summary>
        public int Advance(double realSeconds)
        {
            if (realSeconds < 0) throw new ArgumentOutOfRangeException(nameof(realSeconds));

            if (IsPaused)
            {
                _sim.ProcessPendingCommands();
                ActualSpeed = 0;
                return 0;
            }

            _accumulatedTicks += realSeconds * TimeConfig.TicksPerRealSecondAtNormalSpeed * _speed;
            int ticks = (int)Math.Floor(_accumulatedTicks);
            if (ticks > MaxTicksPerFrame)
            {
                ticks = MaxTicksPerFrame;
                _accumulatedTicks = 0; // Rueckstand verwerfen: das Spiel wird langsamer, statt Ticks zu ueberspringen
            }
            else
            {
                _accumulatedTicks -= ticks;
            }

            if (ticks == 0)
            {
                _sim.ProcessPendingCommands();
            }

            for (int i = 0; i < ticks; i++)
            {
                _sim.Step();
            }

            ActualSpeed = realSeconds > 0 ? ticks / (realSeconds * TimeConfig.TicksPerRealSecondAtNormalSpeed) : 0;
            return ticks;
        }
    }
}
