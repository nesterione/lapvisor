const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectSession1File: () => ipcRenderer.invoke('select-session1-file'),
  selectSession2File: () => ipcRenderer.invoke('select-session2-file'),
  
  onJSONSelected: (callback) => {
    ipcRenderer.on('json-selected', (event, data) => callback(data));
  },
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});