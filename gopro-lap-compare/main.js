const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    },
    show: false
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Session 1 JSON...',
          accelerator: 'CmdOrCtrl+1',
          click: () => selectJSONFile(1)
        },
        {
          label: 'Open Session 2 JSON...',
          accelerator: 'CmdOrCtrl+2',
          click: () => selectJSONFile(2)
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow.reload()
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => mainWindow.toggleDevTools()
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function selectJSONFile(sessionNumber) {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: `Select Session ${sessionNumber} JSON File`,
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const jsonContent = await fs.readFile(result.filePaths[0], 'utf8');
      const jsonData = JSON.parse(jsonContent);
      
      // Resolve video path relative to JSON file location
      const jsonDir = require('path').dirname(result.filePaths[0]);
      const videoPath = require('path').resolve(jsonDir, jsonData.video);
      
      mainWindow.webContents.send('json-selected', {
        sessionNumber: sessionNumber,
        path: result.filePaths[0],
        data: jsonData,
        videoPath: videoPath
      });
    } catch (error) {
      dialog.showErrorBox('Error', `Failed to read Session ${sessionNumber} JSON file: ${error.message}`);
    }
  }
}

ipcMain.handle('select-session1-file', async () => {
  await selectJSONFile(1);
});

ipcMain.handle('select-session2-file', async () => {
  await selectJSONFile(2);
});

app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});