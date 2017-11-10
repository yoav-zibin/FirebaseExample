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
        function getSortedKeys(/** @type {object} */ original) {
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
// Firebase keys can't contain certain characters (.#$/[])
// https://groups.google.com/forum/#!topic/firebase-talk/vtX8lfxxShk
// encodeAsFirebaseKey("%.#$/[]") returns "%25%2E%23%24%2F%5B%5D"
// To decode, use decodeURIComponent, e.g.,
// decodeURIComponent("%25%2E%23%24%2F%5B%5D") returns "%.#$/[]"
function encodeAsFirebaseKey(/** @type {string} */ string) {
    return string.replace(/\%/g, '%25')
        .replace(/\./g, '%2E')
        .replace(/\#/g, '%23')
        .replace(/\$/g, '%24')
        .replace(/\//g, '%2F')
        .replace(/\[/g, '%5B')
        .replace(/\]/g, '%5D');
}
function handlerForIndex(/** @type {string} */ field) {
    return (/** @type {any} */ event) => {
        const userId = event.params.userId;
        let data = event.data.val();
        console.log('Field ', field, ' added/updated for userId=', userId, 'data=', data);
        let encodedData = encodeAsFirebaseKey(data);
        return admin.database().ref(`gamePortal/userIdIndices/${field}/${encodedData}/${userId}`).set(admin.database.ServerValue.TIMESTAMP);
    };
}
function handlerForDisplayNameIndex() {
    return (/** @type {any} */ event) => {
        const userId = event.params.userId;
        let data = '' + event.data.val();
        console.log('DisplayName added/updated for userId=', userId, 'data=', data);
        let splitDisplayName = data.split(/\s+/, 4);
        splitDisplayName.push(data);
        let promises = splitDisplayName.map(name => admin.database().ref(`gamePortal/userIdIndices/displayName/${encodeAsFirebaseKey(name)}/${userId}`).set(admin.database.ServerValue.TIMESTAMP));
        return Promise.all(promises);
    };
}
function createIndex(/** @type {string} */ field) {
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
exports.sendNotifications =
    functions.database.ref('gamePortal/pushNotification/{pushNotificationId}').onWrite(event => {
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
            if (!tokensWithData)
                return null;
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
                    priority: "high",
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
                    priority: "high",
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
                /** @type {Promise[]} */
                const tokensToRemove = [];
                response.results.forEach((result, index) => {
                    const error = result.error;
                    if (error) {
                        console.warn('Failure sending notification to', tokens[index], error); // Actually happens, so just warning.
                        // Cleanup the tokens who are not registered anymore.
                        if (error.code === 'messaging/invalid-registration-token' ||
                            error.code === 'messaging/registration-token-not-registered') {
                            tokensToRemove.push(admin.database().ref(fcmTokensPath + `/${token}`).remove());
                        }
                    }
                });
                return Promise.all(tokensToRemove);
            });
        }).catch((err) => {
            console.error("Error: ", err);
        });
    });
//# sourceMappingURL=index.js.map