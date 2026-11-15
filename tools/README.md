# tools

`yt-dlp_macos` fetches a picked YouTube video's sound for the TV (see `server/youtube-audio.js`).
It is committed so a `git pull` is all a dev Mac needs: no Python, ffmpeg or other install.

- Version: yt-dlp 2026.10.26, the official standalone macOS build (universal: Apple silicon and Intel)
- Source: https://github.com/yt-dlp/yt-dlp/releases/download/2026.10.26/yt-dlp_macos
- SHA-256: `0f922c15ccc0b83eefa1c8bc9104e434318c4bf16e408e1ee93b7745a6efe0aa`, as in that release's `SHA2-256SUMS`

To update it, download the newest `yt-dlp_macos` and `SHA2-256SUMS` from
https://github.com/yt-dlp/yt-dlp/releases/latest, check the hash with `shasum -a 256 yt-dlp_macos`,
replace the file (keep it executable) and update this note.
