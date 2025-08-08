#!/usr/bin/env node

/**
 * @file check-node-version.js
 * @description Verifies that the current Node.js version is compatible with BLE2WebSvc
 */

const semver = require('semver');
const packageJson = require('./package.json');

const currentVersion = process.version;
const requiredVersion = packageJson.engines.node;

console.log(`Current Node.js version: ${currentVersion}`);
console.log(`Required Node.js version: ${requiredVersion}`);

if (semver.satisfies(currentVersion, requiredVersion)) {
  console.log('✅ Node.js version is compatible with BLE2WebSvc');
  process.exit(0);
} else {
  console.error('❌ Node.js version is NOT compatible with BLE2WebSvc');
  console.error(`Please install Node.js ${requiredVersion}`);
  console.error('Run ./install-nodejs.sh to install the correct version');
  process.exit(1);
}
