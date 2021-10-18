import {
  ParseAll,
  trie,
  parsedItems,
  Tokenize,
  extraXmlData,
  paths,
} from "./parsing.js";

import { InitMapsTab } from "./maps.js";
import {
  ApiInit,
  IsApiConnected,
  WriteTcpMessage,
  ForceDisconnectApi,
} from "./api.js";

// eslint-disable-next-line import/no-extraneous-dependencies
const { clipboard } = require("electron");

const intersect = require("fast_array_intersect").default;

const buttons = [];
const tooltips = [];

const maxButtonsPerPage = 100;
const defaultButtonStyle =
  "width: 60px; height: 60px; visibility: visible; background-position: center; background-image: url('./missing_icon.png') ";

let currentQuerySet;
let currentQueryPage = 0;

// html elements
const pageChange = {};
let searchBar;
let setCounterText;
let amountInput;
let rarityInput;
const tabButtons = {};
const tabs = {};
let allTabs = [];

window.addEventListener("DOMContentLoaded", () => {
  ApiInit();

  GetElements();
  SetTabButtonActions();

  InitButtons();
  SetButtonClickActions();

  ParseAll(() => {
    OnSearchBarChange();

    searchBar.addEventListener("input", () => {
      OnSearchBarChange();
    });
  });
});

function GetElements() {
  setCounterText = document.getElementById("setCounterText");

  const itemsTab = document.getElementById("itemsTab");
  searchBar = itemsTab.querySelector("#searchBar");
  amountInput = itemsTab.querySelector("#amountInput");
  rarityInput = itemsTab.querySelector("#rarityInput");
  pageChange.pageText = itemsTab.querySelector("#pageText");
  pageChange.prevPage = itemsTab.querySelector("#prevPage");
  pageChange.firstPage = itemsTab.querySelector("#firstPage");
  pageChange.nextPage = itemsTab.querySelector("#nextPage");
  pageChange.lastPage = itemsTab.querySelector("#lastPage");

  tabButtons.maps = document.getElementById("mapsTabButton");
  tabButtons.items = document.getElementById("itemsTabButton");
  tabButtons.api = document.getElementById("apiTabButton");
  tabs.maps = document.getElementById("mapsTab");
  tabs.items = document.getElementById("itemsTab");
  tabs.api = document.getElementById("apiTab");
  allTabs = document.getElementsByClassName("tab");
}

function HideAllTabs() {
  for (const tab of allTabs) {
    tab.style.display = "none";
  }
}

function SetTabButtonActions() {
  tabButtons.maps.onclick = function () {
    HideAllTabs();
    tabs.maps.style.display = "block";
    InitMapsTab();
  };
  tabButtons.items.onclick = function () {
    HideAllTabs();
    tabs.items.style.display = "block";
  };
  tabButtons.api.onclick = function () {
    HideAllTabs();
    tabs.api.style.display = "block";
  };
}

function GenerateButtonIcon() {
  const btn = document.createElement("button");
  const tooltip = document.createElement("span");
  tooltip.className = "tooltip";

  btn.type = "button";
  btn.className = "itemButton";
  btn.style = defaultButtonStyle;
  btn.appendChild(tooltip);
  buttons.push(btn);
  tooltips.push(tooltip);
  document.getElementById("itemButtonHolder").append(btn);
}

function InitButtons() {
  for (let i = 0; i < maxButtonsPerPage; i += 1) {
    GenerateButtonIcon();
  }
}

function ArraysAreEqual(a1, a2) {
  if (a1.length !== a2.length) return false;
  let i = a1.length;
  // eslint-disable-next-line no-plusplus
  while (i--) {
    if (a1[i] !== a2[i]) return false;
  }
  return true;
}

function OnButtonClick(itemid) {
  const command = `/item ${itemid} ${amountInput.value} ${rarityInput.value}`;
  if (!IsApiConnected()) {
    clipboard.writeText(command, "selection");
  } else {
    try {
      WriteTcpMessage(`${command}`);
    } catch (ex) {
      console.log(ex);
      ForceDisconnectApi();
    }
  }
}

function SetButton(index, item) {
  buttons[index].onclick = function () {
    OnButtonClick(item.id);
  };
  buttons[index].style.visibility = "visible";
  const tooltipText =
    `${item.name}\n` +
    `id=${item.id}\n` +
    `class=${item.class}\n` +
    `slot=${item.slotName}\n` +
    `feature=${item.feature}`;
  tooltips[index].innerText = tooltipText;

  if (extraXmlData[item.id] !== undefined) {
    const { iconPath } = extraXmlData[item.id];

    if (iconPath !== undefined) {
      buttons[
        index
      ].style.backgroundImage = `url('${paths.imageFolderPath}${iconPath}')`;
      return;
    }
  }
  if (item.missingData) {
    tooltips[index].innerText = `${tooltipText}\n*missing_xml_file`;
    buttons[index].style.backgroundImage = "url('./missing_xml.png')";
  } else {
    buttons[index].style.backgroundImage = "url('./missing_icon.png')";
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
