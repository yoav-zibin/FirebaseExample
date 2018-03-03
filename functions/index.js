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
// TODO: implement newContacts, we need to build a private index on phoneNumber (used just by the cloud function).
// TODO: implement push notification when someone writes to
// /gamePortal/matches/$matchId/participants/$participantUserId/pingOpponents
exports.testPushNotification =
    functions.database.ref('testPushNotification').onWrite((event) => {
        let fcmToken = event.data.val();
        if (!fcmToken) {
            console.log(`No fcmToken`);
            return null;
        }
        const payload = {
            notification: {
                title: "Monopoly game is starting",
                body: "Open GamePortal and join the fun!",
            },
            data: {
                // Must be only strings in these key-value pairs
                examplePayload: "Some arbitrary payload string",
                fcmToken: fcmToken,
            }
        };
        return admin.messaging().sendToDevice([fcmToken], payload)
            .catch((err) => {
            console.error("Error: ", err);
        });
    });
//# sourceMappingURL=index.js.map