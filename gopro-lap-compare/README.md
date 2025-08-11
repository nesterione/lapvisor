# GoPro Lap Compare

A desktop application for comparing GoPro kart racing laps side-by-side in real-time.

## Features

- **Real-time Playback**: Compare two laps without creating video files
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

### 3. Load Session File
1. Click **"📄 Select Session JSON"** to choose your session file
   - The JSON file contains video filename, first lap timing, and lap times
   - Video file should be in the same directory as the JSON file

### 4. Select Laps to Compare
1. Choose **Lap 1** from the first dropdown
2. Choose **Lap 2** from the second dropdown

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

## Technical Notes

- Uses HTML5 video players for real-time playback
- Implements the same timing calculations as the Python scripts
- Videos are synchronized by calculating lap start times: `firstLapStart + sum(previousLapDurations)`
- Supports flexible timestamp formats: seconds, MM:SS, or HH:MM:SS
- JSON format allows for future extension with GPS tracks, telemetry data, etc.