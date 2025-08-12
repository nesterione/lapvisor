#!/usr/bin/env python3
import argparse
import csv
import math
import subprocess
import sys
from pathlib import Path


def parse_ts(s: str) -> float:
    s = s.strip()
    if s.replace('.', '', 1).isdigit():
        return float(s)
    parts = s.split(':')
    if len(parts) == 2:
        m = int(parts[0]); sec = float(parts[1]); return m*60 + sec
    if len(parts) == 3:
        h = int(parts[0]); m = int(parts[1]); sec = float(parts[2]); return h*3600 + m*60 + sec
    raise ValueError(f"Unrecognized time format: {s}")

def fmt_ts(seconds: float) -> str:
    ms = int(round((seconds - math.floor(seconds)) * 1000))
    total = int(math.floor(seconds))
    h = total // 3600
    m = (total % 3600) // 60
    s = total % 60
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}" if h>0 else f"{m:02d}:{s:02d}.{ms:03d}"

def read_laps_csv(path: Path) -> list[float]:
    laps = []
    with open(path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
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
            f.seek(0)
            raw = list(csv.reader(f))
            raw = raw[1:] if raw and raw[0] else raw
            for r in raw:
                if len(r) >= 2 and r[1].strip():
                    laps.append(parse_ts(r[1]))
    if not laps:
        raise ValueError("No laps parsed from CSV")
    return laps

def build_overlay_text(lap_no:int, lap_dur:float, fontfile=None) -> str:
    label = f"Lap {lap_no} - {fmt_ts(lap_dur)} - "
    # Proper escaping for FFmpeg drawtext filter
    safe = label.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'").replace(",", "\\,")
    safe += "%{pts\\:hms}"
    base = f"text='{safe}':x=w-tw-40:y=40:fontcolor=white:fontsize=42:" \
           f"box=1:boxcolor=black@0.5:boxborderw=10:shadowcolor=black:shadowx=2:shadowy=2"
    if fontfile:
        return f"drawtext=fontfile='{fontfile}':{base}"
    else:
        return f"drawtext={base}"

def main():
    ap = argparse.ArgumentParser(description="Side-by-side lap comparison from single GoPro video.")
    ap.add_argument("--video", required=True)
    ap.add_argument("--first-lap", required=True)
    ap.add_argument("--laps-csv", required=True)
    ap.add_argument("--select", required=True, help="Lap numbers to compare, e.g. 3,10 or 2,5,7,9 (2–4 laps)")
    ap.add_argument("--out", default="compare.mp4")
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--audio", choices=["left","mix","none"], default="left")
    ap.add_argument("--crf", type=int, default=20)
    ap.add_argument("--preset", default="veryfast")
    ap.add_argument("--pad_end", type=float, default=0.0)
    ap.add_argument("--fontfile", default=None, help="Path to .ttf/.otf font file for drawtext (optional)")
    args = ap.parse_args()

    first = parse_ts(args.first_lap)
    laps = read_laps_csv(Path(args.laps_csv))
    picks = [int(x.strip()) for x in args.select.split(",") if x.strip()]
    if not (2 <= len(picks) <= 4):
        print("Select 2–4 laps.", file=sys.stderr); sys.exit(1)
    if any(n<1 or n>len(laps) for n in picks):
        print("Selected lap out of range.", file=sys.stderr); sys.exit(1)

    # старт/финиш выбранных кругов
    cum = 0.0
    lap_starts = []
    for dur in laps:
        lap_starts.append(first + cum)
        cum += dur
    starts = [lap_starts[n-1] for n in picks]
    ends   = [lap_starts[n-1] + laps[n-1] for n in picks]

    W, H = args.width, args.height
    tiles = len(picks)
    cell_w = W//2
    cell_h = H if tiles==2 else H//2

    durations = [e - s for s,e in zip(starts, ends)]
    max_dur = max(durations) + args.pad_end

    cmd = ["ffmpeg","-hide_banner","-loglevel","level+info","-y"]
    for s,e in zip(starts, ends):
        cmd += ["-ss", f"{s:.3f}", "-to", f"{e:.3f}", "-i", args.video]

    vf_parts = []
    v_labels = []
    a_labels = []

    for idx, (lap_no, lap_dur) in enumerate(zip(picks, durations)):
        vin = f"[{idx}:v]"
        ain = f"[{idx}:a]"
        lbl_v = f"v{idx}"
        lbl_a = f"a{idx}"

        overlay = build_overlay_text(lap_no, lap_dur, args.fontfile)
        chain = (
            f"{vin}setpts=PTS-STARTPTS,setsar=1,"
            f"scale={cell_w}:{cell_h}:force_original_aspect_ratio=decrease,"
            f"pad={cell_w}:{cell_h}:(ow-iw)/2:(oh-ih)/2,"
            f"{overlay},format=yuv420p"
        )
        if args.pad_end > 0:
            chain += f",tpad=stop_mode=clone:stop_duration={max(0.0, max_dur - lap_dur):.3f}"
        chain += f"[{lbl_v}]"
        vf_parts.append(chain)
        v_labels.append(f"[{lbl_v}]")

        # Only create audio filters for streams we'll actually use
        create_audio = (args.audio == "mix" or 
                       (args.audio == "left" and idx == 0))
        if create_audio:
            af = f"{ain}asetpts=PTS-STARTPTS"
            if args.pad_end > 0:
                af += f",apad=pad_dur={max(0.0, max_dur - lap_dur):.3f}"
            af += f"[{lbl_a}]"
            vf_parts.append(af)
            a_labels.append(f"[{lbl_a}]")

    # плитка
    if tiles == 2:
        layout = f"{''.join(v_labels)}hstack=inputs=2[vout]"
    else:
        if tiles == 3:
            vf_parts.append(f"color=size={cell_w}x{cell_h}:color=black[blank]")
            v_labels.append("[blank]")
        layout = f"{''.join(v_labels)}xstack=inputs=4:layout=0_0|{cell_w}_0|0_{cell_h}|{cell_w}_{cell_h}[vout]"
    vf_parts.append(layout)

    # аудио
    audio_map = []
    if args.audio == "left":
        if a_labels:
            vf_parts.append(f"{a_labels[0]}anull[aout]")
            audio_map = ["-map","[aout]"]
    elif args.audio == "mix":
        if len(a_labels) == 1:
            vf_parts.append(f"{a_labels[0]}anull[aout]")
        else:
            vf_parts.append(f"{''.join(a_labels)}amix=inputs={len(a_labels)}:normalize=0[aout]")
        audio_map = ["-map","[aout]"]

    filter_complex = ";".join(vf_parts)
    cmd += ["-filter_complex", filter_complex, "-map", "[vout]"]
    if audio_map:
        cmd += audio_map
    else:
        cmd += ["-an"]

    cmd += ["-c:v","libx264","-preset",args.preset,"-crf",str(args.crf),"-movflags","+faststart", args.out]

    print("Running:\n", " ".join(cmd), "\n")
    try:
        proc = subprocess.run(cmd, text=True, capture_output=True)
        if proc.stdout:
            print("FFmpeg stdout:")
            print(proc.stdout)
        if proc.stderr:
            print("FFmpeg stderr:")
            print(proc.stderr)
        proc.check_returncode()
        print(f"Done. Saved {args.out}")
    except subprocess.CalledProcessError as e:
        print(f"FFmpeg failed with exit code {e.returncode}")
        if proc.stderr:
            print("Error details:")
            print(proc.stderr)
        raise

if __name__ == "__main__":
    main()