const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const { verifyClient } = require("./client-contract.cjs");

const source = readFileSync(join(__dirname, "..", "client.js"), "utf8");
verifyClient(source, (code, globals) => vm.runInNewContext(code, globals), test);
