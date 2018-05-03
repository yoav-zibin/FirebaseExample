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
//# sourceMappingURL=index.js.map