const fs = require('fs');
const path = require('path');
const APPROOT = require('app-root-path');
const {nanoid} = require('nanoid')
const ESCLUSTER = 'http://XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.us-east-1.es.amazonaws.com'; // update this with real one
const INDEX = 'virusgateway';
const TYPE = 'file';

if (!process.argv[2]) {
  console.log("usage: [TEST mode]:  node generate_bash_scripts.js");
  console.log("usage: [REAL mode]:  node generate_bash_scripts.js --notest");
  process.exit(0);
}

const RUNMODE = process.argv[2]; // can be blank, or --notest
/**
 * HOW TO RUN THIS SCRIPT
  node generate_bash_scripts.js
 *
 * note: this script expects the following:
 * a file named "updated.json" in the root folder
 *  3 folders named-
    chunks
    commands
    results

    each chunk -> list of post request bash scripts (commands folder) -> one run.sh to run all scripts -> output saved in results folder

  POST_NUM on line 41 is the number of records that is sent to elasticsearch in a single request
  UPDATED_KEYS should be configured to define what will be read from json records, or hardcode some information
 */

const UPDATE_KEYS = {
  lookup_from_json: {
    _id: 'name', // _id is in elasticsearch, used to lookup record. name is the corresponding key in updated.json
    URL: 'url' // URL is in elasticsearch, url is a key in updated.json
  },
  hardcoded: {
    last_updated: new Date().toDateString(),
    updated: true,
    updated_by: 'Fan'
  }
}

/*************************************/

const testFolder = APPROOT + '/chunks/';

let POST_NUM = 5; // test purpose
if (RUNMODE === '--notest') {
  POST_NUM = 100; // do not increase it beyond 100
}

if (RUNMODE === '--notest') {
  fs
    .readdirSync(testFolder)
    .forEach(file => {
      start(file);
    });
} else {
  // TEST mode
  fs
    .readdirSync(testFolder)
    .slice(0, 1) // will only work with the first chunk
    .forEach(file => {
      start(file);
    });
}

async function start(file) {
  const chunkData = require(`${testFolder}${file}`);
  let chunkElem;
  if (RUNMODE === '--notest') {
    chunkElem = chunkData;
  } else {
    chunkElem = chunkData.slice(0, 50) // TEST mode: just working with first 50 records of the chunk
  }

  const runid = nanoid();
  fs.mkdir(APPROOT + '/commands/' + runid, (err => {
    if (err) 
      console.log(err);
    }
  ));
  fs.mkdir(APPROOT + '/results/' + runid, (err => {
    if (err) 
      console.log(err);
    }
  ));
  let i,
    j,
    temparray,
    cmds = [];
  for (i = 0, j = chunkElem.length; i < j; i += POST_NUM) {
    temparray = chunkElem.slice(i, i + POST_NUM); // THIS IS OK
    const postCmd = makePostCmdBody(temparray)
    fs.writeFileSync(`${APPROOT}/commands/${runid}/${file}.${i + 1}.sh`, postCmd);
    cmds.push(`bash ${APPROOT}/commands/${runid}/${file}.${i + 1}.sh > ${APPROOT}/results/${runid}/${file}.${i + 1}.json`);
  }
  fs.writeFileSync(`${APPROOT}/results/${runid}/run.sh`, cmds.join('\n'));
}

function makePostCmdBody(c) {

  return `
curl -s -H "Content-Type: application/x-ndjson" ${ESCLUSTER}/${INDEX}/${TYPE}/_bulk?pretty=true --data-binary '
  ${c
    .map(d => printPostRequest(d))
    .join('')}
'
  `;

  function printPostRequest(d) {
    return `
{ "update" : { ${getID(d)} } }
{ "doc":  ${getUpdateLookupString(d)} } 
`;
  }

  function getID(d) {
    const {lookup_from_json} = UPDATE_KEYS;

    let val = {};
    val["_id"] = d[lookup_from_json["_id"]];

    const str = JSON.stringify(val);
    const result = str.substr(1, str.length - 2);

    return result;
  }

  function getUpdateLookupString(d) {
    const {lookup_from_json, hardcoded} = UPDATE_KEYS;
    let res = {}

    Object
      .keys(lookup_from_json)
      .forEach(key => {
        if (key !== '_id') {
          res[key] = d[lookup_from_json[key]];
        }
      })

    Object
      .keys(hardcoded)
      .forEach(key => {
        res[key] = hardcoded[key];
      })
    const str = JSON.stringify(res);

    return str;
  }
}

start();