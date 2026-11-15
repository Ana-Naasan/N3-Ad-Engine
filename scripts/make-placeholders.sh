#!/usr/bin/env bash
# Generates 10 s placeholder MP4s in public/videos/ (H.264 + AAC tone).
# Our ffmpeg has no drawtext, so ImageMagick draws the title card and ffmpeg
# adds a moving progress bar (handy for checking pause/rewind) and a tone.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/videos
tmp=$(mktemp -d)
BOLD="/System/Library/Fonts/Supplemental/Arial Bold.ttf"
REG="/System/Library/Fonts/Supplemental/Arial.ttf"

make() { # name bg title subtitle tone_hz
  local name=$1 bg=$2 title=$3 sub=$4 hz=$5
  magick -size 1280x720 "xc:$bg" -gravity center -fill white \
    -font "$BOLD" -pointsize 110 -annotate +0-50 "$title" \
    -font "$REG" -pointsize 40 -annotate +0+70 "$sub" "$tmp/$name.png"
  ffmpeg -loglevel error -y -loop 1 -i "$tmp/$name.png" \
    -f lavfi -i "color=c=white@0.85:s=1280x14" \
    -f lavfi -i "sine=frequency=$hz:sample_rate=48000" \
    -filter_complex "[0][1]overlay=x='-w+w*t/10':y=H-30[v];[2]volume=0.12[a]" \
    -map "[v]" -map "[a]" -t 10 -r 30 \
    -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 26 \
    -c:a aac -b:a 96k -movflags +faststart "public/videos/$name.mp4"
  echo "made public/videos/$name.mp4"
}

make content "#1d3557" "HACKATHON IN 6 HOURS" "How to Build a Hackathon Project in 6 Hours" 330
make ad1 "#e76f51" "GLOOP" "It's goo. It's good. It's GLOOP." 440
make ad2 "#2a9d8f" "WRAPZILLA" "Plastic wrap that fights back." 523
make ad3 "#8338ec" "GRIN+" "Teeth whitening for your soul." 587
make ad4 "#222222" "VOIDCOLA" "Now with 0% of everything." 659
rm -rf "$tmp"
