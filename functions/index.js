'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
var functions = require('firebase-functions');
var admin = require('firebase-admin');
var gcs = require('@google-cloud/storage')();
var spawn = require('child-process-promise').spawn;
var os = require('os');
var path = require('path');
var fs = require('fs');
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
        .onWrite(function (event) {
        function getSortedKeys(original) {
            var keys = Object.keys(original);
            // Filter users with duplicate entries.
            keys.sort(function (key1, key2) { return original[key2].timestamp - original[key1].timestamp; }); // newest entries are at the beginning
            return keys;
        }
        var maxEntries = 20;
        if (!event.data.exists()) {
            console.log('deleteOldEntriesOnRecentlyConnected: no data');
            return null;
        }
        var original = event.data.val();
        var updates = {};
        var keys = getSortedKeys(original);
        var userIds = {};
        for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
            var key = keys_1[_i];
            var recentlyConnectedEntry = original[key];
            var userId = recentlyConnectedEntry.userId;
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
            for (var _a = 0, keys_2 = keys; _a < keys_2.length; _a++) {
                var key = keys_2[_a];
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
function encodeAsFirebaseKey(str) {
    return str.toLowerCase() // Always search the indices with lower-case strings.
        .replace(/\%/g, '%25')
        .replace(/\./g, '%2E')
        .replace(/\#/g, '%23')
        .replace(/\$/g, '%24')
        .replace(/\//g, '%2F')
        .replace(/\[/g, '%5B')
        .replace(/\]/g, '%5D');
}
function handlerForIndex(field) {
    return function (event) {
        var userId = event.params.userId;
        var data = event.data.val();
        console.log('Field ', field, ' added/updated for userId=', userId, 'data=', data);
        if (!data || data == 'anonymous.user@gmail.com')
            return null;
        var encodedData = encodeAsFirebaseKey(data);
        return admin.database().ref("gamePortal/userIdIndices/" + field + "/" + encodedData + "/" + userId).set(admin.database.ServerValue.TIMESTAMP);
    };
}
function handlerForDisplayNameIndex() {
    return function (event) {
        var userId = event.params.userId;
        var data = '' + event.data.val();
        console.log('DisplayName added/updated for userId=', userId, 'data=', data);
        var splitDisplayName = data.split(/\s+/, 4);
        splitDisplayName.push(data);
        var promises = splitDisplayName.map(function (name) { return admin.database().ref("gamePortal/userIdIndices/displayName/" + encodeAsFirebaseKey(name) + "/" + userId).set(admin.database.ServerValue.TIMESTAMP); });
        return Promise.all(promises);
    };
}
function createIndex(field) {
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
function sendPushToUser(toUserId, senderUid, senderName, body, timestamp, groupId) {
    console.log('Sending push notification:', toUserId, senderUid, senderName, body, timestamp, groupId);
    var fcmTokensPath = "/users/" + toUserId + "/privateFields/fcmTokens";
    // Get the list of device notification tokens.
    return admin.database().ref(fcmTokensPath).once('value').then(function (tokensSnapshot) {
        var tokensWithData = tokensSnapshot.val();
        console.log('tokensWithData=', tokensWithData);
        if (!tokensWithData)
            return null;
        // Find the tokens with the latest lastTimeReceived.
        var tokens = Object.keys(tokensWithData);
        tokens.sort(function (token1, token2) { return tokensWithData[token2].lastTimeReceived - tokensWithData[token1].lastTimeReceived; }); // newest entries are at the beginning
        var token = tokens[0]; // TODO: Maybe in the future I should retry other tokens if this one fails.
        var tokenData = tokensWithData[token];
        console.log('token=', token, 'tokenData=', tokenData);
        // https://firebase.google.com/docs/cloud-messaging/concept-options
        // The common keys that are interpreted by all app instances regardless of platform are message.notification.title, message.notification.body, and message.data.
        // Push notification message fields, see
        // https://firebase.google.com/docs/cloud-messaging/http-server-ref
        // https://firebase.google.com/docs/cloud-messaging/js/first-message
        // `firebasePushNotifications.html?groupId=${data.groupId}&timestamp=${data.timestamp}&fromUserId=${data.fromUserId}`
        var payload = {
            notification: {
                title: senderName,
                body: body
            },
            data: {
                // Must be only strings in these key-value pairs
                fromUserId: String(senderUid),
                toUserId: String(toUserId),
                groupId: String(groupId),
                timestamp: String(timestamp)
            }
        };
        if (tokenData.platform == "web") {
            payload.notification.click_action =
                // GamePortalAngular|GamePortalReact
                "https://yoav-zibin.github.io/" + tokenData.app + "/play/" + groupId;
        }
        return admin.messaging().sendToDevice([token], payload).then(function (response) {
            // For each message check if there was an error.
            var tokensToRemove = [];
            response.results.forEach(function (result, index) {
                var error = result.error;
                if (error) {
                    console.warn('Failure sending notification to', token, error); // Actually happens, so just warning.
                    // Cleanup the tokens who are not registered anymore.
                    if (error.code === 'messaging/invalid-registration-token' ||
                        error.code === 'messaging/registration-token-not-registered') {
                        tokensToRemove.push(admin.database().ref(fcmTokensPath + ("/" + token)).remove());
                    }
                }
                else {
                    console.log('Success sending push to ', token);
                }
            });
            return Promise.all(tokensToRemove);
        });
    })["catch"](function (err) {
        console.error("Error: ", err);
    });
}
exports.sendNotifications =
    functions.database.ref('gamePortal/groups/{groupId}/messages/{messageId}').onWrite(function (event) {
        var messageData = event.data.val();
        if (!messageData) {
            console.log("No message");
            return null;
        }
        var senderUid = String(messageData.senderUid);
        var body = String(messageData.message);
        var timestamp = String(messageData.timestamp);
        var groupId = String(event.params.groupId);
        var messageId = String(event.params.messageId);
        console.log('Got chat message! senderUid=', senderUid, ' body=', body, ' timestamp=', timestamp, ' groupId=', groupId, ' messageId=', messageId);
        // Get sender name and participants
        return Promise.all([
            admin.database().ref("/users/" + senderUid + "/publicFields/displayName").once('value'),
            admin.database().ref("/gamePortal/groups/" + groupId + "/participants").once('value'),
        ]).then(function (results) {
            var senderName = results[0].val();
            var participants = results[1].val();
            console.log('senderName=', senderName, ' participants=', participants);
            // Send push to all participants except the sender (but we include the sender for "TEST_SEND_PUSH_NOTIFICATION")
            var targetUserIds = Object.keys(participants);
            if (!body.startsWith("TEST_SEND_PUSH_NOTIFICATION")) {
                targetUserIds = targetUserIds.filter(function (userId) { return userId != senderUid; });
            }
            var promises = [];
            for (var _i = 0, targetUserIds_1 = targetUserIds; _i < targetUserIds_1.length; _i++) {
                var toUserId = targetUserIds_1[_i];
                promises.push(sendPushToUser(toUserId, senderUid, senderName, body, timestamp, groupId));
            }
            return Promise.all(promises);
        });
    });
exports.starsSummary =
    functions.database.ref('gamePortal/gameSpec/reviews/{reviewedGameSpecId}/{reviewerUserId}/stars')
        .onWrite(function (event) {
        console.log("Updating reviews!");
        // stars are between 1 to 5 (inclusive)
        var oldStars = event.data.previous.val();
        var newStars = event.data.val();
        if (!oldStars && !newStars) {
            console.log("No oldStars nor newStars");
            return null;
        }
        var reviewedGameSpecId = String(event.params.reviewedGameSpecId);
        console.log("Updating reviews for reviewedGameSpecId=" + reviewedGameSpecId + " from oldStars=" + oldStars + " to newStars=" + newStars);
        var starsSummaryPath = "gamePortal/gameSpec/starsSummary/" + reviewedGameSpecId;
        var starsRef = admin.database().ref(starsSummaryPath);
        return starsRef.transaction(function (starsSummary) {
            console.log("starsSummary before: ", JSON.stringify(starsSummary));
            if (oldStars && starsSummary && starsSummary[oldStars] > 0) {
                starsSummary[oldStars]--;
            }
            if (newStars) {
                if (!starsSummary)
                    starsSummary = {};
                starsSummary[newStars] = (starsSummary[newStars] || 0) + 1;
            }
            console.log("starsSummary after: ", JSON.stringify(starsSummary));
            return starsSummary;
        });
    });
exports.resizeImage =
    functions.storage.object().onChange(function (event) { return __awaiter(_this, void 0, void 0, function () {
        var filePath, bucket, resourceState, metageneration, contentType, metadata, fileName, tempFilePath, filePath70, filePath50, thumbnailPath;
        return __generator(this, function (_a) {
            filePath = event.data.name;
            bucket = gcs.bucket(event.data.bucket);
            resourceState = event.data.resourceState;
            metageneration = event.data.metageneration;
            contentType = event.data.contentType;
            metadata = { contentType: contentType };
            fileName = path.basename(filePath);
            console.log("File name is", fileName);
            tempFilePath = path.join(os.tmpdir(), fileName);
            filePath70 = path.join('quality70', fileName);
            filePath50 = path.join('quality50', fileName);
            thumbnailPath = path.join('thumbnail', fileName);
            console.log("Download path: ", tempFilePath);
            console.log("File50 path: ", filePath50);
            console.log("File70 path: ", filePath70);
            console.log("Thumbnail path: ", thumbnailPath);
            // Exit if we have already processed the image
            if (filePath.includes('quality70') || filePath.includes('quality50') || filePath.includes('thumbnail')) {
                console.log("Already processed this file.");
                return [2 /*return*/, null];
            }
            // Exit if this is a move or deletion event.
            if (resourceState === 'not_exists') {
                console.log('This is a deletion event.');
                return [2 /*return*/, null];
            }
            // Exit if file exists but is not new and is only being triggered
            // because of a metadata change.
            if (resourceState === 'exists' && metageneration > 1) {
                console.log('This is a metadata change event.');
                return [2 /*return*/, null];
            }
            console.log("Resizing the image with path: ", filePath, " and filename: ", fileName);
            // Download file from GCS to tempFilePath
            // and chain together promises for the 3 file resizings
            return [2 /*return*/, bucket.file(filePath).download({
                    destination: tempFilePath
                }).then(function () {
                    console.log('Image downloaded locally to', tempFilePath);
                    console.log('Converting image to thumbnail');
                    return spawn('convert', [tempFilePath, '-thumbnail', '200x200>', tempFilePath]);
                }).then(function () {
                    console.log("Uploading thumbnail");
                    return bucket.upload(tempFilePath, { destination: thumbnailPath, metadata: metadata });
                }).then(function () {
                    console.log("Converting image to quality70");
                    return spawn('convert', [tempFilePath, '-quality', '70', tempFilePath]);
                }).then(function () {
                    console.log("Uploading quality70 image");
                    return bucket.upload(tempFilePath, { destination: filePath70, metadata: metadata });
                }).then(function () {
                    console.log("Converting image to quality50");
                    return spawn('convert', [tempFilePath, '-quality', '50', tempFilePath]);
                }).then(function () {
                    console.log("Uploading quality50 image");
                    return bucket.upload(tempFilePath, { destination: filePath50, metadata: metadata });
                }).then(function () { return fs.unlinkSync(tempFilePath); })];
        });
    }); });
