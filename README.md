# GoPro Kart Racing Video Toolkit

Python scripts for processing GoPro karting session videos - split into individual lap clips and create side-by-side lap comparisons.

## Requirements

- Python 3.12+
- FFmpeg (for video processing)

## Scripts

### 1. kart_splitter.py

Splits a GoPro session video into individual lap clips with timing overlays.

**Usage with inline lap times:**
```bash
./kart_splitter.py \
  --video session.mp4 \
  --first-lap 00:12.500 \
  --laps "43.605,44.120,44.001,44.389,43.881" \
  --outdir laps_out
```

**Usage with CSV file:**
```bash
./kart_splitter.py \
  --video GOPR2000.MP4 \
  --first-lap 2:05.000 \
  --laps-csv laps_1.csv \
  --outdir laps_out
```

**CSV Format (laps_1.csv):**
```csv
lap,time
1,00:48.561
2,00:49.107
3,00:46.274
4,00:46.559
5,00:46.238
6,00:45.876
7,00:45.119
8,00:46.362
9,00:45.736
10,00:44.936
11,00:44.945
12,00:46.318
```

### 2. lap_compare.py

Creates side-by-side comparison videos of selected laps from the same session.

**Usage:**
```bash
python3 lap_compare.py \
  --video GOPR2000.MP4 \
  --first-lap 2:05.000 \
  --laps-csv laps_1.csv \
  --select 10,11 \
  --out compare_10_vs_11.mp4 \
  --audio left
```

**Audio Options:**
- `--audio left`: Use only the first lap's audio
- `--audio mix`: Mix both laps' audio together 
- `--audio none`: No audio output

**Other Options:**
- `--select 2,5,7,9`: Compare 2-4 laps (grid layout)
- `--width 1920 --height 1080`: Output resolution
- `--crf 20`: Video quality (lower = better quality)
- `--preset veryfast`: Encoding speed vs quality tradeoff
- `--fontfile /path/to/font.ttf`: Custom font for overlays (optional)

## Time Format Support

Both scripts support flexible timestamp formats:
- Seconds: `43.605`
- MM:SS: `01:23.456`
- HH:MM:SS: `01:02:34.567`

## Recent Bug Fixes

### lap_compare.py v1.1 (Fixed)
- ✅ Fixed FFmpeg drawtext filter escaping issues
- ✅ Fixed audio stream processing logic preventing "unconnected output" errors  
- ✅ Improved error handling with detailed FFmpeg output
- ✅ All audio modes now working correctly (left/mix/none)