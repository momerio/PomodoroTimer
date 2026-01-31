const timerDisplay = document.getElementById('time');
const startPauseBtn = document.getElementById('start-pause-btn');
const resetBtn = document.getElementById('reset-btn');
const modeButtons = document.querySelectorAll('.mode-btn');
const taskInput = document.getElementById('task-input');
const cycleCountDisplay = document.getElementById('cycle-count');
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const themeToggle = document.getElementById('theme-toggle');
const logList = document.getElementById('log-list');
const clearLogBtn = document.getElementById('clear-log-btn');
const downloadLogBtn = document.getElementById('download-log-btn');

// Settings Inputs
const workDurationMinInput = document.getElementById('work-duration-min');
const workDurationSecInput = document.getElementById('work-duration-sec');
const shortBreakDurationMinInput = document.getElementById('short-break-duration-min');
const shortBreakDurationSecInput = document.getElementById('short-break-duration-sec');
const longBreakDurationMinInput = document.getElementById('long-break-duration-min');
const longBreakDurationSecInput = document.getElementById('long-break-duration-sec');
const longBreakIntervalInput = document.getElementById('long-break-interval');
const autoStartInput = document.getElementById('auto-start');
const notificationSoundInput = document.getElementById('notification-sound');
const brownNoiseToggleInput = document.getElementById('brown-noise-toggle');
const brownNoiseVolumeInput = document.getElementById('brown-noise-volume');

// Notification elements
const notificationToast = document.getElementById('notification-toast');
const notificationMessage = document.getElementById('notification-message');

// Privacy policy elements
const privacyModal = document.getElementById('privacy-modal');
const privacyLink = document.getElementById('privacy-policy-link');
const closePrivacyModal = document.getElementById('close-privacy-modal');

let timerState = 'stopped'; // 'running', 'paused', 'stopped'
let currentMode = 'work'; // 'work', 'shortBreak', 'longBreak'
let timeLeft = 25 * 60;
let timerInterval = null;
let cycleCount = 0;
let sessionInitialTime = 25 * 60; // 追加: セッション開始時の残り時間

let settings = {
    work: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60,
    longBreakInterval: 4,
    autoStart: true,
    notificationSound: true,
    brownNoise: false,
    brownNoiseVolume: 0.5
};

let logs = [];

class BrownNoiseManager {
    constructor() {
        this.audioContext = null;
        this.source = null;
        this.gainNode = null;
        this.buffer = null;
        this.isPlaying = false;
    }

    init() {
        if (this.audioContext) return;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = settings.brownNoiseVolume;
        this.gainNode.connect(this.audioContext.destination);
        this.createBuffer();
    }

    createBuffer() {
        const bufferSize = 5 * this.audioContext.sampleRate; // 5 seconds
        this.buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const output = this.buffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5; // volume compensation
        }
    }

    start() {
        if (!settings.brownNoise || this.isPlaying) return;
        this.init();
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.loop = true;
        this.source.connect(this.gainNode);
        this.source.start();
        this.isPlaying = true;
    }

    stop() {
        if (this.source && this.isPlaying) {
            this.source.stop();
            this.isPlaying = false;
        }
    }

    setVolume(volume) {
        if (this.gainNode) {
            this.gainNode.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.1);
        }
    }
}

const brownNoiseManager = new BrownNoiseManager();

// Initialize
function init() {
    try {
        loadData();
    } catch (e) {
        console.error('Failed to load data:', e);
        settings = {
            work: 25 * 60,
            shortBreak: 5 * 60,
            longBreak: 15 * 60,
            longBreakInterval: 4,
            autoStart: true,
            notificationSound: true
        };
    }

    resetTimer();
    applyTheme();
    renderLogs();

    // Event Listeners
    if (startPauseBtn) startPauseBtn.addEventListener('click', toggleTimer);
    if (resetBtn) resetBtn.addEventListener('click', resetTimer);

    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });

    if (settingsToggle) {
        settingsToggle.addEventListener('click', () => {
            if (settingsPanel) settingsPanel.classList.toggle('hidden');
        });
    }

    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    // Settings Change Listeners
    const inputs = [
        workDurationMinInput, workDurationSecInput,
        shortBreakDurationMinInput, shortBreakDurationSecInput,
        longBreakDurationMinInput, longBreakDurationSecInput,
        longBreakIntervalInput
    ];

    inputs.forEach(input => {
        if (input) {
            input.addEventListener('change', updateSettings);
        }
    });

    if (autoStartInput) {
        autoStartInput.addEventListener('change', () => {
            settings.autoStart = autoStartInput.checked;
            saveData();
        });
    }

    if (notificationSoundInput) {
        notificationSoundInput.addEventListener('change', () => {
            settings.notificationSound = notificationSoundInput.checked;
            saveData();
        });
    }

    if (brownNoiseToggleInput) {
        brownNoiseToggleInput.addEventListener('change', () => {
            settings.brownNoise = brownNoiseToggleInput.checked;
            saveData();
            if (settings.brownNoise) {
                brownNoiseManager.start();
            } else {
                brownNoiseManager.stop();
            }
        });
    }

    if (brownNoiseVolumeInput) {
        brownNoiseVolumeInput.addEventListener('input', () => {
            settings.brownNoiseVolume = parseFloat(brownNoiseVolumeInput.value);
            brownNoiseManager.setVolume(settings.brownNoiseVolume);
            saveData();
        });
    }

    if (clearLogBtn) clearLogBtn.addEventListener('click', clearLogs);
    if (downloadLogBtn) downloadLogBtn.addEventListener('click', downloadCSV);

    // Privacy policy modal
    if (privacyLink) {
        privacyLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (privacyModal) privacyModal.classList.remove('hidden');
        });
    }

    if (closePrivacyModal) {
        closePrivacyModal.addEventListener('click', () => {
            if (privacyModal) privacyModal.classList.add('hidden');
        });
    }

    // Close modal when clicking outside
    if (privacyModal) {
        privacyModal.addEventListener('click', (e) => {
            if (e.target === privacyModal) {
                privacyModal.classList.add('hidden');
            }
        });
    }

    // Editable Timer & Cycle Count
    if (timerDisplay) {
        timerDisplay.classList.add('editable-cursor');
        timerDisplay.addEventListener('dblclick', makeTimerEditable);
    }
    if (cycleCountDisplay) {
        cycleCountDisplay.classList.add('editable-cursor');
        cycleCountDisplay.addEventListener('dblclick', makeCycleEditable);
    }
}

function loadData() {
    try {
        const savedSettings = localStorage.getItem('pomodoroSettings');
        if (savedSettings) {
            settings = JSON.parse(savedSettings);
            if (isNaN(settings.work)) settings.work = 25 * 60;
            if (isNaN(settings.shortBreak)) settings.shortBreak = 5 * 60;
            if (isNaN(settings.longBreak)) settings.longBreak = 15 * 60;
            if (isNaN(settings.longBreakInterval)) settings.longBreakInterval = 4;
            if (settings.autoStart === undefined) settings.autoStart = true;
            if (settings.notificationSound === undefined) settings.notificationSound = true;
            settings.brownNoise = false; // Always OFF on reload
            if (settings.brownNoiseVolume === undefined) settings.brownNoiseVolume = 0.5;
        }
    } catch (e) {
        console.error('Error parsing settings:', e);
        localStorage.removeItem('pomodoroSettings');
    }

    updateInputFields();

    try {
        const savedLogs = localStorage.getItem('pomodoroLogs');
        if (savedLogs) {
            logs = JSON.parse(savedLogs);
        }
    } catch (e) {
        console.error('Error parsing logs:', e);
        localStorage.removeItem('pomodoroLogs');
    }
}

function updateInputFields() {
    if (workDurationMinInput) workDurationMinInput.value = Math.floor(settings.work / 60);
    if (workDurationSecInput) workDurationSecInput.value = settings.work % 60;

    if (shortBreakDurationMinInput) shortBreakDurationMinInput.value = Math.floor(settings.shortBreak / 60);
    if (shortBreakDurationSecInput) shortBreakDurationSecInput.value = settings.shortBreak % 60;

    if (longBreakDurationMinInput) longBreakDurationMinInput.value = Math.floor(settings.longBreak / 60);
    if (longBreakDurationSecInput) longBreakDurationSecInput.value = settings.longBreak % 60;

    if (longBreakIntervalInput) longBreakIntervalInput.value = settings.longBreakInterval;
    if (autoStartInput) autoStartInput.checked = settings.autoStart;
    if (notificationSoundInput) notificationSoundInput.checked = settings.notificationSound;
    if (brownNoiseToggleInput) brownNoiseToggleInput.checked = settings.brownNoise;
    if (brownNoiseVolumeInput) brownNoiseVolumeInput.value = settings.brownNoiseVolume;
}

function saveData() {
    try {
        localStorage.setItem('pomodoroSettings', JSON.stringify(settings));
        localStorage.setItem('pomodoroLogs', JSON.stringify(logs));
    } catch (e) {
        console.error('Error saving data:', e);
    }
}

function updateSettings() {
    const workMin = parseInt(workDurationMinInput.value) || 0;
    const workSec = parseInt(workDurationSecInput.value) || 0;
    settings.work = (workMin * 60) + workSec;

    const shortBreakMin = parseInt(shortBreakDurationMinInput.value) || 0;
    const shortBreakSec = parseInt(shortBreakDurationSecInput.value) || 0;
    settings.shortBreak = (shortBreakMin * 60) + shortBreakSec;

    const longBreakMin = parseInt(longBreakDurationMinInput.value) || 0;
    const longBreakSec = parseInt(longBreakDurationSecInput.value) || 0;
    settings.longBreak = (longBreakMin * 60) + longBreakSec;

    settings.longBreakInterval = parseInt(longBreakIntervalInput.value) || 4;

    saveData();
    if (timerState === 'stopped') {
        resetTimer();
    }
}

function toggleTimer() {
    if (timerState === 'running') {
        pauseTimer();
    } else {
        startTimer();
    }
}

function startTimer() {
    timerState = 'running';
    startPauseBtn.textContent = '一時停止';
    startPauseBtn.classList.add('active');
    resetBtn.disabled = true;

    timerInterval = setInterval(() => {
        timeLeft--;
        updateDisplay();

        if (timeLeft <= 0) {
            handleTimerComplete();
        }
    }, 1000);
}

function pauseTimer() {
    timerState = 'paused';
    startPauseBtn.textContent = '再開';
    startPauseBtn.classList.remove('active');
    resetBtn.disabled = false;
    clearInterval(timerInterval);
}

function resetTimer() {
    if (timerState === 'paused') {
        const elapsed = sessionInitialTime - timeLeft;
        if (elapsed > 0) {
            let taskName = null;
            if (currentMode === 'shortBreak') taskName = '小休憩';
            else if (currentMode === 'longBreak') taskName = '大休憩';

            logSession(currentMode === 'work' ? '作業' : '休憩', taskName, elapsed);
        }
    }

    pauseTimer();
    timerState = 'stopped';
    startPauseBtn.textContent = '開始';

    if (currentMode === 'work') timeLeft = settings.work;
    else if (currentMode === 'shortBreak') timeLeft = settings.shortBreak;
    else if (currentMode === 'longBreak') timeLeft = settings.longBreak;

    sessionInitialTime = timeLeft; // リセット時の時間を保持
    updateDisplay();
}

function switchMode(mode) {
    currentMode = mode;

    modeButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === mode) btn.classList.add('active');
    });

    const body = document.body;
    if (mode === 'work') body.style.backgroundColor = 'var(--primary-color)';
    else if (mode === 'shortBreak') body.style.backgroundColor = 'var(--secondary-color)';
    else if (mode === 'longBreak') body.style.backgroundColor = 'var(--tertiary-color)';

    resetTimer();
}

function handleTimerComplete() {
    pauseTimer();

    if (currentMode === 'work') {
        showNotification('作業時間が終了しました！');
        cycleCount++;
        cycleCountDisplay.textContent = cycleCount;
        logSession('作業', null, sessionInitialTime - timeLeft);

        if (cycleCount % settings.longBreakInterval === 0) {
            switchMode('longBreak');
        } else {
            switchMode('shortBreak');
        }
    } else {
        showNotification('休憩時間が終了しました！');
        const breakName = currentMode === 'shortBreak' ? '小休憩' : '大休憩';
        logSession('休憩', breakName, sessionInitialTime - timeLeft);
        switchMode('work');
    }

    if (settings.autoStart) {
        startTimer();
    } else {
        startPauseBtn.textContent = '開始';
    }
}

function showNotification(message) {
    if (notificationMessage) notificationMessage.textContent = message;
    if (notificationToast) {
        notificationToast.classList.remove('hidden', 'fade-out');

        if (settings.notificationSound) {
            playNotificationSound();
        }

        setTimeout(() => {
            if (notificationToast) {
                notificationToast.classList.add('fade-out');
                setTimeout(() => {
                    notificationToast.classList.add('hidden');
                }, 300);
            }
        }, 3000);
    }
}

function playNotificationSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.title = `${timerDisplay.textContent} - Pomodoro Timer`;
}

function logSession(genre, taskNameOverride = null, elapsedSeconds = null) {
    let taskName = taskNameOverride;
    if (!taskName) {
        taskName = taskInput.value.trim() || '名無しのタスク';
    }

    let durationMin, durationSec;
    if (elapsedSeconds !== null) {
        durationMin = Math.floor(elapsedSeconds / 60);
        durationSec = elapsedSeconds % 60;
    } else if (genre === '作業') {
        durationMin = Math.floor(settings.work / 60);
        durationSec = settings.work % 60;
    } else {
        if (taskName === '小休憩') {
            durationMin = Math.floor(settings.shortBreak / 60);
            durationSec = settings.shortBreak % 60;
        } else {
            durationMin = Math.floor(settings.longBreak / 60);
            durationSec = settings.longBreak % 60;
        }
    }

    const durationStr = durationSec > 0 ? `${durationMin}分${durationSec}秒` : `${durationMin}分`;

    const logEntry = {
        genre: genre,
        task: taskName,
        time: new Date().toLocaleString('ja-JP'),
        duration: durationStr
    };

    logs.unshift(logEntry);
    saveData();
    renderLogs();
}

function renderLogs() {
    logList.innerHTML = '';
    logs.forEach((log, index) => {
        const li = document.createElement('li');
        li.className = 'log-item';

        const taskSpan = document.createElement('span');
        taskSpan.textContent = log.task;
        taskSpan.title = "ダブルクリックで編集";
        taskSpan.addEventListener('dblclick', () => makeLogTaskEditable(index, taskSpan));

        const metaSpan = document.createElement('span');
        metaSpan.className = 'log-meta';

        const durSpan = document.createElement('span');
        durSpan.textContent = log.duration;
        durSpan.title = "ダブルクリックで時間を編集";
        durSpan.style.marginRight = "5px";
        durSpan.addEventListener('dblclick', () => makeLogDurationEditable(index, durSpan));

        const timeSpan = document.createElement('span');
        timeSpan.textContent = ` - ${log.time}`;

        metaSpan.appendChild(durSpan);
        metaSpan.appendChild(timeSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&times;';
        deleteBtn.className = 'delete-log-btn';
        deleteBtn.title = 'このログを削除';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteLog(index);
        };

        li.appendChild(taskSpan);
        li.appendChild(metaSpan);
        li.appendChild(deleteBtn);

        logList.appendChild(li);
    });
}

function deleteLog(index) {
    const logTask = logs[index].task;
    if (confirm(`"${logTask}"を削除しますか？`)) {
        logs.splice(index, 1);
        saveData();
        renderLogs();
    }
}

function makeLogTaskEditable(index, element) {
    const currentText = logs[index].task;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'log-input';
    input.style.width = '150px';

    const finishEdit = () => {
        const val = input.value.trim();
        if (val) {
            logs[index].task = val;
            saveData();
        }
        renderLogs();
    };

    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        }
    });

    element.replaceWith(input);
    input.focus();
}

function makeLogDurationEditable(index, element) {
    const currentText = logs[index].duration;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'log-input';
    input.style.width = '80px';
    input.placeholder = "X分Y秒";

    const finishEdit = () => {
        const val = input.value.trim();
        if (val) {
            logs[index].duration = val;
            saveData();
        }
        renderLogs();
    };

    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        }
    });

    element.replaceWith(input);
    input.focus();
}

function clearLogs() {
    if (confirm('ログを全て消去しますか？')) {
        logs = [];
        saveData();
        renderLogs();
    }
}

function escapeCSV(str) {
    if (str == null) return "";
    str = String(str);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function downloadCSV() {
    if (logs.length === 0) {
        showNotification('出力するログがありません');
        return;
    }

    let csvContent = "No,ジャンル,タスク,実行時間,日時\n";

    logs.forEach((log, index) => {
        const row = [
            index + 1,
            escapeCSV(log.genre || '作業'),
            escapeCSV(log.task),
            escapeCSV(log.duration),
            escapeCSV(log.time)
        ];
        csvContent += row.join(",") + "\n";
    });

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pomodoro_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

function applyTheme() {
    const savedTheme = localStorage.getItem('pomodoroTheme');
    const body = document.body;
    const icon = themeToggle ? themeToggle.querySelector('i') : null;

    if (savedTheme === 'dark') {
        body.setAttribute('data-theme', 'dark');
        if (icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    } else {
        body.removeAttribute('data-theme');
        if (icon) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }
}

function toggleTheme() {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme');
    const icon = themeToggle.querySelector('i');

    if (currentTheme === 'dark') {
        body.removeAttribute('data-theme');
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
        localStorage.setItem('pomodoroTheme', 'light');
    } else {
        body.setAttribute('data-theme', 'dark');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
        localStorage.setItem('pomodoroTheme', 'dark');
    }
}

function makeTimerEditable() {
    if (timerState === 'running') return;

    const currentText = timerDisplay.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'timer-input';
    input.maxLength = 5;
    input.placeholder = "MM:SS";

    const finishEdit = () => {
        const val = input.value;
        const match = val.match(/^(\d{1,2}):(\d{2})$/);
        if (match) {
            const min = parseInt(match[1]);
            const sec = parseInt(match[2]);
            if (sec < 60) {
                timeLeft = (min * 60) + sec;
            }
        }

        if (input.parentNode) {
            input.replaceWith(timerDisplay);
        }
        sessionInitialTime = timeLeft; // 編集後の時間を初期時間として設定
        updateDisplay();
    };

    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        }
    });

    timerDisplay.replaceWith(input);
    input.focus();
}

function makeCycleEditable() {
    const currentCount = cycleCountDisplay.textContent;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = currentCount;
    input.className = 'cycle-input';
    input.min = 0;

    const finishEdit = () => {
        const val = parseInt(input.value);
        if (!isNaN(val) && val >= 0) {
            cycleCount = val;
        }

        if (input.parentNode) {
            input.replaceWith(cycleCountDisplay);
        }
        cycleCountDisplay.textContent = cycleCount;
    };

    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        }
    });

    cycleCountDisplay.replaceWith(input);
    input.focus();
}

document.addEventListener('DOMContentLoaded', () => {
    const copyrightYear = document.getElementById('copyright-year');
    if (copyrightYear) {
        copyrightYear.textContent = new Date().getFullYear();
    }
});

init();