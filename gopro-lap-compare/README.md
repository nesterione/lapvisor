# GoPro Lap Compare

A desktop application for comparing GoPro kart racing laps side-by-side in real-time, supporting both single-session and cross-session lap comparisons.

## Features

- **Real-time Playback**: Compare two laps without creating video files
- **Cross-Session Comparisons**: Compare laps from different racing sessions/videos
- **Synchronized Controls**: Play, pause, and seek both videos together  
- **Precise Timing**: Uses the same timing logic as the Python scripts
- **Speed Control**: Playback at 0.5x, 1x, 1.5x, or 2x speed
- **Live Timing**: Shows current lap time and total lap duration
- **Keyboard Shortcuts**: Quick control with space, arrow keys, and more

## Usage

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Application
```bash
npm start
```

### 3. Load Session Files

#### For Same-Session Comparison (comparing laps from one video):
1. Click **"📄 Select Session 1 JSON"** to choose your session file
2. Click **"📄 Select Session 2 JSON"** and choose the same session file again
3. Both videos will use the same session data, allowing you to compare different laps from the same video

#### For Cross-Session Comparison (comparing laps from different videos):
1. Click **"📄 Select Session 1 JSON"** to choose the first session file
2. Click **"📄 Select Session 2 JSON"** to choose the second session file
3. Each JSON file contains video filename, first lap timing, and lap times
4. Video files should be in the same directory as their respective JSON files

### 4. Select Laps to Compare
1. Choose **Lap 1 (Session 1)** from the first dropdown
2. Choose **Lap 2 (Session 2)** from the second dropdown
   - For same-session comparison: both dropdowns will show laps from the same session
   - For cross-session comparison: each dropdown shows laps from its respective session

### 5. Controls
- **Space**: Play/Pause
- **R**: Restart both videos
- **S**: Re-sync videos
- **Arrow Left/Right**: Seek backward/forward
- **Speed Buttons**: Change playback speed

## Session JSON Format

The application now uses a unified JSON format that contains all session data:

```json
{
  "video": "GOPR2000.MP4",
  "first_lap": "2:05.000",
  "laps": [
    "00:48.561",
    "00:49.107",
    "00:46.274",
    "00:46.559",
    "00:46.238"
  ],
  "metadata": {}
}
```

### Format Details:
- **`video`**: Filename of the GoPro video file (relative to JSON file location)
- **`first_lap`**: Timestamp when the first lap starts in the video
- **`laps`**: Array of lap duration strings in MM:SS.mmm format
- **`metadata`**: Optional object for future extensions (GPS data, etc.)

### Supported Time Formats:
- Seconds: `43.605`
- Minutes:seconds: `01:23.456`  
- Hours:minutes:seconds: `01:02:34.567`

## Development

### Run in Development Mode
```bash
npm run dev
```

### Build Distribution
```bash
npm run dist
```

## Migration from CSV

If you have existing CSV files, you can create a JSON session file manually:

1. Create a new `.json` file (e.g., `GOPR2000.json`)
2. Use the format shown above
3. Copy lap times from your CSV file into the `laps` array
4. Set the `video` filename and `first_lap` timing

## Cross-Session Comparison Benefits

- **Performance Analysis**: Compare your best lap from different track days
- **Improvement Tracking**: See how your driving has evolved over time
- **Setup Comparison**: Analyze the effect of different kart setups
- **Weather/Conditions**: Compare performance in different track conditions
- **Driver Comparison**: Compare laps between different drivers

## Technical Notes

- Uses HTML5 video players for real-time playback
- Implements the same timing calculations as the Python scripts
- Videos are synchronized by calculating lap start times: `firstLapStart + sum(previousLapDurations)`
- Supports flexible timestamp formats: seconds, MM:SS, or HH:MM:SS
- JSON format allows for future extension with GPS tracks, telemetry data, etc.
- Cross-session comparison works with different video files and timing data
- Each session maintains independent timing calculations for accurate synchronization