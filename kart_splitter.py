#!/usr/bin/env python3
import argparse
import csv
import json
import math
import os
import subprocess
import sys
from pathlib import Path


def parse_ts(s: str) -> float:
    s = s.strip()
    if s.replace('.', '', 1).isdigit():
        return float(s)
    parts = s.split(':')
    if len(parts) == 2:  # MM:SS(.mmm)
        m = int(parts[0]); sec = float(parts[1]); return m*60 + sec
    if len(parts) == 3:  # HH:MM:SS(.mmm)
        h = int(parts[0]); m = int(parts[1]); sec = float(parts[2]); return h*3600 + m*60 + sec
    raise ValueError(f"Unrecognized time format: {s}")

def fmt_ts(seconds: float) -> str:
    ms = int(round((seconds - math.floor(seconds)) * 1000))
    total = int(math.floor(seconds))
    h = total // 3600
    m = (total % 3600) // 60
    s = total % 60
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}" if h>0 else f"{m:02d}:{s:02d}.{ms:03d}"

def read_laps_from_csv(path: Path) -> list[float]:
    laps = []
    with open(path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        # Попробуем угадать колонку времени
        keys = [k.lower() for k in (reader.fieldnames or [])]
        def key_of(*opts): 
            for o in opts:
                if o in keys: return reader.fieldnames[keys.index(o)]
            return None
        time_key = key_of('time','laptime','lap_time','duration')
        if time_key:
            for row in reader:
                val = (row.get(time_key) or "").strip()
                if val: laps.append(parse_ts(val))
        else:
            f.seek(0); raw = list(csv.reader(f)); raw = raw[1:] if raw and raw[0] else raw
            for r in raw:
                if len(r)>=2 and r[1].strip(): laps.append(parse_ts(r[1]))
    if not laps: raise ValueError("No laps parsed from CSV.")
    return laps

def ffprobe_duration(path: str) -> float | None:
    try:
        out = subprocess.check_output([
            "ffprobe","-v","error","-show_entries","format=duration",
            "-of","json", path
        ], text=True)
        return float(json.loads(out)["format"]["duration"])
    except Exception:
        return None

def drawtext(text: str, fontfile: str | None, fontsize: int) -> str:
    safe = text.replace(":", r"\:").replace("'", r"\'").replace(",", r"\,")
    base = f"text='{safe}':x=w-tw-40:y=40:fontcolor=white:fontsize={fontsize}:" \
           f"box=1:boxcolor=black@0.5:boxborderw=10:shadowcolor=black:shadowx=2:shadowy=2"
    return f"drawtext=fontfile='{fontfile}':{base}" if fontfile else f"drawtext:{base}"

def cut_segment(src, start_s, end_s, out_path, overlay, crf=20, preset="veryfast", fontfile=None, fontsize=48):
    if end_s - start_s <= 0.05: 
        print(f"Skip tiny segment {start_s:.3f}-{end_s:.3f}")
        return
    vf = drawtext(overlay, fontfile, fontsize)
    cmd = [
        "ffmpeg","-y",
        "-ss", f"{start_s:.3f}",
        "-to", f"{end_s:.3f}",
        "-i", src,
        "-vf", vf,
        "-c:v","libx264","-preset",preset,"-crf",str(crf),
        "-c:a","aac","-movflags","+faststart",
        str(out_path),
    ]
    print("Running:", " ".join(cmd))
    subprocess.run(cmd, check=True)

def main():
    ap = argparse.ArgumentParser(description="Split GoPro MP4 into per-lap clips with overlay (no pit-in).")
    ap.add_argument("--video", required=True)
    ap.add_argument("--first-lap", required=True, help="Timestamp of lap 1 start, e.g. 00:12.500")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--laps", help="Comma-separated laptimes, e.g. 43.605,44.120,...")
    g.add_argument("--laps-csv", help="CSV with headers lap,time (or similar)")
    ap.add_argument("--outdir", default="laps_out")
    ap.add_argument("--lead", type=float, default=0.00, help="Extra seconds before each lap")
    ap.add_argument("--tail", type=float, default=0.00, help="Extra seconds after each lap")
    ap.add_argument("--crf", type=int, default=20)
    ap.add_argument("--preset", default="veryfast")
    ap.add_argument("--fontfile", default=None, help="Path to a .ttf/.otf if system font fails")
    ap.add_argument("--fontsize", type=int, default=48)
    args = ap.parse_args()

    t_first = parse_ts(args.first_lap)
    laps = [parse_ts(x) for x in args.laps.split(",")] if args.laps else read_laps_from_csv(Path(args.laps_csv))
    total = sum(laps)
    session_end = t_first + total

    vid_dur = ffprobe_duration(args.video)
    if vid_dur is not None and session_end > vid_dur:
        print(f"Warning: computed end {fmt_ts(session_end)} exceeds video duration {fmt_ts(vid_dur)}. Clamping.")
        session_end = vid_dur

    outdir = Path(args.outdir); outdir.mkdir(parents=True, exist_ok=True)

    cum = 0.0
    made = 0
    for i, lap_dur in enumerate(laps, start=1):
        start = max(0.0, t_first + cum - args.lead)
        end   = min(session_end, t_first + cum + lap_dur + args.tail)
        label = f"Lap {i} — {fmt_ts(lap_dur)}"
        outfile = outdir / f"lap_{i:02d}_{fmt_ts(lap_dur).replace(':','-')}.mp4"
        try:
            cut_segment(args.video, start, end, outfile, label, args.crf, args.preset, args.fontfile, args.fontsize)
            made += 1
        except subprocess.CalledProcessError as e:
            print(f"FFmpeg failed for lap {i}: {e}", file=sys.stderr)
        cum += lap_dur

    print(f"Done. Created {made} clips. Total driving time {fmt_ts(total)}.")

if __name__ == "__main__":
    main()