
const { app, BrowserWindow, ipcMain } = require("electron");

const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const path = require("path");

let mainWindow = null;
let arduinoPort = null;
let parser = null;

// =====================================
// CREATE APPLICATION WINDOW
// =====================================

function createWindow() {

    mainWindow = new BrowserWindow({

        width: 1440,
        height: 900,

        minWidth: 1100,
        minHeight: 700,

        backgroundColor: "#0B1120",

        title: "Smart Angle Analyser",

        autoHideMenuBar: false,

        webPreferences: {

            preload: path.join(__dirname, "preload.js"),

            contextIsolation: true,

            nodeIntegration: false

        }

    });

    mainWindow.loadFile("index.html");

}


// =====================================
// SEND DATA TO FRONTEND
// =====================================

function sendToRenderer(channel, data) {

    if (mainWindow && !mainWindow.isDestroyed()) {

        mainWindow.webContents.send(channel, data);

    }

}


// =====================================
// GET AVAILABLE SERIAL PORTS
// =====================================

ipcMain.handle("get-serial-ports", async () => {

    try {

        const ports = await SerialPort.list();

        return ports.map(port => ({

            path: port.path,

            manufacturer: port.manufacturer || "Unknown",

            serialNumber: port.serialNumber || "",

            vendorId: port.vendorId || "",

            productId: port.productId || ""

        }));

    } catch (error) {

        return {

            error: error.message

        };

    }

});


// =====================================
// CONNECT TO ARDUINO
// =====================================

ipcMain.handle("connect-arduino", async (event, config) => {

    try {

        // Close previous connection

        if (arduinoPort && arduinoPort.isOpen) {

            await new Promise(resolve => {

                arduinoPort.close(() => resolve());

            });

        }

        const baudRate = Number(config.baudRate);

        if (!config.path || !Number.isInteger(baudRate) || baudRate <= 0) {

            throw new Error("Invalid serial port or baud rate.");

        }

        arduinoPort = new SerialPort({

            path: config.path,

            baudRate: baudRate,

            autoOpen: false

        });

        parser = arduinoPort.pipe(

            new ReadlineParser({ delimiter: "\n" })

        );

        // Listen for incoming Arduino data

        parser.on("data", (line) => {

            try {

                const cleanLine = line.trim();

                if (!cleanLine) return;

                // Expected Arduino format:
                // {"x":12.5,"y":20.3,"z":45.7}

                const sensorData = JSON.parse(cleanLine);

                const x = Number(sensorData.x);
                const y = Number(sensorData.y);
                const z = Number(sensorData.z);

                if (![x, y, z].every(Number.isFinite)) {

                    throw new Error("Invalid angle values");

                }

                sendToRenderer("angle-data", {

                    x,
                    y,
                    z,

                    timestamp: Date.now()

                });

            } catch (error) {

                sendToRenderer("serial-error", {

                    message: "Invalid Arduino data: " + error.message

                });

            }

        });

        // Handle serial errors

        arduinoPort.on("error", (error) => {

            sendToRenderer("serial-error", {

                message: error.message

            });

        });

        // Detect disconnection

        arduinoPort.on("close", () => {

            sendToRenderer("serial-status", {

                connected: false

            });

        });

        // Open serial connection

        await new Promise((resolve, reject) => {

            arduinoPort.open((error) => {

                if (error) reject(error);

                else resolve();

            });

        });

        sendToRenderer("serial-status", {

            connected: true,

            port: config.path,

            baudRate

        });

        return {

            success: true,

            message: "Arduino connected successfully"

        };

    } catch (error) {

        return {

            success: false,

            message: error.message

        };

    }

});


// =====================================
// DISCONNECT ARDUINO
// =====================================

ipcMain.handle("disconnect-arduino", async () => {

    try {

        if (arduinoPort && arduinoPort.isOpen) {

            await new Promise((resolve, reject) => {

                arduinoPort.close(error => {

                    if (error) reject(error);

                    else resolve();

                });

            });

        }

        arduinoPort = null;
        parser = null;

        return {

            success: true

        };

    } catch (error) {

        return {

            success: false,

            message: error.message

        };

    }

});


// =====================================
// APP LIFECYCLE
// =====================================

app.whenReady().then(() => {

    createWindow();

    app.on("activate", () => {

        if (BrowserWindow.getAllWindows().length === 0) {

            createWindow();

        }

    });

});

app.on("before-quit", () => {

    if (arduinoPort && arduinoPort.isOpen) {

        arduinoPort.close();

    }

});

app.on("window-all-closed", () => {

    if (process.platform !== "darwin") {

        app.quit();

    }

});
