const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectJSONFile: () => ipcRenderer.invoke('select-json-file'),
  
  onJSONSelected: (callback) => {
    ipcRenderer.on('json-selected', (event, data) => callback(data));
  },
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});