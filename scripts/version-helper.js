#!/usr/bin/env node

/**
 * Version Helper Script
 * Helps manage versioning for the Video Transcription Agent
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packagePath = path.join(__dirname, '..', 'package.json');
const package = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

function getCurrentVersion() {
  return package.version;
}

function updateVersion(type) {
  try {
    execSync(`npm version ${type} --no-git-tag-version`, { stdio: 'inherit' });
    const newPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return newPackage.version;
  } catch (error) {
    console.error('Failed to update version:', error.message);
    process.exit(1);
  }
}

function createGitTag(version) {
  try {
    execSync(`git add package.json`, { stdio: 'inherit' });
    execSync(`git commit -m "Release version ${version}"`, { stdio: 'inherit' });
    execSync(`git tag v${version}`, { stdio: 'inherit' });
    console.log(`✅ Created git tag: v${version}`);
    console.log(`📝 To push and trigger deployment, run:`);
    console.log(`   git push origin main`);
    console.log(`   git push origin v${version}`);
  } catch (error) {
    console.error('Failed to create git tag:', error.message);
    console.log('You may need to create the tag manually');
  }
}

function printVersionInfo() {
  console.log('📋 Current Version Information:');
  console.log(`   Package Version: ${getCurrentVersion()}`);
  
  try {
    const gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    console.log(`   Git Branch: ${gitBranch}`);
    console.log(`   Git Commit: ${gitCommit}`);
  } catch (error) {
    console.log('   Git info: Not available');
  }
}

function printUsage() {
  console.log('🚀 Video Transcription Agent - Version Helper');
  console.log('');
  console.log('Usage: node scripts/version-helper.js [command]');
  console.log('');
  console.log('Commands:');
  console.log('  info              Show current version information');
  console.log('  patch             Increment patch version (x.x.X)');
  console.log('  minor             Increment minor version (x.X.x)');
  console.log('  major             Increment major version (X.x.x)');
  console.log('  release [type]    Update version and create git tag');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/version-helper.js info');
  console.log('  node scripts/version-helper.js patch');
  console.log('  node scripts/version-helper.js release minor');
  console.log('');
  console.log('Deployment:');
  console.log('  - Push to main branch: Triggers production deployment');
  console.log('  - Push version tag (v*): Triggers release deployment');
  console.log('  - Push to develop: Triggers beta deployment');
}

// Main logic
const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case 'info':
    printVersionInfo();
    break;
    
  case 'patch':
  case 'minor':
  case 'major':
    console.log(`📈 Updating ${command} version...`);
    const newVersion = updateVersion(command);
    console.log(`✅ Version updated: ${getCurrentVersion()} → ${newVersion}`);
    break;
    
  case 'release':
    if (!arg || !['patch', 'minor', 'major'].includes(arg)) {
      console.error('❌ Release command requires version type: patch, minor, or major');
      process.exit(1);
    }
    console.log(`🚀 Creating ${arg} release...`);
    const releaseVersion = updateVersion(arg);
    console.log(`✅ Version updated to: ${releaseVersion}`);
    createGitTag(releaseVersion);
    break;
    
  default:
    printUsage();
    break;
}
