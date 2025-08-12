class LapCompareApp {
    constructor() {
        // Session 1 data (left video)
        this.session1Data = {
            videoPath: null,
            jsonData: null,
            lapTimes: [],
            lapStarts: [],
            firstLapStart: null
        };
        
        // Session 2 data (right video)
        this.session2Data = {
            videoPath: null,
            jsonData: null,
            lapTimes: [],
            lapStarts: [],
            firstLapStart: null
        };
        
        this.selectedLaps = { lap1: null, lap2: null };
        this.isPlaying = false;
        this.currentSpeed = 1;
        this.isSeeking = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupElectronListeners();
    }
    
    initializeElements() {
        // File controls
        this.selectSession1Btn = document.getElementById('select-session1-btn');
        this.selectSession2Btn = document.getElementById('select-session2-btn');
        this.session1NameSpan = document.getElementById('session1-name');
        this.session2NameSpan = document.getElementById('session2-name');
        
        // Lap selection
        this.lap1Select = document.getElementById('lap1-select');
        this.lap2Select = document.getElementById('lap2-select');
        
        // Video elements
        this.video1 = document.getElementById('video1');
        this.video2 = document.getElementById('video2');
        this.lap1Title = document.getElementById('lap1-title');
        this.lap2Title = document.getElementById('lap2-title');
        this.lap1Time = document.getElementById('lap1-time');
        this.lap2Time = document.getElementById('lap2-time');
        this.lap1Duration = document.getElementById('lap1-duration');
        this.lap2Duration = document.getElementById('lap2-duration');
        
        // Controls
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.restartBtn = document.getElementById('restart-btn');
        this.seekSlider = document.getElementById('seek-slider');
        this.speedBtns = document.querySelectorAll('.speed-btn');
        this.syncBtn = document.getElementById('sync-btn');
        
        // Status
        this.statusText = document.getElementById('status-text');
        this.lapInfo = document.getElementById('lap-info');
    }
    
    setupEventListeners() {
        // File selection
        this.selectSession1Btn.addEventListener('click', () => {
            window.electronAPI.selectSession1File();
        });
        
        this.selectSession2Btn.addEventListener('click', () => {
            window.electronAPI.selectSession2File();
        });
        
        // Lap selection
        this.lap1Select.addEventListener('change', (e) => {
            this.handleLapSelection(1, parseInt(e.target.value));
        });
        
        this.lap2Select.addEventListener('change', (e) => {
            this.handleLapSelection(2, parseInt(e.target.value));
        });
        
        // Video controls
        this.playPauseBtn.addEventListener('click', () => {
            this.togglePlayPause();
        });
        
        this.restartBtn.addEventListener('click', () => {
            this.restartVideos();
        });
        
        this.seekSlider.addEventListener('input', (e) => {
            this.handleSeek(parseFloat(e.target.value));
        });
        
        this.seekSlider.addEventListener('mousedown', () => {
            this.isSeeking = true;
        });
        
        this.seekSlider.addEventListener('mouseup', () => {
            this.isSeeking = false;
        });
        
        // Speed controls
        this.speedBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.changeSpeed(parseFloat(e.target.dataset.speed));
            });
        });
        
        this.syncBtn.addEventListener('click', () => {
            this.syncVideos();
        });
        
        // Video event listeners
        this.video1.addEventListener('loadedmetadata', () => {
            this.updateVideoState();
        });
        
        this.video2.addEventListener('loadedmetadata', () => {
            this.updateVideoState();
        });
        
        this.video1.addEventListener('timeupdate', () => {
            this.updateTimeDisplay(1);
            if (!this.isSeeking) this.updateSeekSlider();
        });
        
        this.video2.addEventListener('timeupdate', () => {
            this.updateTimeDisplay(2);
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyPress(e);
        });
    }
    
    setupElectronListeners() {
        window.electronAPI.onJSONSelected((data) => {
            this.loadJSON(data);
        });
    }
    
    // Time parsing functions (converted from Python)
    parseTimestamp(timeStr) {
        const s = timeStr.trim();
        
        // Check if it's just seconds (e.g., "43.605")
        if (/^\d+\.?\d*$/.test(s)) {
            return parseFloat(s);
        }
        
        const parts = s.split(':');
        
        if (parts.length === 2) {
            // MM:SS(.mmm)
            const minutes = parseInt(parts[0]);
            const seconds = parseFloat(parts[1]);
            return minutes * 60 + seconds;
        } else if (parts.length === 3) {
            // HH:MM:SS(.mmm)
            const hours = parseInt(parts[0]);
            const minutes = parseInt(parts[1]);
            const seconds = parseFloat(parts[2]);
            return hours * 3600 + minutes * 60 + seconds;
        }
        
        throw new Error(`Unrecognized time format: ${timeStr}`);
    }
    
    formatTimestamp(seconds) {
        if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
            return '--:--:--';
        }
        
        const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
        const totalSeconds = Math.floor(seconds);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        
        if (h > 0) {
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
        } else {
            return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
        }
    }
    
    formatLapTime(seconds) {
        if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
            return '--:--.---';
        }
        
        const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
        const totalSeconds = Math.floor(seconds);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
    
    // CSV parsing
    parseCSV(csvContent) {
        const lines = csvContent.trim().split('\n');
        if (lines.length < 2) {
            throw new Error('CSV file must have at least a header and one data row');
        }
        
        const header = lines[0].split(',').map(h => h.trim().toLowerCase());
        const laps = [];
        
        // Find time column (same logic as Python script)
        const timeKeys = ['time', 'laptime', 'lap_time', 'duration'];
        let timeColumnIndex = -1;
        
        for (const key of timeKeys) {
            const index = header.indexOf(key);
            if (index !== -1) {
                timeColumnIndex = index;
                break;
            }
        }
        
        // If no recognized time column, use second column (index 1)
        if (timeColumnIndex === -1 && header.length >= 2) {
            timeColumnIndex = 1;
        }
        
        if (timeColumnIndex === -1) {
            throw new Error('Could not find time column in CSV');
        }
        
        // Parse lap times
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',').map(cell => cell.trim());
            if (row.length > timeColumnIndex && row[timeColumnIndex]) {
                try {
                    const lapTime = this.parseTimestamp(row[timeColumnIndex]);
                    laps.push(lapTime);
                } catch (error) {
                    console.warn(`Failed to parse lap time at row ${i}: ${row[timeColumnIndex]}`);
                }
            }
        }
        
        if (laps.length === 0) {
            throw new Error('No valid lap times found in CSV');
        }
        
        return laps;
    }
    
    // File loading
    loadJSON(data) {
        try {
            const sessionNumber = data.sessionNumber;
            const sessionData = sessionNumber === 1 ? this.session1Data : this.session2Data;
            const nameSpan = sessionNumber === 1 ? this.session1NameSpan : this.session2NameSpan;
            
            // Update session data
            sessionData.jsonData = data.data;
            sessionData.videoPath = data.videoPath;
            nameSpan.textContent = data.path.split(/[/\\]/).pop();
            
            // Parse lap times from JSON
            sessionData.lapTimes = sessionData.jsonData.laps.map(lapTime => this.parseTimestamp(lapTime));
            
            // Parse first lap start time
            sessionData.firstLapStart = this.parseTimestamp(sessionData.jsonData.first_lap);
            
            // Calculate lap starts for this session
            this.calculateLapStarts(sessionNumber);
            
            // Set video source for appropriate video element
            if (sessionNumber === 1) {
                this.video1.src = `file://${sessionData.videoPath}`;
            } else {
                this.video2.src = `file://${sessionData.videoPath}`;
            }
            
            this.populateLapSelectors();
            this.updateStatusText();
            this.updateVideoState();
        } catch (error) {
            this.statusText.textContent = `Error loading Session ${data.sessionNumber} JSON: ${error.message}`;
            console.error('JSON parsing error:', error);
        }
    }
    
    populateLapSelectors() {
        // Clear existing options
        this.lap1Select.innerHTML = '<option value="">Select a lap from session 1</option>';
        this.lap2Select.innerHTML = '<option value="">Select a lap from session 2</option>';
        
        // Populate lap 1 selector (Session 1)
        if (this.session1Data.lapTimes.length > 0) {
            this.session1Data.lapTimes.forEach((lapTime, index) => {
                const lapNumber = index + 1;
                const timeStr = this.formatLapTime(lapTime);
                const option1 = new Option(`Lap ${lapNumber} (${timeStr})`, lapNumber);
                this.lap1Select.appendChild(option1);
            });
            this.lap1Select.disabled = false;
        } else {
            this.lap1Select.disabled = true;
        }
        
        // Populate lap 2 selector (Session 2)
        if (this.session2Data.lapTimes.length > 0) {
            this.session2Data.lapTimes.forEach((lapTime, index) => {
                const lapNumber = index + 1;
                const timeStr = this.formatLapTime(lapTime);
                const option2 = new Option(`Lap ${lapNumber} (${timeStr})`, lapNumber);
                this.lap2Select.appendChild(option2);
            });
            this.lap2Select.disabled = false;
        } else {
            this.lap2Select.disabled = true;
        }
    }
    
    
    calculateLapStarts(sessionNumber) {
        const sessionData = sessionNumber === 1 ? this.session1Data : this.session2Data;
        sessionData.lapStarts = [];
        
        if (!isFinite(sessionData.firstLapStart) || sessionData.lapTimes.length === 0) {
            console.warn(`Cannot calculate lap starts for session ${sessionNumber}: invalid firstLapStart or no lap times`);
            return;
        }
        
        let cumulative = 0;
        
        sessionData.lapTimes.forEach((lapTime, index) => {
            if (isFinite(lapTime) && lapTime > 0) {
                sessionData.lapStarts.push(sessionData.firstLapStart + cumulative);
                cumulative += lapTime;
            } else {
                console.warn(`Invalid lap time at index ${index} for session ${sessionNumber}: ${lapTime}`);
                sessionData.lapStarts.push(NaN);
            }
        });
    }
    
    handleLapSelection(videoNum, lapNum) {
        const sessionData = videoNum === 1 ? this.session1Data : this.session2Data;
        
        if (!lapNum || lapNum < 1 || lapNum > sessionData.lapTimes.length) {
            this.selectedLaps[`lap${videoNum}`] = null;
            return;
        }
        
        this.selectedLaps[`lap${videoNum}`] = lapNum;
        this.updateLapDisplay(videoNum, lapNum);
        this.updateVideoState();
    }
    
    updateLapDisplay(videoNum, lapNum) {
        const sessionData = videoNum === 1 ? this.session1Data : this.session2Data;
        const lapIndex = lapNum - 1;
        const lapTime = sessionData.lapTimes[lapIndex];
        const formattedTime = this.formatLapTime(lapTime);
        
        if (videoNum === 1) {
            this.lap1Title.textContent = `Lap ${lapNum} (Session 1)`;
            this.lap1Duration.textContent = formattedTime;
        } else {
            this.lap2Title.textContent = `Lap ${lapNum} (Session 2)`;
            this.lap2Duration.textContent = formattedTime;
        }
    }
    
    updateStatusText() {
        const hasSession1 = this.session1Data.jsonData !== null;
        const hasSession2 = this.session2Data.jsonData !== null;
        const session1LapCount = this.session1Data.lapTimes.length;
        const session2LapCount = this.session2Data.lapTimes.length;
        
        if (hasSession1 && hasSession2) {
            this.statusText.textContent = `Both sessions loaded - Session 1: ${session1LapCount} laps, Session 2: ${session2LapCount} laps`;
        } else if (hasSession1) {
            this.statusText.textContent = `Session 1 loaded (${session1LapCount} laps) - Select Session 2 JSON file`;
        } else if (hasSession2) {
            this.statusText.textContent = `Session 2 loaded (${session2LapCount} laps) - Select Session 1 JSON file`;
        } else {
            this.statusText.textContent = 'Ready - Select JSON files for both sessions to begin';
        }
    }
    
    updateVideoState() {
        const hasSession1 = this.session1Data.jsonData !== null && this.session1Data.videoPath !== null;
        const hasSession2 = this.session2Data.jsonData !== null && this.session2Data.videoPath !== null;
        const hasSession1Data = this.session1Data.lapTimes.length > 0 && isFinite(this.session1Data.firstLapStart);
        const hasSession2Data = this.session2Data.lapTimes.length > 0 && isFinite(this.session2Data.firstLapStart);
        const hasBothLaps = this.selectedLaps.lap1 && this.selectedLaps.lap2;
        const hasValidSession1Starts = this.session1Data.lapStarts.length > 0 && this.session1Data.lapStarts.some(start => isFinite(start));
        const hasValidSession2Starts = this.session2Data.lapStarts.length > 0 && this.session2Data.lapStarts.some(start => isFinite(start));
        
        const canPlay = hasSession1 && hasSession2 && hasSession1Data && hasSession2Data && hasBothLaps && hasValidSession1Starts && hasValidSession2Starts;
        
        this.playPauseBtn.disabled = !canPlay;
        this.restartBtn.disabled = !canPlay;
        this.seekSlider.disabled = !canPlay;
        this.syncBtn.disabled = !canPlay;
        
        if (canPlay) {
            this.statusText.textContent = 'Ready to compare laps';
            this.syncVideos();
        } else if (!hasBothLaps && hasSession1 && hasSession2) {
            this.statusText.textContent = 'Select laps from both sessions to compare';
        }
    }
    
    syncVideos() {
        if (!this.selectedLaps.lap1 || !this.selectedLaps.lap2) return;
        
        const lap1Index = this.selectedLaps.lap1 - 1;
        const lap2Index = this.selectedLaps.lap2 - 1;
        
        if (lap1Index < 0 || lap1Index >= this.session1Data.lapStarts.length ||
            lap2Index < 0 || lap2Index >= this.session2Data.lapStarts.length) {
            console.error('Invalid lap selection for sync');
            return;
        }
        
        const lap1Start = this.session1Data.lapStarts[lap1Index];
        const lap2Start = this.session2Data.lapStarts[lap2Index];
        
        if (!isFinite(lap1Start) || !isFinite(lap2Start)) {
            console.error('Invalid lap start times for sync:', { lap1Start, lap2Start });
            this.statusText.textContent = 'Error: Invalid lap timing data';
            return;
        }
        
        // Ensure video currentTime is within valid bounds
        const video1Duration = this.video1.duration || Infinity;
        const video2Duration = this.video2.duration || Infinity;
        
        if (lap1Start >= 0 && lap1Start < video1Duration) {
            this.video1.currentTime = lap1Start;
        }
        
        if (lap2Start >= 0 && lap2Start < video2Duration) {
            this.video2.currentTime = lap2Start;
        }
        
        this.updateTimeDisplay(1);
        this.updateTimeDisplay(2);
    }
    
    togglePlayPause() {
        if (this.isPlaying) {
            this.video1.pause();
            this.video2.pause();
            this.playPauseBtn.textContent = '▶️';
            this.isPlaying = false;
        } else {
            this.video1.play();
            this.video2.play();
            this.playPauseBtn.textContent = '⏸️';
            this.isPlaying = true;
        }
    }
    
    restartVideos() {
        this.syncVideos();
        if (this.isPlaying) {
            setTimeout(() => {
                this.video1.play();
                this.video2.play();
            }, 50);
        }
    }
    
    changeSpeed(speed) {
        this.currentSpeed = speed;
        this.video1.playbackRate = speed;
        this.video2.playbackRate = speed;
        
        // Update button states
        this.speedBtns.forEach(btn => {
            btn.classList.toggle('active', parseFloat(btn.dataset.speed) === speed);
        });
    }
    
    handleSeek(percentage) {
        if (!this.selectedLaps.lap1 || !this.selectedLaps.lap2) return;
        
        const lap1Index = this.selectedLaps.lap1 - 1;
        const lap2Index = this.selectedLaps.lap2 - 1;
        
        if (lap1Index < 0 || lap1Index >= this.session1Data.lapStarts.length ||
            lap2Index < 0 || lap2Index >= this.session2Data.lapStarts.length) {
            return;
        }
        
        const lap1Start = this.session1Data.lapStarts[lap1Index];
        const lap2Start = this.session2Data.lapStarts[lap2Index];
        const lap1Duration = this.session1Data.lapTimes[lap1Index];
        const lap2Duration = this.session2Data.lapTimes[lap2Index];
        
        if (!isFinite(lap1Start) || !isFinite(lap2Start) || 
            !isFinite(lap1Duration) || !isFinite(lap2Duration)) {
            console.error('Invalid data for seek operation');
            return;
        }
        
        const maxDuration = Math.max(lap1Duration, lap2Duration);
        const seekTime = (percentage / 100) * maxDuration;
        
        const newTime1 = lap1Start + Math.min(seekTime, lap1Duration);
        const newTime2 = lap2Start + Math.min(seekTime, lap2Duration);
        
        const video1Duration = this.video1.duration || Infinity;
        const video2Duration = this.video2.duration || Infinity;
        
        if (newTime1 >= 0 && newTime1 < video1Duration) {
            this.video1.currentTime = newTime1;
        }
        
        if (newTime2 >= 0 && newTime2 < video2Duration) {
            this.video2.currentTime = newTime2;
        }
    }
    
    updateSeekSlider() {
        if (!this.selectedLaps.lap1 || !this.selectedLaps.lap2) return;
        
        const lap1Index = this.selectedLaps.lap1 - 1;
        const lap1Start = this.session1Data.lapStarts[lap1Index];
        const lap1Duration = this.session1Data.lapTimes[lap1Index];
        const lap2Duration = this.session2Data.lapTimes[this.selectedLaps.lap2 - 1];
        
        const maxDuration = Math.max(lap1Duration, lap2Duration);
        const currentProgress = Math.max(0, this.video1.currentTime - lap1Start);
        const percentage = (currentProgress / maxDuration) * 100;
        
        this.seekSlider.value = Math.min(100, Math.max(0, percentage));
    }
    
    updateTimeDisplay(videoNum) {
        const video = videoNum === 1 ? this.video1 : this.video2;
        const timeSpan = videoNum === 1 ? this.lap1Time : this.lap2Time;
        const lapNum = this.selectedLaps[`lap${videoNum}`];
        const sessionData = videoNum === 1 ? this.session1Data : this.session2Data;
        
        if (!lapNum) return;
        
        const lapIndex = lapNum - 1;
        const lapStart = sessionData.lapStarts[lapIndex];
        const currentLapTime = Math.max(0, video.currentTime - lapStart);
        
        timeSpan.textContent = this.formatTimestamp(currentLapTime);
    }
    
    handleKeyPress(event) {
        // Ignore if user is typing in an input field
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;
        
        switch (event.code) {
            case 'Space':
                event.preventDefault();
                if (!this.playPauseBtn.disabled) {
                    this.togglePlayPause();
                }
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.handleSeek(Math.max(0, this.seekSlider.value - 5));
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.handleSeek(Math.min(100, this.seekSlider.value + 5));
                break;
            case 'KeyR':
                if (event.ctrlKey || event.metaKey) return;
                event.preventDefault();
                if (!this.restartBtn.disabled) {
                    this.restartVideos();
                }
                break;
            case 'KeyS':
                if (event.ctrlKey || event.metaKey) return;
                event.preventDefault();
                if (!this.syncBtn.disabled) {
                    this.syncVideos();
                }
                break;
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LapCompareApp();
});