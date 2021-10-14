const net = require("net");

let apiClient;
let connected = false;
let connectApiButton;
let connectionStatusText;
let hostInput;
let portInput;
let sessionIdInput;

export { ApiInit, IsApiConnected, WriteTcpMessage };

function ApiInit() {
  connectApiButton = document.getElementById("connectApiButton");
  connectionStatusText = document.getElementById("connectionStatusText");
  sessionIdInput = document.getElementById("sessionIdInput");
  hostInput = document.getElementById("hostInput");
  portInput = document.getElementById("portInput");
  connectApiButton.onclick = function () {
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
