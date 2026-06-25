using System;
using System.Diagnostics;
using System.IO;
using System.Collections.Generic;

class SevenZaWrapper {
    static int Main(string[] args) {
        // Locate the real 7za alongside this wrapper as 7za-real.exe
        string here = Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location);
        string real = Path.Combine(here, "7za-real.exe");
        if (!File.Exists(real)) {
            Console.Error.WriteLine("[7za-wrapper] missing 7za-real.exe at " + real);
            return 127;
        }

        // If this is an extract command (`x` or `e`), inject `-x!darwin*` to skip
        // mac dylib symlinks that fail without admin/Developer Mode.
        bool isExtract = args.Length > 0 && (args[0] == "x" || args[0] == "e");
        var newArgs = new List<string>(args);
        if (isExtract) {
            bool hasDarwinExclude = false;
            foreach (var a in args) {
                if (a.StartsWith("-x") && a.IndexOf("darwin", StringComparison.OrdinalIgnoreCase) >= 0) {
                    hasDarwinExclude = true;
                    break;
                }
            }
            if (!hasDarwinExclude) newArgs.Insert(1, "-x!darwin*");
        }

        var psi = new ProcessStartInfo();
        psi.FileName = real;
        // Quote each arg only when it contains whitespace; preserves switch syntax.
        var quoted = new List<string>();
        foreach (var a in newArgs) {
            if (a.IndexOf(' ') >= 0 || a.IndexOf('\t') >= 0) quoted.Add("\"" + a.Replace("\"", "\\\"") + "\"");
            else quoted.Add(a);
        }
        psi.Arguments = string.Join(" ", quoted);
        psi.UseShellExecute = false;
        psi.RedirectStandardOutput = false;
        psi.RedirectStandardError = false;

        try {
            var p = Process.Start(psi);
            p.WaitForExit();
            return p.ExitCode;
        } catch (Exception e) {
            Console.Error.WriteLine("[7za-wrapper] " + e.Message);
            return 1;
        }
    }
}
