const TrieSearch = require("trie-search");
const fs = require("graceful-fs");
const xml2js = require("xml2js");
const fg = require("fast-glob");
const path = require("path");

var parser = new xml2js.Parser();
var trie = new TrieSearch();
var parsedItems = [];
var extraXmlData = new Object();
var paths;

//item descriptors
var classes = new Set();
var features = new Set();
var slots = new Set();

//html elements
var set_counter_text;
const loadExtraXmlData = true;
export { ParseAll, trie, parsedItems, Tokenize, extraXmlData, paths };

var callback;

function ParseAll(_callback) {
  callback = _callback;
  set_counter_text = document.getElementById("set_counter_text");
  if (fs.existsSync("paths.json")) {
    paths = JSON.parse(fs.readFileSync("paths.json"));
    paths.itemXmlPath = paths.itemXmlPath.replace(/\/$/, "");
    paths.imageFolderPath = paths.imageFolderPath.replace(/\/$/, "");

    ParseXml(paths.itemnameXmlPath);
  } else {
    console.log("paths.json not found");
  }
}

function ParseXml(xmlFilename) {
  fs.readFile(xmlFilename, function (err, data) {
    parser.parseString(data, function (err, result) {
      ParseItemnames(result);
    });
  });
}

function ParseItemnames(xml) {
  for (var item of xml.ms2.key) {
    item = item.$;
    if (item.id.length === 1) item.id = "0000000" + item.id;

    if (item.name !== undefined) {
      item.name = item.name.replace("(F)", "(Female)").replace("(M)", "(Male)");
      if (item.class === "") item.class = undefined;

      if (item.class !== undefined)
        item.class = item.class.replaceAll(" ", "_");
      if (item.feature !== undefined) {
        item.feature = item.feature.replaceAll(" ", "_");
      }

      item.nameTokens = Tokenize(item.name);
      item.nameTokens.add("id=" + item.id);
      item.nameTokens.add("class=" + item.class);
      item.nameTokens.add("feature=" + item.feature);

      features.add(item.feature);
      classes.add(item.class);

      parsedItems.push(item);
    }
  }

  set_counter_text.innerText = parsedItems.length;
  ParseExtraItemXml();
}

function ParseExtraItemXml() {
  if (loadExtraXmlData && fs.existsSync("extraXmlData.json")) {
    extraXmlData = JSON.parse(fs.readFileSync("extraXmlData.json"));

    DoneParsing();
    return;
  }
  GenerateExtraXmlDataJson();
}

function GenerateExtraXmlDataJson() {
  console.log("Generating new extraXmlData.json");
  var filepaths = fg.sync([paths.itemXmlPath + "/*/*/*.xml"], { dot: false });
  var itemXmlData = [];
  for (let i = 0; i < filepaths.length; i++) {
    itemXmlData.push(fs.readFileSync(filepaths[i]));
  }

  var totalParsed = 0;

  for (let i = 0; i < itemXmlData.length; i++) {
    //
    parser.parseString(itemXmlData[i], function (err, result) {
      var itemId = path.basename(filepaths[i], path.extname(filepaths[i]));

      if (result === undefined) {
        console.log(err);
        return;
      }
      var iconPath = result.ms2.environment[0].property[0].$.slotIcon;
      var customPath = result.ms2.environment[0].property[0].$.slotIconCustom;
      var validPath = CheckValidIconPath(iconPath, customPath);

      var itemXmlInfo = new Object();
      itemXmlInfo.iconPath = validPath;
      itemXmlInfo.slotName = result.ms2.environment[0].slots[0].slot[0].$.name;

      if (itemXmlInfo.slotName === "") {
        itemXmlInfo.slotName = undefined;
      }
      extraXmlData[itemId] = itemXmlInfo;

      totalParsed += 1;

      if (totalParsed === filepaths.length) {
        fs.writeFile("extraXmlData.json", JSON.stringify(extraXmlData));
        DoneParsing();
      }
      //
    });
  }
}

function DoneParsing() {
  //check itemname.xml for item ids that aren't already in extraXmlData
  for (let item of parsedItems) {
    if (extraXmlData[item.id] !== undefined) {
      item.nameTokens.add("slot=" + extraXmlData[item.id].slotName);
      item.slotName = extraXmlData[item.id].slotName;
      item.missingData = false;
    } else {
      item.nameTokens.add("slot=undefined");
      item.slotName = undefined;
      item.nameTokens.add("*missing_xml_file");
      item.missingData = true;
    }
    slots.add(item.slotName);
    for (let token of item.nameTokens) {
      trie.map(token, item);
    }
  }
  console.log(slots);
  console.log(classes);
  console.log(features);
  callback();
}

function Tokenize(str) {
  str = str
    .toLowerCase()
    .replaceAll(/[',()\[\]]/g, "")
    .replaceAll(/[_-]/g, " ")
    .replaceAll(/  +/g, " ")
    .trim();

  return new Set(str.split(" "));
}

function CheckValidIconPath(iconPath, customPath) {
  var regMatch = iconPath.match(/Image.*.png/i);

  if (regMatch !== null) {
    iconPath = regMatch[0].replace("Image", "");
  }

  if (fs.existsSync(`${paths.imageFolderPath}${iconPath}`)) {
    return iconPath;
  }

  var regMatch = customPath.match(/Image.*.png/i);
  if (regMatch !== null) {
    customPath = regMatch[0].replace("Image", "");
  }

  if (fs.existsSync(`${paths.imageFolderPath}${customPath}`)) {
    return customPath;
  }

  return undefined;
}
