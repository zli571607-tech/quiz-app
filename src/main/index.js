const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

// 判断是否为开发模式
const isDev = !app.isPackaged

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#FFFFFF',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    titleBarStyle: 'default',
  })

  // 开发模式加载 Vite 开发服务器，生产模式加载打包文件
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // 自动打开开发者工具
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
}

// ============ IPC 通信 ============

// 打开文件选择对话框
ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择文档',
    filters: [
      { name: '所有支持的文档', extensions: ['pdf', 'docx', 'txt', 'pptx'] },
      { name: 'PDF 文件', extensions: ['pdf'] },
      { name: 'Word 文档', extensions: ['docx'] },
      { name: '文本文件', extensions: ['txt'] },
      { name: 'PPT 文件', extensions: ['pptx'] },
    ],
    properties: ['openFile'],
    ...options,
  })
  return result
})

// 读取文本文件
ipcMain.handle('file:readText', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return { success: true, content }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// 读取二进制文件（PDF/Word/PPTX）
ipcMain.handle('file:readBinary', async (event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath)
    return { success: true, buffer: buffer.toString('base64') }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// 获取文件信息
ipcMain.handle('file:getInfo', async (event, filePath) => {
  try {
    const stat = fs.statSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    return {
      success: true,
      name: path.basename(filePath),
      path: filePath,
      size: stat.size,
      ext,
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ============ 应用生命周期 ============

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
