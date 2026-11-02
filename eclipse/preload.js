
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {

    // Get available Arduino ports

    getSerialPorts: () =>

        ipcRenderer.invoke("get-serial-ports"),


    // Connect Arduino

    connectArduino: (config) =>

        ipcRenderer.invoke("connect-arduino", config),


    // Disconnect Arduino

    disconnectArduino: () =>

        ipcRenderer.invoke("disconnect-arduino"),


    // Receive live angle data

    onAngleData: (callback) => {

        ipcRenderer.on("angle-data", (event, data) => {

            callback(data);

        });

    },


    // Receive connection status

    onSerialStatus: (callback) => {

        ipcRenderer.on("serial-status", (event, data) => {

            callback(data);

        });

    },


    // Receive serial errors

    onSerialError: (callback) => {

        ipcRenderer.on("serial-error", (event, data) => {

            callback(data);

        });

    }

});
