const {chain} = require('stream-chain');
const {parser} = require('stream-json');
const {streamValues} = require('stream-json/streamers/StreamValues');
const fs = require('fs');
const APPROOT = require('app-root-path');

/**
 * HOW TO RUN THIS SCRIPT
  node split_file_into_chunks.js
 *
 * note: this script expects the following:
 * a file named "updated.json" in the root folder
 *  3 folders named-
    chunks
    commands
    results

  BATCH_SIZE on line 22 is set to 50000, that is the size of each chunk
  if updated.json has 10,000,000 records - it will create 200 chunks
 */

const BATCH_SIZE = 50000;

async function main() {
  await run();
}

async function run() {
  return new Promise((resolve, reject) => {
    const pipeline = chain([
      fs.createReadStream(APPROOT + '/updated.json'),
      parser(),
      streamValues(),
      data => {
        const value = data.value;
        return value;
      }
    ]);
    let entries = []

    pipeline.on('data', (d) => {
      entries.push(d);
    });
    pipeline.on('end', () => {
      let i,
        j,
        temparray,
        batches = [];
      for (i = 0, j = entries.length; i < j; i += BATCH_SIZE) {
        temparray = entries.slice(i, i + BATCH_SIZE);
        writeFile(`${APPROOT}/chunks/${i + 1}.json`, JSON.stringify(temparray));
      }
      resolve();
    });

  })
}
const writeFile = (filePath, fileContent) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, fileContent, writeFileError => {
      if (writeFileError) {
        reject(writeFileError);
        return;
      }

      resolve(filePath);
    });
  });
}

main();