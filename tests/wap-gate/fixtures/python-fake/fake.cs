// Gefälschter Python-Interpreter für die Schleusen-Tests (Paket E1-01, Vertrag §6c, AR0-101).
// C# 5, nur System, System.IO, System.Text; übersetzt mit csc.exe des .NET Framework 4.x.
// Verhalten aus der Begleitdatei <name>.fake.txt neben der Kopie (UTF-8, Zeilen schluessel=wert):
//   exit    ≠ 0: sofort mit diesem Code enden (z.B. 9009 wie der App-Ausführungsalias)
//   vor     erwartetes Argument vor -c bzw. --version (für py: -3)
//   version «<major> <minor> <micro>», z.B. «3 13 0»
//   exe     auszugebendes sys.executable
//   probe   Pfad einer Datei mit dem erwarteten Probe-Befehl (Wortlaut, ohne Zeilenende)
//   log     Pfad einer Protokolldatei; jeder Aufruf hängt eine Zeile an (Argumente, getrennt durch |)
// Aufruf [vor] -c <probe> → Exit 0, stdout «<major> <minor> <micro>\r\n<exe>\r\n» (UTF-8 ohne BOM);
// Aufruf [vor] --version → «Python <major>.<minor>.<micro>\r\n», bei Hauptversion 2 auf stderr, sonst
// auf stdout; jeder andere Aufruf → Exit 2.
using System;
using System.IO;
using System.Text;

public static class FakePython
{
    public static int Main(string[] args)
    {
        string ordner = AppDomain.CurrentDomain.BaseDirectory;
        string name = Path.GetFileNameWithoutExtension(Environment.GetCommandLineArgs()[0]);
        string begleit = Path.Combine(ordner, name + ".fake.txt");
        string exit = null, vor = null, version = null, exe = null, probe = null, log = null;
        if (File.Exists(begleit))
        {
            foreach (string roh in File.ReadAllLines(begleit, new UTF8Encoding(false)))
            {
                int i = roh.IndexOf('=');
                if (i <= 0) continue;
                string k = roh.Substring(0, i).Trim();
                string w = roh.Substring(i + 1);
                if (k == "exit") exit = w.Trim();
                else if (k == "vor") vor = w.Trim();
                else if (k == "version") version = w.Trim();
                else if (k == "exe") exe = w;
                else if (k == "probe") probe = w.Trim();
                else if (k == "log") log = w.Trim();
            }
        }
        if (log != null)
        {
            File.AppendAllText(log, string.Join("|", args) + "\n", new UTF8Encoding(false));
        }
        if (exit != null && exit != "0")
        {
            return int.Parse(exit);
        }
        int start = 0;
        if (vor != null)
        {
            if (args.Length == 0 || args[0] != vor) return 2;
            start = 1;
        }
        int rest = args.Length - start;
        if (version == null) return 2;
        string[] teile = version.Split(' ');
        if (teile.Length != 3) return 2;
        Stream stdout = Console.OpenStandardOutput();
        Stream stderr = Console.OpenStandardError();
        UTF8Encoding utf8 = new UTF8Encoding(false);
        if (rest == 2 && args[start] == "-c")
        {
            if (probe == null || !File.Exists(probe)) return 2;
            string erwartet = File.ReadAllText(probe, utf8);
            if (args[start + 1] != erwartet) return 2;
            byte[] aus = utf8.GetBytes(teile[0] + " " + teile[1] + " " + teile[2] + "\r\n" + (exe ?? "") + "\r\n");
            stdout.Write(aus, 0, aus.Length);
            stdout.Flush();
            return 0;
        }
        if (rest == 1 && args[start] == "--version")
        {
            byte[] aus = utf8.GetBytes("Python " + teile[0] + "." + teile[1] + "." + teile[2] + "\r\n");
            Stream ziel = teile[0] == "2" ? stderr : stdout;
            ziel.Write(aus, 0, aus.Length);
            ziel.Flush();
            return 0;
        }
        return 2;
    }
}
