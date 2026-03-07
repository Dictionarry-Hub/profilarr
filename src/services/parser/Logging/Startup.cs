namespace Parser.Logging;

/// <summary>
/// Startup logging utilities
/// </summary>
public static class Startup
{
    /// <summary>
    /// Check if running inside a Docker container
    /// </summary>
    public static bool IsDocker()
    {
        // Check for .dockerenv file (most reliable)
        if (File.Exists("/.dockerenv"))
            return true;

        // Check for docker in cgroup (fallback)
        try
        {
            var cgroup = File.ReadAllText("/proc/1/cgroup"); // nosemgrep: profilarr.csharp.file-io-review — hardcoded system path for Docker detection
            return cgroup.Contains("docker");
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Log container configuration (only when running in Docker)
    /// </summary>
    public static void LogContainerConfig()
    {
        if (!IsDocker()) return;

        Log.Info("Container initialized", new LogOptions
        {
            Source = "Docker",
            Meta = new
            {
                puid = Environment.GetEnvironmentVariable("PUID") ?? "1000",
                pgid = Environment.GetEnvironmentVariable("PGID") ?? "1000",
                umask = Environment.GetEnvironmentVariable("UMASK") ?? "022",
                tz = Environment.GetEnvironmentVariable("TZ") ?? "UTC"
            }
        });
    }

    /// <summary>
    /// Server information record
    /// </summary>
    public record ServerInfo(
        string Version,
        string Environment,
        string Timezone,
        string Hostname
    );

    /// <summary>
    /// Get server information
    /// </summary>
    public static ServerInfo GetServerInfo(string version)
    {
        return new ServerInfo(
            Version: version,
            Environment: System.Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT") ?? "Production",
            Timezone: TimeZoneInfo.Local.Id,
            Hostname: System.Environment.MachineName
        );
    }

    /// <summary>
    /// Log server startup information
    /// </summary>
    public static void LogServerInfo(string version, string url)
    {
        var info = GetServerInfo(version);

        Log.Info($"Parser service started", new LogOptions
        {
            Source = "Startup",
            Meta = new
            {
                version = info.Version,
                url,
                environment = info.Environment,
                timezone = info.Timezone,
                hostname = info.Hostname
            }
        });
    }
}
