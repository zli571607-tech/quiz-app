const { contextBridge, ipcRenderer } = require('electron')

// 向渲染进程暴露安全的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 文件操作
  openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
  readTextFile: (filePath) => ipcRenderer.invoke('file:readText', filePath),
  readBinaryFile: (filePath) => ipcRenderer.invoke('file:readBinary', filePath),
  getFileInfo: (filePath) => ipcRenderer.invoke('file:getInfo', filePath),
})
