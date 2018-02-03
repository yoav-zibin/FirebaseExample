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
.onWrite((event: any) => { //  onWrite triggers when data is created, destroyed, or changed in the Realtime Database.
  function getSortedKeys(original: any) {
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
  let updates: any = {};
  let keys = getSortedKeys(original);
  let userIds: any = {};
  for (let key of keys) {
    let recentlyConnectedEntry = original[key];
    let userId: string = recentlyConnectedEntry.userId;
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

// Firebase keys can't contain certain characters (.#$/[])
// https://groups.google.com/forum/#!topic/firebase-talk/vtX8lfxxShk
// encodeAsFirebaseKey("%.#$/[]") returns "%25%2E%23%24%2F%5B%5D"
// To decode, use decodeURIComponent, e.g.,
// decodeURIComponent("%25%2E%23%24%2F%5B%5D") returns "%.#$/[]"
function encodeAsFirebaseKey(str: string) {
  return str.toLowerCase() // Always search the indices with lower-case strings.
    .replace(/\%/g, '%25')
    .replace(/\./g, '%2E')
    .replace(/\#/g, '%23')
    .replace(/\$/g, '%24')
    .replace(/\//g, '%2F')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D');
}
function handlerForIndex(field: string) {
  return (event: any) => {
    const userId = event.params.userId;
    let data = event.data.val();
    console.log('Field ', field, ' added/updated for userId=', userId, 'data=', data);
    if (!data || data == 'anonymous.user@gmail.com') return null;
    let encodedData = encodeAsFirebaseKey(data);
    return admin.database().ref(`gamePortal/userIdIndices/${field}/${encodedData}/${userId}`).set(admin.database.ServerValue.TIMESTAMP);
  };
}
function handlerForDisplayNameIndex() {
  return (event: any) => {
    const userId = event.params.userId;
    let data = '' + event.data.val();
    console.log('DisplayName added/updated for userId=', userId, 'data=', data);
    let splitDisplayName = data.split(/\s+/, 4);
    splitDisplayName.push(data);
    let promises = splitDisplayName.map(
      name => admin.database().ref(`gamePortal/userIdIndices/displayName/${encodeAsFirebaseKey(name)}/${userId}`).set(admin.database.ServerValue.TIMESTAMP));
    return Promise.all(promises);
  };
}
function createIndex(field: string) {
  return functions.database.ref('/users/{userId}/privateFields/' + field).onWrite(handlerForIndex(field));
}
exports.emailIndex = createIndex("email");
exports.phoneNumberIndex = createIndex("phoneNumber");
exports.facebookIdIndex = createIndex("facebookId");
exports.googleIdIndex = createIndex("googleId");
exports.twitterIdIndex = createIndex("twitterId");
exports.githubIdIndex = createIndex("githubId");
exports.displayNameIndex =
functions.database.ref('/users/{userId}/publicFields/displayName').onWrite(handlerForDisplayNameIndex());


// Code taken from https://github.com/firebase/functions-samples/blob/master/fcm-notifications/functions/index.js
function sendPushToUser(
  toUserId: string, senderUid: string, senderName: string, body: string, timestamp: string, groupId: string) {
  console.log('Sending push notification:', toUserId, senderUid, senderName, body, timestamp, groupId);
  let fcmTokensPath = `/users/${toUserId}/privateFields/fcmTokens`;
  // Get the list of device notification tokens.
  return admin.database().ref(fcmTokensPath).once('value').then((tokensSnapshot: any) => {
    let tokensWithData = tokensSnapshot.val();
    console.log('tokensWithData=', tokensWithData);
    if (!tokensWithData) return null;
    // Find the tokens with the latest lastTimeReceived.
    let tokens = Object.keys(tokensWithData);
    tokens.sort((token1, token2) => tokensWithData[token2].lastTimeReceived - tokensWithData[token1].lastTimeReceived); // newest entries are at the beginning
    let token = tokens[0]; // TODO: Maybe in the future I should retry other tokens if this one fails.
    let tokenData = tokensWithData[token];
    console.log('token=', token, 'tokenData=', tokenData);

    // https://firebase.google.com/docs/cloud-messaging/concept-options
    // The common keys that are interpreted by all app instances regardless of platform are message.notification.title, message.notification.body, and message.data.
    // Push notification message fields, see
    // https://firebase.google.com/docs/cloud-messaging/http-server-ref
    // https://firebase.google.com/docs/cloud-messaging/js/first-message
    // `firebasePushNotifications.html?groupId=${data.groupId}&timestamp=${data.timestamp}&fromUserId=${data.fromUserId}`
    const payload: any =
      {
        notification: {
          title: senderName,
          body: body,
        },
        data: {
          // Must be only strings in these key-value pairs
          fromUserId: String(senderUid),
          toUserId: String(toUserId),
          groupId: String(groupId),
          timestamp: String(timestamp),
        }
      };
    if (tokenData.platform == "web") {
      payload.notification.click_action =
        // GamePortalAngular|GamePortalReact
        `https://yoav-zibin.github.io/${tokenData.app}/play/${groupId}`;
    }

    return admin.messaging().sendToDevice([token], payload).then((response: any) => {
      // For each message check if there was an error.
      const tokensToRemove: Promise<any>[] = [];
      response.results.forEach((result: any, index: number) => {
        const error = result.error;
        if (error) {
          console.warn('Failure sending notification to', token, error); // Actually happens, so just warning.
          // Cleanup the tokens who are not registered anymore.
          if (error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/registration-token-not-registered') {
            tokensToRemove.push(admin.database().ref(fcmTokensPath + `/${token}`).remove());
          }
        } else {
          console.log('Success sending push to ', token);
        }
      });
      return Promise.all(tokensToRemove);
    });
  }).catch((err: any)=> {
    console.error("Error: ", err);
  });
}

exports.sendNotifications =
functions.database.ref('gamePortal/groups/{groupId}/messages/{messageId}').onWrite((event: any) => {
  let messageData = event.data.val();
  if (!messageData) {
    console.log(`No message`);
    return null;
  }
  let senderUid: string = String(messageData.senderUid);
  let body: string = String(messageData.message);
  let timestamp: string = String(messageData.timestamp);
  const groupId: string = String(event.params.groupId);
  const messageId: string = String(event.params.messageId);
  console.log('Got chat message! senderUid=', senderUid,
    ' body=', body, ' timestamp=', timestamp, ' groupId=', groupId, ' messageId=', messageId);

  // Get sender name and participants
  return Promise.all([
    admin.database().ref(`/users/${senderUid}/publicFields/displayName`).once('value'),
    admin.database().ref(`/gamePortal/groups/${groupId}/participants`).once('value'),
  ]).then(results => {
    const senderName = results[0].val();
    const participants = results[1].val();
    console.log('senderName=', senderName, ' participants=', participants);
    // Send push to all participants except the sender (but we include the sender for "TEST_SEND_PUSH_NOTIFICATION")
    let targetUserIds = Object.keys(participants);
    if (!body.startsWith("TEST_SEND_PUSH_NOTIFICATION")) {
      targetUserIds = targetUserIds.filter((userId) => userId != senderUid);
    }
    let promises: Promise<any>[] = [];
    for (let toUserId of targetUserIds) {
      promises.push(sendPushToUser(toUserId, senderUid, senderName, body, timestamp, groupId));
    }
    return Promise.all(promises);
  });
});

exports.starsSummary =
functions.database.ref('gamePortal/gameSpec/reviews/{reviewedGameSpecId}/{reviewerUserId}/stars')
.onWrite((event: any) => {
  console.log(`Updating reviews!`);
  // stars are between 1 to 5 (inclusive)
  const oldStars = event.data.previous.val();
  const newStars = event.data.val()
  if (!oldStars && !newStars) {
    console.log(`No oldStars nor newStars`);
    return null;
  }
  const reviewedGameSpecId: string = String(event.params.reviewedGameSpecId);
  console.log(`Updating reviews for reviewedGameSpecId=${reviewedGameSpecId} from oldStars=${oldStars} to newStars=${newStars}`);
  const starsSummaryPath = `gamePortal/gameSpec/starsSummary/${reviewedGameSpecId}`;
  const starsRef = admin.database().ref(starsSummaryPath);
  return starsRef.transaction(function(starsSummary: any) {
      console.log(`starsSummary before: `, JSON.stringify(starsSummary));
      if (oldStars && starsSummary && starsSummary[oldStars] > 0) {
        starsSummary[oldStars]--;
      }
      if (newStars) {
        if (!starsSummary) starsSummary = {};
        starsSummary[newStars] = (starsSummary[newStars] || 0) + 1;
      }
      console.log(`starsSummary after: `, JSON.stringify(starsSummary));
      return starsSummary;
    });
});

exports.resizeImage =
functions.database.ref('gameBuilder/images')
.onWrite((event: any) => {
  
});
