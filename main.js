const { clipboard } = require("electron");
const net = require("net");
const intersect = require("fast_array_intersect").default;
var buttons = [];
var tooltips = [];

const maxButtonsPerPage = 100;
const defaultButtonStyle =
  "background-color: white;width: 60px; height: 60px; visibility: visible; background-position: center; background-image: url('./missing_icon.png') ";

var currentQuerySet;
var currentQueryPage = 0;

//html elements
var searchBar;
var page_text;
var prev_page;
var first_page;
var next_page;
var last_page;
var connect_api_button;
var connection_status_text;
var set_counter_text;
var host_input;
var port_input;
var session_id_input;

var apiClient;
var connected = false;

import {
  ParseAll,
  trie,
  parsedItems,
  Tokenize,
  extraXmlData,
  paths,
} from "./parsing.js";

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
    apiClient.on("error", function (ex) {
      console.log();
      console.log("Handled error: " + ex);
      ChangeConnectionStatus(false);
    });

    apiClient.connect(cport, chost, function () {
      console.log("Connection established.");
      ChangeConnectionStatus(true);
    });
  } catch (ex) {
    console.log(ex);
    ChangeConnectionStatus(false);
  }
}

function ChangeConnectionStatus(isConnected) {
  connection_status_text.innerText = "Connection Status: " + isConnected;
  connected = isConnected;
}

window.addEventListener("DOMContentLoaded", () => {
  searchBar = document.getElementById("search_bar");
  connect_api_button = document.getElementById("connect_api_button");
  connection_status_text = document.getElementById("connection_status_text");
  set_counter_text = document.getElementById("set_counter_text");
  host_input = document.getElementById("host_input");
  port_input = document.getElementById("port_input");
  page_text = document.getElementById("page_text");
  prev_page = document.getElementById("prev_page");
  first_page = document.getElementById("first_page");
  next_page = document.getElementById("next_page");
  last_page = document.getElementById("last_page");
  session_id_input = document.getElementById("session_id_input");

  connect_api_button.onclick = function () {
    AttemptConnection(port_input.value, host_input.value);
  };

  InitButtons();
  SetButtonClickActions();

  ParseAll(function () {
    OnSearchBarChange();

    searchBar.addEventListener("input", function () {
      OnSearchBarChange();
    });
  });
});

function GenerateButtonIcon() {
  var btn = document.createElement("button");
  var tooltip = document.createElement("span");
  tooltip.className = "tooltip";

  btn.type = "button";
  btn.className = "item_button";
  btn.style = defaultButtonStyle;
  btn.appendChild(tooltip);
  buttons.push(btn);
  tooltips.push(tooltip);
  document.getElementById("item_button_holder").append(btn);
}

function InitButtons() {
  for (var i = 0; i < maxButtonsPerPage; i++) {
    GenerateButtonIcon();
  }
}

function ArraysAreEqual(a1, a2) {
  if (a1.length != a2.length) return false;
  var i = a1.length;
  while (i--) {
    if (a1[i] !== a2[i]) return false;
  }
  return true;
}

function OnButtonClick(itemid) {
  var command = "/item " + itemid + " 1 1";
  if (!connected) {
    clipboard.writeText(command, "selection");
  } else {
    try {
      if (connected) {
        apiClient.write(session_id_input.value + "*" + command, function () {});
      }
    } catch (ex) {
      console.log(ex);
      connected = false;
    }
  }
}

function SetButton(index, item) {
  buttons[index].onclick = function () {
    OnButtonClick(item.id);
  };
  buttons[index].style.visibility = "visible";
  var tooltipText =
    item.name +
    "\n" +
    "id=" +
    item.id +
    "\n" +
    "class=" +
    item.class +
    "\n" +
    "slot=" +
    item.slotName +
    "\n" +
    "feature=" +
    item.feature;
  tooltips[index].innerText = tooltipText;

  if (extraXmlData[item.id] !== undefined) {
    var iconPath = extraXmlData[item.id].iconPath;

    if (iconPath !== undefined) {
      buttons[
        index
      ].style.backgroundImage = `url('${paths.imageFolderPath}${iconPath}')`;
      return;
    }
  }
  if (item.missingData) {
    tooltips[index].innerText = tooltipText + "\n" + "*missing_xml_file";
    buttons[index].style.backgroundImage = "url('./missing_xml.png')";
  } else {
    buttons[index].style.backgroundImage = "url('./missing_icon.png')";
  }
}

function CalculateQuerySet(tokens) {
  var sortedSearches = [];
  for (let token of tokens) {
    sortedSearches.push(trie.search(token));
  }
  sortedSearches.sort((a, b) => {
    return a.length - b.length;
  });

  var intersection = intersect(sortedSearches);
  if (intersection === undefined) {
    return [];
  }

  return intersection;
}

var previousTokens;
function OnSearchBarChange() {
  var tokens = Array.from(Tokenize(searchBar.value));

  if (previousTokens != undefined) {
    if (ArraysAreEqual(previousTokens, tokens)) {
      return;
    }
  }

  previousTokens = tokens;

  if (tokens.length === 1 && tokens[0] === "") {
    currentQuerySet = parsedItems;
  } else {
    currentQuerySet = CalculateQuerySet(tokens);
  }

  set_counter_text.innerText = currentQuerySet.length;

  currentQueryPage = 1;
  ChangePage(currentQueryPage);
}

function ChangePage(page) {
  var numberOfPages = ((currentQuerySet.length / maxButtonsPerPage) | 0) + 1;

  if (page < 1) page = 1;
  if (page > numberOfPages) page = numberOfPages;

  if (numberOfPages === 1) {
    page_text.innerText = "1/1";
    prev_page.style.visibility = "hidden";
    first_page.style.visibility = "hidden";
    next_page.style.visibility = "hidden";
    last_page.style.visibility = "hidden";
  } else if (page === 1) {
    page_text.innerText = "1/" + numberOfPages;
    prev_page.style.visibility = "hidden";
    first_page.style.visibility = "hidden";
    next_page.style.visibility = "visible";
    last_page.style.visibility = "visible";
  } else if (page === numberOfPages) {
    page_text.innerText = page + "/" + numberOfPages;
    prev_page.style.visibility = "visible";
    first_page.style.visibility = "visible";
    next_page.style.visibility = "hidden";
    last_page.style.visibility = "hidden";
  } else {
    page_text.innerText = page + "/" + numberOfPages;
    prev_page.style.visibility = "visible";
    first_page.style.visibility = "visible";
    next_page.style.visibility = "visible";
    last_page.style.visibility = "visible";
  }

  UpdateButtons(page);
}

function GotoNextPage() {
  currentQueryPage += 1;
  ChangePage(currentQueryPage);
}

function GotoPreviousPage() {
  currentQueryPage -= 1;
  ChangePage(currentQueryPage);
}

function GotoFirstPage() {
  currentQueryPage = 1;
  ChangePage(currentQueryPage);
}

function GotoLastPage() {
  currentQueryPage = ((currentQuerySet.length / maxButtonsPerPage) | 0) + 1;
  ChangePage(currentQueryPage);
}

function SetButtonClickActions() {
  prev_page.onclick = GotoPreviousPage;
  first_page.onclick = GotoFirstPage;
  next_page.onclick = GotoNextPage;
  last_page.onclick = GotoLastPage;
}

function UpdateButtons(page) {
  var currentAmount = 0;

  for (
    let i = (page - 1) * maxButtonsPerPage;
    i < currentQuerySet.length;
    i++
  ) {
    SetButton(currentAmount, currentQuerySet[i]);

    currentAmount += 1;
    if (currentAmount >= maxButtonsPerPage) return;
  }

  while (currentAmount < maxButtonsPerPage) {
    buttons[currentAmount].style.visibility = "hidden";
    currentAmount += 1;
  }
}
