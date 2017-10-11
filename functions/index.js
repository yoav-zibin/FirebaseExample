const functions = require('firebase-functions');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// To install: 
// npm install -g firebase-tools
// firebase login
//
// To init:
// firebase init functions
//
// To deplot:
// firebase deploy
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

// https://firebase.google.com/docs/functions/database-events
exports.deleteOldEntriesOnRecentlyConnected = functions.database.ref('/recentlyConnected')
.onWrite(event => {
  let maxEntries = 20;
  if (!event.data.exists()) {
    console.log('deleteOldEntriesOnRecentlyConnected: no data');
    return;
  }
  const original = event.data.val();
  let keys = Object.keys(original);
  if (keys.length <= maxEntries) {
    console.log('deleteOldEntriesOnRecentlyConnected: less than maxEntries');
    return;
  }
  // Find the oldest entries.
  keys.sort();
  // Filter the newest maxEntries entries.
  keys.splice(keys.length - maxEntries, maxEntries);
  let updates = {};
  for (let key of keys) {
    updates[key] = null;
  }

  console.log('deleteOldEntriesOnRecentlyConnected: keys=', keys, ' updates=', updates, ' original=', original);
  return event.data.adminRef.update(updates);
});