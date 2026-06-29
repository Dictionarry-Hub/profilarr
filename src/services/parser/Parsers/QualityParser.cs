using System.Text.RegularExpressions;
using Parser.Models;

namespace Parser.Parsers;

public static class QualityParser
{
    private static readonly Regex SourceRegex = new(@"\b(?:
        (?<bluray>M?Blu[-_. ]?Ray|HD[-_. ]?DVD|BD(?!$)|UHD2?BD|BDISO|BDMux|BD25|BD50|BR[-_. ]?DISK)|
        (?<webdl>WEB[-_. ]?DL(?:mux)?|AmazonHD|AmazonSD|iTunesHD|MaxdomeHD|NetflixU?HD|WebHD|HBOMaxHD|DisneyHD|[. ]WEB[. ](?:[xh][ .]?26[45]|AVC|HEVC|DDP?5[. ]1)|[. ](?-i:WEB)$|(?:\d{3,4}0p)[-. ](?:Hybrid[-_. ]?)?WEB[-. ]|[-. ]WEB[-. ]\d{3,4}0p|\b\s\/\sWEB\s\/\s\b|(?:AMZN|NF|DP)[. -]WEB[. -](?!Rip))|
        (?<webrip>WebRip|Web-Rip|WEBMux)|
        (?<hdtv>HDTV)|
        (?<bdrip>BDRip|BDLight|HD[-_. ]?DVDRip|UHDBDRip)|
        (?<brrip>BRRip)|
        (?<dvdr>\d?x?M?DVD-?[R59])|
        (?<dvd>DVD(?!-R)|DVDRip|xvidvd)|
        (?<dsr>WS[-_. ]DSR|DSR)|
        (?<regional>R[0-9]{1}|REGIONAL)|
        (?<scr>SCR|SCREENER|DVDSCR|DVDSCREENER)|
        (?<ts>TS[-_. ]|TELESYNCH?|HD-TS|HDTS|PDVD|TSRip|HDTSRip)|
        (?<tc>TC|TELECINE|HD-TC|HDTC)|
        (?<cam>CAMRIP|(?:NEW)?CAM|HD-?CAM(?:Rip)?|HQCAM)|
        (?<wp>WORKPRINT|WP)|
        (?<pdtv>PDTV)|
        (?<sdtv>SDTV)|
        (?<tvrip>TVRip)
    )(?:\b|$|[ .])",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.IgnorePatternWhitespace);

    private static readonly Regex ResolutionRegex = new(
        @"\b(?:(?<R360p>360p)|(?<R480p>480p|480i|640x480|848x480)|(?<R540p>540p)|(?<R576p>576p)|(?<R720p>720p|1280x720|960p)|(?<R1080p>1080p|1920x1080|1440p|FHD|1080i|4kto1080p)|(?<R2160p>2160p|3840x2160|4k[-_. ](?:UHD|HEVC|BD|H\.?265)|(?:UHD|HEVC|BD|H\.?265)[-_. ]4k))\b",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex AlternativeResolutionRegex = new(
        @"\b(?<R2160p>UHD)\b|(?<R2160p>\[4K\])",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex RemuxRegex = new(
        @"(?:[_. \[]|\d{4}p-|\bHybrid-)(?<remux>(?:(BD|UHD)[-_. ]?)?Remux)\b|(?<remux>(?:(BD|UHD)[-_. ]?)?Remux[_. ]\d{4}p)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex ProperRegex = new(@"\b(?<proper>proper)\b",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex RepackRegex = new(@"\b(?<repack>repack\d?|rerip\d?)\b",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex VersionRegex = new(
        @"\d[-._ ]?v(?<version>\d)[-._ ]|\[v(?<version>\d)\]|repack(?<version>\d)|rerip(?<version>\d)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex RealRegex = new(@"\b(?<real>REAL)\b", RegexOptions.Compiled);

    private static readonly Regex RawHDRegex = new(@"\b(?<rawhd>RawHD|Raw[-_. ]HD)\b",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex BRDISKRegex = new(
        @"^(?!.*\b((?<!HD[._ -]|HD)DVD|BDRip|720p|MKV|XviD|WMV|d3g|(BD)?REMUX|^(?=.*1080p)(?=.*HEVC)|[xh][-_. ]?26[45]|German.*[DM]L|((?<=\d{4}).*German.*([DM]L)?)(?=.*\b(AVC|HEVC|VC[-_. ]?1|MVC|MPEG[-_. ]?2)\b))\b)(((?=.*\b(Blu[-_. ]?ray|BD|HD[-_. ]?DVD)\b)(?=.*\b(AVC|HEVC|VC[-_. ]?1|MVC|MPEG[-_. ]?2|BDMV|ISO)\b))|^((?=.*\b(((?=.*\b((.*_)?COMPLETE.*|Dis[ck])\b)(?=.*(Blu[-_. ]?ray|HD[-_. ]?DVD)))|3D[-_. ]?BD|BR[-_. ]?DISK|Full[-_. ]?Blu[-_. ]?ray|^((?=.*((BD|UHD)[-_. ]?(25|50|66|100|ISO)))))))).*",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex CodecRegex = new(
        @"\b(?:(?<x264>x264)|(?<h264>h264)|(?<xvidhd>XvidHD)|(?<xvid>X-?vid)|(?<divx>divx))\b",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex AnimeBlurayRegex = new(
        @"bd(?:720|1080|2160)|(?<=[-_. (\[])bd(?=[-_. )\]])",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex AnimeWebDlRegex = new(
        @"\[WEB\]|[\[\(]WEB[ .]",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex MPEG2Regex = new(@"\b(?<mpeg2>MPEG[-_. ]?2)\b",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static QualityResult ParseQuality(string name)
    {
        var normalizedName = name.Replace('_', ' ').Trim();
        var result = new QualityResult();

        // Parse revision/modifiers
        ParseRevision(name, normalizedName, result);

        // Parse resolution
        var resolution = ParseResolution(normalizedName);
        result.Resolution = resolution;

        // Check RawHD
        if (RawHDRegex.IsMatch(normalizedName) && !BRDISKRegex.IsMatch(normalizedName))
        {
            result.Modifier = QualityModifier.RawHD;
            return result;
        }

        // Check source
        var sourceMatch = SourceRegex.Match(normalizedName);
        var isRemux = RemuxRegex.IsMatch(normalizedName);
        var isBRDisk = BRDISKRegex.IsMatch(normalizedName);
        var codecMatch = CodecRegex.Match(normalizedName);

        if (sourceMatch.Success)
        {
            if (sourceMatch.Groups["bluray"].Success)
            {
                result.Source = QualitySource.Bluray;

                if (isBRDisk)
                {
                    result.Modifier = QualityModifier.BRDisk;
                    return result;
                }

                if (codecMatch.Groups["xvid"].Success || codecMatch.Groups["divx"].Success)
                {
                    result.Resolution = Resolution.R480p;
                    return result;
                }

                result.Modifier = isRemux ? QualityModifier.Remux : QualityModifier.None;
                if (result.Resolution == Resolution.Unknown)
                    result.Resolution = Resolution.R720p;
                return result;
            }

            if (sourceMatch.Groups["webdl"].Success)
            {
                result.Source = QualitySource.WebDL;
                if (result.Resolution == Resolution.Unknown)
                    result.Resolution = Resolution.R480p;
                return result;
            }

            if (sourceMatch.Groups["webrip"].Success)
            {
                result.Source = QualitySource.WebRip;
                if (result.Resolution == Resolution.Unknown)
                    result.Resolution = Resolution.R480p;
                return result;
            }

            if (sourceMatch.Groups["hdtv"].Success)
            {
                result.Source = QualitySource.TV;
                if (MPEG2Regex.IsMatch(normalizedName))
                {
                    result.Modifier = QualityModifier.RawHD;
                }
                return result;
            }

            if (sourceMatch.Groups["bdrip"].Success || sourceMatch.Groups["brrip"].Success)
            {
                result.Source = QualitySource.Bluray;
                if (result.Resolution == Resolution.Unknown)
                    result.Resolution = Resolution.R480p;
                return result;
            }

            if (sourceMatch.Groups["dvdr"].Success || sourceMatch.Groups["dvd"].Success)
            {
                result.Source = QualitySource.DVD;
                result.Resolution = Resolution.R480p;
                return result;
            }

            if (sourceMatch.Groups["scr"].Success)
            {
                result.Source = QualitySource.DVD;
                result.Resolution = Resolution.R480p;
                result.Modifier = QualityModifier.Screener;
                return result;
            }

            if (sourceMatch.Groups["cam"].Success)
            {
                result.Source = QualitySource.Cam;
                return result;
            }

            if (sourceMatch.Groups["ts"].Success)
            {
                result.Source = QualitySource.Telesync;
                return result;
            }

            if (sourceMatch.Groups["tc"].Success)
            {
                result.Source = QualitySource.Telecine;
                return result;
            }

            if (sourceMatch.Groups["wp"].Success)
            {
                result.Source = QualitySource.Workprint;
                return result;
            }

            if (sourceMatch.Groups["regional"].Success)
            {
                result.Source = QualitySource.DVD;
                result.Resolution = Resolution.R480p;
                result.Modifier = QualityModifier.Regional;
                return result;
            }

            if (sourceMatch.Groups["pdtv"].Success || sourceMatch.Groups["sdtv"].Success ||
                sourceMatch.Groups["dsr"].Success || sourceMatch.Groups["tvrip"].Success)
            {
                result.Source = QualitySource.TV;
                return result;
            }
        }

        // No source - check remux with resolution
        if (isRemux && resolution != Resolution.Unknown)
        {
            result.Source = QualitySource.Bluray;
            result.Modifier = QualityModifier.Remux;
            return result;
        }

        // Anime patterns
        if (AnimeBlurayRegex.IsMatch(normalizedName))
        {
            result.Source = QualitySource.Bluray;
            result.Modifier = isRemux ? QualityModifier.Remux : QualityModifier.None;
            if (result.Resolution == Resolution.Unknown)
                result.Resolution = Resolution.R720p;
            return result;
        }

        if (AnimeWebDlRegex.IsMatch(normalizedName))
        {
            result.Source = QualitySource.WebDL;
            if (result.Resolution == Resolution.Unknown)
                result.Resolution = Resolution.R720p;
            return result;
        }

        // Resolution-only releases fallback to HDTV/SDTV in Sonarr/Radarr.
        if (resolution != Resolution.Unknown)
        {
            result.Source = QualitySource.TV;
        }

        return result;
    }

    private static Resolution ParseResolution(string name)
    {
        var match = ResolutionRegex.Match(name);
        var altMatch = AlternativeResolutionRegex.Match(name);

        if (!match.Success && !altMatch.Success)
            return Resolution.Unknown;

        if (match.Groups["R360p"].Success) return Resolution.R360p;
        if (match.Groups["R480p"].Success) return Resolution.R480p;
        if (match.Groups["R540p"].Success) return Resolution.R540p;
        if (match.Groups["R576p"].Success) return Resolution.R576p;
        if (match.Groups["R720p"].Success) return Resolution.R720p;
        if (match.Groups["R1080p"].Success) return Resolution.R1080p;
        if (match.Groups["R2160p"].Success || altMatch.Groups["R2160p"].Success) return Resolution.R2160p;

        return Resolution.Unknown;
    }

    private static void ParseRevision(string name, string normalizedName, QualityResult result)
    {
        var versionMatch = VersionRegex.Match(normalizedName);
        if (versionMatch.Success && versionMatch.Groups["version"].Success)
        {
            result.Revision.Version = int.Parse(versionMatch.Groups["version"].Value);
        }

        if (ProperRegex.IsMatch(normalizedName))
        {
            result.Revision.Version = versionMatch.Success ? result.Revision.Version + 1 : 2;
        }

        if (RepackRegex.IsMatch(normalizedName))
        {
            result.Revision.Version = versionMatch.Success ? result.Revision.Version + 1 : 2;
            result.Revision.IsRepack = true;
        }

        var realMatches = RealRegex.Matches(name);
        if (realMatches.Count > 0)
        {
            result.Revision.Real = realMatches.Count;
        }
    }
}
