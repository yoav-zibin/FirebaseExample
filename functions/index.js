'use strict';
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

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
// To deploy:
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


// Code taken from https://github.com/firebase/functions-samples/blob/master/fcm-notifications/functions/index.js
exports.sendNotifications = functions.database.ref('gamePortal/pushNotification/{pushNotificationId}').onWrite(event => {
  let removePromise = event.data.adminRef.remove();
  const pushNotificationId = event.params.pushNotificationId;
  // "fromUserId": validateMyUid(),
  // "toUserId": validateUserId(),
  // "groupId": validateGroupId(), // The two users must be together in some group.
  // "timestamp": validateNow(),
  // // Push notification message fields, see
  // // https://firebase.google.com/docs/cloud-messaging/http-server-ref
  // // https://firebase.google.com/docs/cloud-messaging/js/first-message
  // "title": validateMandatoryString(300),
  // "body": validateMandatoryString(300),
  let data = event.data.val();
  if (!data) {
    console.log(`No value in gamePortal/pushNotification/${pushNotificationId}`);
    return removePromise;
  }
  let fcmTokensPath = `/users/${data.toUserId}/privateFields/fcmTokens`;
  console.log('Sending push notification:', data, ' fcmTokensPath=', fcmTokensPath);

  // Get the list of device notification tokens.
  return Promise.all([removePromise, admin.database().ref(fcmTokensPath).once('value')]).then(results => {
    const tokensSnapshot = results[1];
    let tokensWithData = tokensSnapshot.val();
    console.log('tokensWithData=', tokensWithData);
    if (!tokensWithData) return null;
    // Find the tokens with the latest lastTimeReceived.
    let tokens = Object.keys(tokensWithData);
    tokens.sort((token1, token2) => tokensWithData[token2].lastTimeReceived - tokensWithData[token1].lastTimeReceived); // newest entries are at the beginning
    let token = tokens[0]; // TODO: Maybe in the future I should retry other tokens if this one fails.
    let isWeb = tokensWithData[token].platform == "web";
    console.log('token=', token, 'isWeb=', isWeb);

    // https://firebase.google.com/docs/cloud-messaging/concept-options
    // The common keys that are interpreted by all app instances regardless of platform are message.notification.title, message.notification.body, and message.data.
    // https://firebase.google.com/docs/cloud-messaging/http-server-ref
    const payload = isWeb ?
      {
        data: {
          title: data.title,
          body: data.body,
          fromUserId: String(data.fromUserId),
          toUserId: String(data.toUserId),
          groupId: String(data.groupId),
          timestamp: String(data.timestamp),
        }
      } :
      {
        notification: {
          title: data.title,
          body: data.body,
        },
        data: {
          fromUserId: String(data.fromUserId),
          toUserId: String(data.toUserId),
          groupId: String(data.groupId),
          timestamp: String(data.timestamp),
        }
      };

    return admin.messaging().sendToDevice([token], payload).then(response => {
      // For each message check if there was an error.
      const tokensToRemove = [];
      response.results.forEach((result, index) => {
        const error = result.error;
        if (error) {
          console.error('Failure sending notification to', tokens[index], error);
          // Cleanup the tokens who are not registered anymore.
          if (error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/registration-token-not-registered') {
            tokensToRemove.push(admin.database().ref(fcmTokensPath + `/${token}`).remove());
          }
        }
      });
      return Promise.all(tokensToRemove);
    });
  }).catch((err)=> {
    console.error("Error: ", err);
  });
});