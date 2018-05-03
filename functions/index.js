'use strict';
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// To install: 
// npm install -g firebase-tools
// firebase login
//
// Ensure headers (CORS and caching) are set correctly:
// gsutil cors set cors.json gs://universalgamemaker.appspot.com
// gsutil -m setmeta   -h "Cache-Control:public, max-age=3600000"  gs://universalgamemaker.appspot.com/**
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
// TODO: implement push notification.
// We will have 2 types of notifications:
//
// 1) When someone added you as a participant, i.e., when someone writes to:
// /gamePortal/gamePortalUsers/${userId}/privateButAddable/matchMemberships/${matchId}/addedByUid
// then it will send a push notification to ${userId} with the text:
// {title: "<user-name> added you to a game of <Monopoly>", body: "Open Zibiga now to join the fun!"}
// <user-name> will be either the contact name or displayName of addedByUid, with preference to contact name.
// Recall that contact names are stored in /privateFields/contacts/$contactPhoneNumber/contactName
// Recall that displayName are stored in /publicFields/displayName
//
exports.addMatchParticipant = functions.database
    .ref('/gamePortal/gamePortalUsers/{userId}/privateButAddable/matchMemberships/{matchId}/addedByUid')
    .onWrite((change, context) => {
    const adderUserId = context.params.addedByUid;
    const addedUserId = context.params.userId;
    const matchId = context.params.matchId;
    if (!change.after.val()) {
        return console.log('Same User');
    }
    console.log('User Id:', adderUserId, 'Added By user:', addedUserId);
    return sendPushToUser(addedUserId, adderUserId, matchId);
});
// 2) When someone writes to
// /gamePortal/matches/$matchId/participants/$participantUserId/pingOpponents
// Suppose we have a match between users A, B, C.
// When user A writes to:
// /gamePortal/matches/$matchId/participants/<userId-of-A>/pingOpponents
// Then it will send a notifications to users B & C, with the text:
// {title: "<user-name> resumes the game of <Monopoly>", body: "Open Zibiga now to join the fun!"}
// As before, <user-name> is either the contact name or displayName.
exports.testPushNotification =
    functions.database.ref('testPushNotification').onWrite((event) => {
        let fcmToken = event.data.val();
        console.log(`testPushNotification fcmToken=` + fcmToken);
        console.error(`testPushNotification testing an error!=` + fcmToken);
        if (!fcmToken) {
            console.log(`No fcmToken`);
            return null;
        }
        const payload = {
            notification: {
                title: "Monopoly game is starting",
                body: "Open Zibiga and join the fun!",
            },
            data: {
                // Must be only strings in these key-value pairs
                examplePayload: "Some arbitrary payload string",
            }
        };
        return admin.messaging().sendToDevice([fcmToken], payload)
            .catch((err) => {
            console.error("Error: ", err);
        });
    });
// Code taken from https://github.com/firebase/functions-samples/blob/master/fcm-notifications/functions/index.js
// function sendPushToUser(
//   toUserId: string, senderUid: string,  body: string, timestamp: string, groupId: string) {
function sendPushToUser(toUserId, senderUid, matchId) {
    console.log('Sending push notification:', toUserId, senderUid);
    let fcmTokensPath = `/gamePortal/gamePortalUsers/${toUserId}/privateFields/fcmTokens`;
    // Get the list of device notification tokens.
    return admin.database().ref(fcmTokensPath).once('value').then((tokensSnapshot) => {
        let tokensWithData = tokensSnapshot.val();
        console.log('tokensWithData=', tokensWithData);
        if (!tokensWithData)
            return null;
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
        const payload = {
            notification: {
                title: "Monopoly is starting",
                body: "Join Zibiga",
            },
            data: {
                // Must be only strings in these key-value pairs
                fromUserId: String(senderUid),
                toUserId: String(toUserId)
            }
        };
        if (tokenData.platform == "web") {
            payload.notification.click_action =
                `https://yoav-zibin.github.io/NewGamePortal/matches/${matchId}`;
        }
        return admin.messaging().sendToDevice([token], payload).then((response) => {
            // For each message check if there was an error.
            const tokensToRemove = [];
            response.results.forEach((result, index) => {
                const error = result.error;
                if (error) {
                    console.warn('Failure sending notification to', token, error); // Actually happens, so just warning.
                    // Cleanup the tokens who are not registered anymore.
                    if (error.code === 'messaging/invalid-registration-token' ||
                        error.code === 'messaging/registration-token-not-registered') {
                        tokensToRemove.push(admin.database().ref(fcmTokensPath + `/${token}`).remove());
                    }
                }
                else {
                    console.log('Success sending push to ', token);
                }
            });
            return Promise.all(tokensToRemove);
        });
    }).catch((err) => {
        console.error("Error: ", err);
    });
}
//# sourceMappingURL=index.js.map