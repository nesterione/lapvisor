# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GoPro kart racing video processing toolkit written in Python 3. The project processes racing session videos by splitting them into individual lap clips and creating side-by-side comparison videos.

## Core Components

### kart_splitter.py
Main script for splitting GoPro videos into individual lap clips with timing overlays.

**Key functionality:**
- Parses timestamps in various formats (seconds, MM:SS, HH:MM:SS)
- Reads lap times from CSV files or comma-separated values
- Uses FFmpeg to extract video segments with timing overlays
- Automatically calculates segment boundaries based on first lap timestamp and lap durations

### lap_compare.py
Creates side-by-side comparison videos of selected laps from the same session.

**Key functionality:**
- Supports 2-4 lap comparisons in grid layout
- Synchronized playback with individual lap timing overlays
- Audio mixing options (left channel only, mixed, or none)
- Dynamic video resizing and padding

## Dependencies

**Required external tools:**
- FFmpeg (for video processing)
- Python 3.12+ with standard library modules

**Python modules used:**
- argparse, csv, json, math, os, subprocess, sys, pathlib

## Common Usage Patterns

### Split session into lap clips
```bash
python3 kart_splitter.py \
  --video GOPR2000.MP4 \
  --first-lap 2:05.000 \
  --laps-csv laps_1.csv \
  --outdir laps_out
```

### Create lap comparison video
```bash
python3 lap_compare.py \
  --video GOPR2000.MP4 \
  --first-lap 2:05.000 \
  --laps-csv laps_1.csv \
  --select 10,11 \
  --out compare_10_vs_11.mp4 \
  --audio left
```

## File Structure

- `*.MP4` - GoPro video files
- `laps_*.csv` - Lap timing data in CSV format (headers: lap,time)
- `laps_out/` - Output directory for individual lap clips
- `compare_*.mp4` - Generated comparison videos

## Time Format Support

Both scripts support flexible timestamp parsing:
- Seconds: `43.605`
- Minutes:seconds: `01:23.456`
- Hours:minutes:seconds: `01:02:34.567`

## CSV Format

Lap timing CSV files should have headers with timing columns named: `time`, `laptime`, `lap_time`, or `duration`. Falls back to second column if headers not recognized.