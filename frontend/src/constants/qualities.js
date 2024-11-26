const QUALITIES = [
    {
        id: 1,
        name: 'Raw-HD',
        description: 'Uncompressed, high definition recorded video from airing',
        radarr: true,
        sonarr: true
    },
    {
        id: 2,
        name: 'BR-Disk',
        description: 'Complete Blu-ray disc image',
        radarr: true,
        sonarr: false
    },
    {
        id: 3,
        name: 'Remux-2160p',
        description:
            '4K Ultra HD Blu-ray disc content remuxed into a playable file format',
        radarr: true,
        sonarr: true
    },
    {
        id: 4,
        name: 'Bluray-2160p',
        description: '4K Ultra HD Blu-ray video encoded with lossy compression',
        radarr: true,
        sonarr: true
    },
    {
        id: 5,
        name: 'WEBDL-2160p',
        description:
            '4K web download, untouched as released by the streaming service',
        radarr: true,
        sonarr: true
    },
    {
        id: 6,
        name: 'WEBRip-2160p',
        description:
            '4K web rip, either captured from a 4K WEB-DL using a capture card or re-encoded from a 4K WEB-DL',
        radarr: true,
        sonarr: true
    },
    {
        id: 7,
        name: 'HDTV-2160p',
        description: '4K high-definition digital television capture',
        radarr: true,
        sonarr: true
    },
    {
        id: 8,
        name: 'Remux-1080p',
        description:
            '1080p Blu-ray disc content remuxed into a playable file format',
        radarr: true,
        sonarr: true
    },
    {
        id: 9,
        name: 'WEBDL-1080p',
        description:
            '1080p web download, untouched as released by the streaming service',
        radarr: true,
        sonarr: true
    },
    {
        id: 10,
        name: 'Bluray-1080p',
        description: '1080p Blu-ray video encoded with lossy compression',
        radarr: true,
        sonarr: true
    },
    {
        id: 11,
        name: 'WEBRip-1080p',
        description:
            '1080p web rip, either captured using a capture card or re-encoded from a WEB-DL of equal or higher resolution',
        radarr: true,
        sonarr: true
    },
    {
        id: 12,
        name: 'HDTV-1080p',
        description: '1080p high-definition digital television capture',
        radarr: true,
        sonarr: true
    },
    {
        id: 13,
        name: 'Bluray-720p',
        description: '720p Blu-ray video encoded with lossy compression',
        radarr: true,
        sonarr: true
    },
    {
        id: 14,
        name: 'WEBDL-720p',
        description:
            '720p web download, untouched as released by the streaming service',
        radarr: true,
        sonarr: true
    },
    {
        id: 15,
        name: 'WEBRip-720p',
        description:
            '720p web rip, either captured using a capture card or re-encoded from a WEB-DL of equal or higher resolution',
        radarr: true,
        sonarr: true
    },
    {
        id: 16,
        name: 'HDTV-720p',
        description: '720p high-definition digital television capture',
        radarr: true,
        sonarr: true
    },
    {
        id: 17,
        name: 'Bluray-576p',
        description: '576p Blu-ray video encoded with lossy compression',
        radarr: true,
        sonarr: true
    },
    {
        id: 18,
        name: 'Bluray-480p',
        description: '480p Blu-ray video encoded with lossy compression',
        radarr: true,
        sonarr: true
    },
    {
        id: 19,
        name: 'WEBDL-480p',
        description:
            '480p web download, untouched as released by the streaming service',
        radarr: true,
        sonarr: true
    },
    {
        id: 20,
        name: 'WEBRip-480p',
        description:
            '480p web rip, either captured using a capture card or re-encoded from a WEB-DL of equal or higher resolution',
        radarr: true,
        sonarr: true
    },
    {
        id: 21,
        name: 'DVD-R',
        description: 'DVD-Video disc image',
        radarr: true,
        sonarr: false
    },
    {
        id: 22,
        name: 'DVD',
        description: 'Standard DVD video, usually encoded at 480p',
        radarr: true,
        sonarr: true
    },
    {
        id: 23,
        name: 'DVDSCR',
        description: 'DVD screener, usually a lower quality early release',
        radarr: true,
        sonarr: false
    },
    {
        id: 24,
        name: 'SDTV',
        description:
            'Standard-definition digital television capture, typically 480p or lower',
        radarr: true,
        sonarr: true
    },
    {
        id: 25,
        name: 'Telecine',
        description:
            'Movie captured from a film print using a telecine machine',
        radarr: true,
        sonarr: false
    },
    {
        id: 26,
        name: 'Telesync',
        description:
            'Filmed in a movie theater using a professional camera, often with external audio',
        radarr: true,
        sonarr: false
    },
    {
        id: 27,
        name: 'REGIONAL',
        description: 'A release intended for a specific geographic region',
        radarr: true,
        sonarr: false
    },
    {
        id: 28,
        name: 'WORKPRINT',
        description:
            'An unfinished version of a movie, often with incomplete special effects',
        radarr: true,
        sonarr: false
    },
    {
        id: 29,
        name: 'CAM',
        description:
            'Filmed in a movie theater using a camcorder or mobile phone',
        radarr: true,
        sonarr: false
    },
    {
        id: 30,
        name: 'Unknown',
        description: 'Quality or source is unknown or unspecified',
        radarr: true,
        sonarr: true
    }
];

export default QUALITIES;
