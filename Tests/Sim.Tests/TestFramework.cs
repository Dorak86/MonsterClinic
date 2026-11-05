using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;

namespace MonsterClinic.Sim.Tests
{
    /// <summary>Markiert eine Testmethode (oeffentlich, ohne Parameter, in einer oeffentlichen Klasse).</summary>
    [AttributeUsage(AttributeTargets.Method)]
    public sealed class TestAttribute : Attribute
    {
    }

    /// <summary>Anforderungs- oder Test-ID, die ein Test prueft (Pflichtenheft 1, Code-Regel 4).</summary>
    [AttributeUsage(AttributeTargets.Method, AllowMultiple = true)]
    public sealed class RequirementAttribute : Attribute
    {
        public RequirementAttribute(string id) => Id = id;
        public string Id { get; }
    }

    public sealed class AssertionException : Exception
    {
        public AssertionException(string message) : base(message)
        {
        }
    }

    public static class Assert
    {
        public static void True(bool condition, string message)
        {
            if (!condition) throw new AssertionException(message);
        }

        public static void Equal<T>(T expected, T actual, string what)
        {
            if (!EqualityComparer<T>.Default.Equals(expected, actual))
            {
                throw new AssertionException($"{what}: erwartet {expected}, war {actual}");
            }
        }

        public static void NotEqual<T>(T notExpected, T actual, string what)
        {
            if (EqualityComparer<T>.Default.Equals(notExpected, actual))
            {
                throw new AssertionException($"{what}: darf nicht {actual} sein");
            }
        }

        public static TException Throws<TException>(Action action, string what) where TException : Exception
        {
            try
            {
                action();
            }
            catch (TException ex)
            {
                return ex;
            }
            catch (Exception ex)
            {
                throw new AssertionException($"{what}: erwartet {typeof(TException).Name}, war {ex.GetType().Name}: {ex.Message}");
            }
            throw new AssertionException($"{what}: erwartet {typeof(TException).Name}, aber es gab keine Ausnahme");
        }
    }

    /// <summary>Fuehrt alle Tests aus. Aufruf: simtests [Filtertext]. Exitcode 0 = alle bestanden.</summary>
    internal static class Runner
    {
        private static int Main(string[] args)
        {
            string? filter = args.Length > 0 ? args[0] : null;
            var tests = typeof(Runner).Assembly.GetTypes()
                .Where(t => t.IsClass && t.IsPublic)
                .SelectMany(t => t.GetMethods(BindingFlags.Public | BindingFlags.Instance)
                    .Where(m => m.GetCustomAttribute<TestAttribute>() != null)
                    .Select(m => (Type: t, Method: m)))
                .OrderBy(x => x.Type.Name, StringComparer.Ordinal)
                .ThenBy(x => x.Method.Name, StringComparer.Ordinal)
                .Where(x => filter == null || $"{x.Type.Name}.{x.Method.Name}".Contains(filter))
                .ToList();

            int passed = 0, failed = 0;
            foreach ((Type type, MethodInfo method) in tests)
            {
                string ids = string.Join(", ", method.GetCustomAttributes<RequirementAttribute>().Select(r => r.Id));
                string name = $"{type.Name}.{method.Name}" + (ids.Length > 0 ? $" [{ids}]" : string.Empty);
                try
                {
                    object instance = Activator.CreateInstance(type)!;
                    method.Invoke(instance, null);
                    Console.WriteLine($"BESTANDEN  {name}");
                    passed++;
                }
                catch (TargetInvocationException ex)
                {
                    Console.WriteLine($"FEHLGESCHLAGEN  {name}");
                    Console.WriteLine($"    {ex.InnerException?.GetType().Name}: {ex.InnerException?.Message}");
                    failed++;
                }
            }

            Console.WriteLine();
            Console.WriteLine($"{passed} bestanden, {failed} fehlgeschlagen");
            return failed == 0 && tests.Count > 0 ? 0 : 1;
        }
    }
}
