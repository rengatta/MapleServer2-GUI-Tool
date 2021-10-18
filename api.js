const net = require("net");

let apiClient;
let connected = false;
let connectApiButton;
let disconnectApiButton;
let connectionStatusText;
let hostInput;
let portInput;
let sessionIdInput;

export {
  ApiInit,
  IsApiConnected,
  WriteTcpMessage,
  ChangeConnectionStatus,
  ForceDisconnectApi,
};

function ApiInit() {
  connectApiButton = document.getElementById("connectApiButton");
  disconnectApiButton = document.getElementById("disconnectApiButton");
  connectionStatusText = document.getElementById("connectionStatusText");
  sessionIdInput = document.getElementById("sessionIdInput");
  hostInput = document.getElementById("hostInput");
  portInput = document.getElementById("portInput");

  disconnectApiButton.onclick = () => {
    ForceDisconnectApi();
  };

  connectApiButton.onclick = () => {
    AttemptConnection(portInput.value, hostInput.value);
  };
}

function WriteTcpMessage(message) {
  apiClient.write(`${sessionIdInput.value}*${message}`, () => {});
}

function IsApiConnected() {
  return connected;
}

function ChangeConnectionStatus(isConnected) {
  connectionStatusText.innerText = `Connection Status: ${isConnected}`;
  connected = isConnected;
}

function ForceDisconnectApi() {
  if (apiClient !== undefined) {
    try {
      apiClient.destroy();
    } catch (ex) {
      console.log(ex);
    }
  }
  ChangeConnectionStatus(false);
}

function AttemptConnection(cport, chost) {
  if (apiClient !== undefined) {
    try {
      apiClient.destroy();
    } catch (ex) {
      console.log(ex);
    }
  }
  apiClient = new net.Socket();
  console.log("Attempting connection.");
  try {
    apiClient.on("error", (ex) => {
      console.log();
      console.log(`Handled error: ${ex}`);
      ChangeConnectionStatus(false);
    });

    apiClient.connect(cport, chost, () => {
      console.log("Connection established.");
      ChangeConnectionStatus(true);
    });
  } catch (ex) {
    console.log(ex);
    ChangeConnectionStatus(false);
  }
}
