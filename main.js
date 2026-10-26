const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const configPath = path.join(app.getPath('userData'), 'server-config.json');

function getConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        url: data.url || '',
        terminalId: data.terminalId || '1',
        printerType: data.printerType || 'thermal',
        printerName: data.printerName || ''
      };
    }
  } catch (e) {}
  return { url: '', terminalId: '1', printerType: 'thermal', printerName: '' };
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 850,
    minWidth: 360,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      zoomFactor: 1.0
    },
    autoHideMenuBar: true
  });

  const config = getConfig();
  
  if (!config.url) {
    mainWindow.loadFile(path.join(__dirname, 'settings.html'));
  } else {
    let baseUrl = config.url.trim().replace(/\/$/, '');
    const targetUrl = `${baseUrl}/pos.html`;

    mainWindow.loadURL(targetUrl).catch(err => {
      console.log('Connection failed, opening settings...');
      mainWindow.loadFile(path.join(__dirname, 'settings.html'));
    });
  }

  globalShortcut.register('F2', () => {
    if (mainWindow) {
      mainWindow.loadFile(path.join(__dirname, 'settings.html'));
    }
  });
}

// ഇതാണ് ഫ്രണ്ടെൻഡിൽ നിന്ന് ചോദിക്കുമ്പോൾ കോൺഫിഗറേഷൻ തിരികെ നൽകുന്നത് (ഇത് നിർബന്ധമാണ്)
ipcMain.handle('get-config', () => {
  return getConfig();
});

ipcMain.handle('save-config', (event, newConfig) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(newConfig));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-printers', async () => {
  if (mainWindow && mainWindow.webContents) {
    return await mainWindow.webContents.getPrintersAsync();
  }
  return [];
});

ipcMain.on('print-direct', (event, options) => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadURL(options.url);

  win.webContents.on('did-finish-load', () => {
    win.webContents.print({
      silent: false,
      printBackground: true,
      deviceName: options.printerName || ''
    }, (success, failureReason) => {
      if (!success) console.log('Print failed:', failureReason);
      win.close();
    });
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});