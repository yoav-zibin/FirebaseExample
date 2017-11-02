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
exports.deleteOldEntriesOnRecentlyConnected =
functions.database.ref('/gamePortal/recentlyConnected')
.onWrite(event => {
  function getSortedKeys(original) {
    let keys = Object.keys(original);
    // Filter users with duplicate entries.
    keys.sort((key1, key2) => original[key2].timestamp - original[key1].timestamp); // newest entries are at the beginning
    return keys;
  }
  let maxEntries = 20;
  if (!event.data.exists()) {
    console.log('deleteOldEntriesOnRecentlyConnected: no data');
    return null;
  }
  const original = event.data.val();
  let updates = {};
  let keys = getSortedKeys(original);
  let userIds = {};
  for (let key of keys) {
    let recentlyConnectedEntry = original[key];
    let userId = recentlyConnectedEntry.userId;
    if (userIds[userId]) {
      updates[key] = null;
      delete original[key];
    }
    userIds[userId] = true;
  }

  // Filter the newest maxEntries entries.
  keys = getSortedKeys(original);
  if (keys.length > maxEntries) {
    keys.reverse(); // oldest entries are at the beginning
    // Removes the newest 20 entries from the end (the ones we want to keep).
    keys.splice(keys.length - maxEntries, maxEntries);
    // Delete everything else.
    for (let key of keys) {
      updates[key] = null;
    }
  }
  
  console.log('deleteOldEntriesOnRecentlyConnected: keys=', keys, ' updates=', updates, ' original=', original);
  return event.data.adminRef.update(updates);
});