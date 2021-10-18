import { Tokenize } from "./parsing.js";
import { IsApiConnected, WriteTcpMessage } from "./api.js";

const TrieSearch = require("trie-search");
const fs = require("graceful-fs");
const xml2js = require("xml2js");
const intersect = require("fast_array_intersect").default;
// eslint-disable-next-line import/no-extraneous-dependencies
const { clipboard } = require("electron");

const parser = new xml2js.Parser();
const trie = new TrieSearch();
const parsedItems = [];
let mapPath;

// key = map id
const mapsDict = {};
const pageChange = {};

export { MapsTest, InitMapsTab, SwitchToMapsTab };

const features = new Set();
const buttons = [];
const tooltips = [];

const maxButtonsPerPage = 100;
const defaultButtonStyle = "visibility: visible; background-position: center;";

let initialized = false;
let currentQuerySet;
let currentQueryPage = 0;

let searchBar;
let setCounterText;
let parsedCallback;
let instanceInput;

function InitMapsTab() {
  if (initialized) return;
  const mapsTab = document.getElementById("mapsTab");

  searchBar = mapsTab.querySelector("#searchBar");
  setCounterText = mapsTab.querySelector("#setCounterText");
  instanceInput = mapsTab.querySelector("#instanceInput");
  pageChange.pageText = mapsTab.querySelector("#pageText");
  pageChange.prevPage = mapsTab.querySelector("#prevPage");
  pageChange.firstPage = mapsTab.querySelector("#firstPage");
  pageChange.nextPage = mapsTab.querySelector("#nextPage");
  pageChange.lastPage = mapsTab.querySelector("#lastPage");

  parsedCallback = () => {
    OnSearchBarChange();

    searchBar.addEventListener("input", () => {
      OnSearchBarChange();
    });
    initialized = true;
  };

  InitButtons();
  SetButtonClickActions();
  GenerateParsedItems();
}

function SwitchToMapsTab() {
  if (!initialized) {
    InitButtons();
  }
}

function GenerateButtonIcon(buttonClassName, buttonContainerName) {
  const btn = document.createElement("button");
  const tooltip = document.createElement("span");
  tooltip.className = "tooltip";

  const buttonText = document.createElement("span");

  btn.type = "button";
  btn.className = buttonClassName;
  btn.style = defaultButtonStyle;
  btn.appendChild(buttonText);
  btn.textChild = buttonText;
  btn.appendChild(tooltip);

  buttons.push(btn);
  tooltips.push(tooltip);
  document.getElementById(buttonContainerName).append(btn);
}

function InitButtons() {
  for (let i = 0; i < maxButtonsPerPage; i += 1) {
    GenerateButtonIcon("mapButton", "mapsButtonHolder");
  }
}

function ParseXml(xmlFilename, callback) {
  fs.readFile(xmlFilename, (err, data) => {
    parser.parseString(data, (err2, result) => {
      callback(result);
    });
  });
}

function ParseMapnames(xmlResult) {
  for (let map of xmlResult.ms2.key) {
    map = map.$;
    mapsDict[map.id] = map;
    mapsDict[map.id].tokens = Tokenize(map.name);
    mapsDict[map.id].tokens.add(`feature=${map.feature}`);
    mapsDict[map.id].tokens.add(`id=${map.id}`);

    features.add(map.feature);
    for (const token of mapsDict[map.id].tokens) {
      trie.map(token, map);
    }
    parsedItems.push(mapsDict[map.id]);
  }
  console.log("Maps");
  console.log("Features:");
  console.log(features);
  parsedCallback();
}

function GenerateParsedItems() {
  if (fs.existsSync("paths.json")) {
    const paths = JSON.parse(fs.readFileSync("paths.json"));
    mapPath = paths.mapnameXmlPath.replace(/\/$/, "");

    ParseXml(mapPath, ParseMapnames);
  } else {
    console.log("paths.json not found");
  }
}

function MapsTest() {}

function ArraysAreEqual(a1, a2) {
  if (a1.length !== a2.length) return false;
  let i = a1.length;
  // eslint-disable-next-line no-plusplus
  while (i--) {
    if (a1[i] !== a2[i]) return false;
  }
  return true;
}

function OnButtonClick(mapid) {
  const command = `/map ${mapid} ${instanceInput.value}`;
  if (!IsApiConnected()) {
    clipboard.writeText(command, "selection");
  } else {
    try {
      if (IsApiConnected) {
        WriteTcpMessage(`${command}`);
      }
    } catch (ex) {
      console.log(ex);
      IsApiConnected = false;
    }
  }
}

function CalculateQuerySet(tokens) {
  const sortedSearches = [];
  for (const token of tokens) {
    sortedSearches.push(trie.search(token));
  }
  sortedSearches.sort((a, b) => a.length - b.length);

  const intersection = intersect(sortedSearches);
  if (intersection === undefined) {
    return [];
  }

  return intersection;
}

function ChangePage(newpage) {
  // eslint-disable-next-line no-bitwise
  const numberOfPages = ((currentQuerySet.length / maxButtonsPerPage) | 0) + 1;
  let page = newpage;
  if (page < 1) page = 1;
  if (page > numberOfPages) page = numberOfPages;

  if (numberOfPages === 1) {
    pageChange.pageText.innerText = "1/1";
    pageChange.prevPage.style.visibility = "hidden";
    pageChange.firstPage.style.visibility = "hidden";
    pageChange.nextPage.style.visibility = "hidden";
    pageChange.lastPage.style.visibility = "hidden";
  } else if (page === 1) {
    pageChange.pageText.innerText = `1/${numberOfPages}`;
    pageChange.prevPage.style.visibility = "hidden";
    pageChange.firstPage.style.visibility = "hidden";
    pageChange.nextPage.style.visibility = "visible";
    pageChange.lastPage.style.visibility = "visible";
  } else if (page === numberOfPages) {
    pageChange.pageText.innerText = `${page}/${numberOfPages}`;
    pageChange.prevPage.style.visibility = "visible";
    pageChange.firstPage.style.visibility = "visible";
    pageChange.nextPage.style.visibility = "hidden";
    pageChange.lastPage.style.visibility = "hidden";
  } else {
    pageChange.pageText.innerText = `${page}/${numberOfPages}`;
    pageChange.prevPage.style.visibility = "visible";
    pageChange.firstPage.style.visibility = "visible";
    pageChange.nextPage.style.visibility = "visible";
    pageChange.lastPage.style.visibility = "visible";
  }

  UpdateButtons(page);
}

function UpdateButtons(page) {
  let currentAmount = 0;

  for (
    let i = (page - 1) * maxButtonsPerPage;
    i < currentQuerySet.length;
    i += 1
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

function SetButton(index, map) {
  buttons[index].onclick = function () {
    OnButtonClick(map.id);
  };
  buttons[index].textChild.innerText = map.name;
  buttons[index].style.visibility = "visible";
  const tooltipText = `${map.name}\nid=${map.id}\nfeature=${map.feature}\n`;

  tooltips[index].innerText = tooltipText;
}

let previousTokens;
function OnSearchBarChange() {
  const tokens = Array.from(Tokenize(searchBar.value));

  if (previousTokens !== undefined) {
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
  setCounterText.innerText = currentQuerySet.length;

  currentQueryPage = 1;
  ChangePage(currentQueryPage);
}

function SetButtonClickActions() {
  pageChange.prevPage.onclick = () => {
    currentQueryPage -= 1;
    ChangePage(currentQueryPage);
  };
  pageChange.firstPage.onclick = () => {
    currentQueryPage = 1;
    ChangePage(currentQueryPage);
  };
  pageChange.nextPage.onclick = () => {
    currentQueryPage += 1;
    ChangePage(currentQueryPage);
  };
  pageChange.lastPage.onclick = () => {
    // eslint-disable-next-line no-bitwise
    currentQueryPage = ((currentQuerySet.length / maxButtonsPerPage) | 0) + 1;
    ChangePage(currentQueryPage);
  };
}
