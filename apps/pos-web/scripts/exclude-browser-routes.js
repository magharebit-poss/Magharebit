const fs = require('fs');
const path = require('path');

// During the Tauri static export (output: 'export'), the dynamic proxy Route
// Handlers under the (browser-only) route group cannot be statically exported.
// They are never used inside Tauri (apiFetch calls the backend directly). This
// script hides the group before the export build and restores it after.
// Renaming to an underscore-prefixed name makes Next treat it as a private
// folder, excluding it from routing/collection.

const SRC = path.join(__dirname, '../src/app/(browser-only)');
const HIDDEN = path.join(__dirname, '../src/app/_browser-only-hidden');

const action = process.argv[2];

if (action === 'hide') {
  if (fs.existsSync(SRC)) {
    fs.renameSync(SRC, HIDDEN);
    console.log('Hid (browser-only) routes for Tauri build');
  }
} else if (action === 'restore') {
  if (fs.existsSync(HIDDEN)) {
    fs.renameSync(HIDDEN, SRC);
    console.log('Restored (browser-only) routes after Tauri build');
  }
} else {
  console.error('Usage: node exclude-browser-routes.js hide|restore');
  process.exit(1);
}
