const TrieSearch = require("trie-search");
const fs = require("graceful-fs");
const xml2js = require("xml2js");
const fg = require("fast-glob");
const path = require("path");

const parser = new xml2js.Parser();
const trie = new TrieSearch();
const parsedItems = [];

// eslint-disable-next-line import/no-mutable-exports
let paths;
// eslint-disable-next-line import/no-mutable-exports
let extraXmlData = {};
// item descriptors
const classes = new Set();
const features = new Set();
const slots = new Set();

// html elements
let setCounterText;
const loadExtraXmlData = true;
// eslint-disable-next-line no-use-before-define
export { ParseAll, trie, parsedItems, Tokenize, extraXmlData, paths };

let callback;

function ParseAll(_callback) {
  callback = _callback;
  setCounterText = document.getElementById("setCounterText");
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
  fs.readFile(xmlFilename, (err, data) => {
    parser.parseString(data, (err2, result) => {
      ParseItemnames(result);
    });
  });
}

function ParseItemnames(xml) {
  for (let item of xml.ms2.key) {
    item = item.$;
    if (item.id.length === 1) item.id = `0000000${item.id}`;

    if (item.name !== undefined) {
      item.name = item.name.replace("(F)", "(Female)").replace("(M)", "(Male)");
      if (item.class === "") item.class = undefined;

      if (item.class !== undefined)
        item.class = item.class.replaceAll(" ", "_");
      if (item.feature !== undefined) {
        item.feature = item.feature.replaceAll(" ", "_");
      }

      item.nameTokens = Tokenize(item.name);
      item.nameTokens.add(`id=${item.id}`);
      item.nameTokens.add(`class=${item.class}`);
      item.nameTokens.add(`feature=${item.feature}`);

      features.add(item.feature);
      classes.add(item.class);

      parsedItems.push(item);
    }
  }

  setCounterText.innerText = parsedItems.length;
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
  const filepaths = fg.sync([`${paths.itemXmlPath}/*/*/*.xml`], { dot: false });
  const itemXmlData = [];
  for (let i = 0; i < filepaths.length; i += 1) {
    itemXmlData.push(fs.readFileSync(filepaths[i]));
  }

  let totalParsed = 0;

  for (let i = 0; i < itemXmlData.length; i += 1) {
    //
    // eslint-disable-next-line no-loop-func
    parser.parseString(itemXmlData[i], (err, result) => {
      const itemId = path.basename(filepaths[i], path.extname(filepaths[i]));

      if (result === undefined) {
        console.log(err);
        return;
      }
      const iconPath = result.ms2.environment[0].property[0].$.slotIcon;
      const customPath = result.ms2.environment[0].property[0].$.slotIconCustom;
      const validPath = CheckValidIconPath(iconPath, customPath);

      const itemXmlInfo = {};
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
  // check itemname.xml for item ids that aren't already in extraXmlData
  for (const item of parsedItems) {
    if (extraXmlData[item.id] !== undefined) {
      item.nameTokens.add(`slot=${extraXmlData[item.id].slotName}`);
      item.slotName = extraXmlData[item.id].slotName;
      item.missingData = false;
    } else {
      item.nameTokens.add("slot=undefined");
      item.slotName = undefined;
      item.nameTokens.add("*missing_xml_file");
      item.missingData = true;
    }
    slots.add(item.slotName);
    for (const token of item.nameTokens) {
      trie.map(token, item);
    }
  }
  console.log("Items");
  console.log("Slots: ");
  console.log(slots);
  console.log("Classes: ");
  console.log(classes);
  console.log("Features: ");
  console.log(features);
  callback();
}

function Tokenize(inputstr) {
  const str = inputstr
    .toLowerCase()
    .replaceAll(/[',()[\]]/g, "")
    .replaceAll(/[_-]/g, " ")
    .replaceAll(/  +/g, " ")
    .trim();

  return new Set(str.split(" "));
}

function CheckValidIconPath(iconPath, customPath) {
  let regMatch = iconPath.match(/Image.*.png/i);

  if (regMatch !== null) {
    iconPath = regMatch[0].replace("Image", "");
  }

  if (fs.existsSync(`${paths.imageFolderPath}${iconPath}`)) {
    return iconPath;
  }

  regMatch = customPath.match(/Image.*.png/i);
  if (regMatch !== null) {
    customPath = regMatch[0].replace("Image", "");
  }

  if (fs.existsSync(`${paths.imageFolderPath}${customPath}`)) {
    return customPath;
  }

  return undefined;
}
