var pushNotifications;
(function (pushNotifications) {
    function db() { return firebase.database(); }
    function messaging() { return firebase.messaging(); }
    var uid = null;
    var matchId = null;
    var hasFcmToken = false;
    function prettyJson(obj) {
        return JSON.stringify(obj, null, '  ');
    }
    function dbSet(ref, writeVal) {
        var writeValJson = prettyJson(writeVal);
        console.log("Writing path=", ref.toString(), " writeVal=", writeValJson, "...");
        ref.set(writeVal);
    }
    function writeUser() {
        var myUserPath = "/gamePortal/gamePortalUsers/" + uid;
        dbSet(db().ref(myUserPath), {
            privateFields: {
                createdOn: firebase.database.ServerValue.TIMESTAMP,
                phoneNumber: "",
                countryCode: "",
            },
        });
        writeMatch();
    }
    function gotFcmToken() {
        hasFcmToken = true;
        document.getElementById('requestPermission').innerHTML = "Send push notification in 2 seconds (so you can test both getting a notification in the foreground and background). I'll also send another message after the window is closed.";
    }
    function writeUserIfNeeded() {
        uid = firebase.auth().currentUser.uid;
        console.info("My uid=", uid);
        var myUserPath = "/gamePortal/gamePortalUsers/" + uid;
        db().ref(myUserPath).once('value').then(function (snap) {
            var myUserInfo = snap.val();
            if (!myUserInfo) {
                writeUser();
                return;
            }
            console.log("User already exists");
            if (myUserInfo.privateButAddable && myUserInfo.privateButAddable.matchMemberships) {
                console.log("matchMemberships already exists");
                setmatchId(Object.keys(myUserInfo.privateButAddable.matchMemberships)[0]);
                return;
            }
            writeMatch();
        });
    }
    function setmatchId(_matchId) {
        if (!uid)
            throw Error("Missing uid!");
        if (matchId)
            throw Error("matchId was already set!");
        matchId = _matchId;
        console.log("Update the FCM token every time the app starts");
        getFcmToken();
        console.log("For testing purposes, setting up onDisconnect so we'll send a push notification when the tab is closed.");
        sendPushNotification(true);
    }
    var idSuffix = "ForPushNotification";
    function addImage(id, width, height, isBoardImage) {
        dbSet(db().ref("/gameBuilder/images/" + id + idSuffix), {
            name: "whatever",
            width: width,
            height: height,
            sizeInBytes: 150000,
            isBoardImage: isBoardImage,
            downloadURL: "https://blabla.com",
            cloudStoragePath: "images/-KuV-Y9TXnfnaZExRTli.gif",
            uploaderEmail: "yoav@goo.bar",
            uploaderUid: uid,
            createdOn: firebase.database.ServerValue.TIMESTAMP,
        });
    }
    function writeMatch() {
        console.log("Create match");
        addImage("gameIcon50x50", 50, 50, false);
        addImage("gameIcon512x512", 512, 512, false);
        addImage("boardImage", 1024, 10, true);
        dbSet(db().ref("/gameBuilder/gameSpecs/gameSpec" + idSuffix), {
            uploaderEmail: "yoav@goo.bar",
            uploaderUid: uid,
            createdOn: firebase.database.ServerValue.TIMESTAMP,
            gameName: "Chess!",
            gameIcon50x50: "gameIcon50x50" + idSuffix,
            gameIcon512x512: "gameIcon512x512" + idSuffix,
            screenShotImageId: "boardImage" + idSuffix,
            wikipediaUrl: "https://en.wikipedia.org/wiki/Chess",
            tutorialYoutubeVideo: "",
            board: {
                imageId: "boardImage" + idSuffix,
                backgroundColor: "FFFFFF",
                maxScale: 1,
            },
            pieces: [],
        });
        var matchData = db().ref("/gamePortal/matches").push();
        setmatchId(matchData.key);
        dbSet(matchData, {
            participants: (_a = {},
                _a[uid] = { participantIndex: 0, pingOpponents: firebase.database.ServerValue.TIMESTAMP, },
                _a),
            createdOn: firebase.database.ServerValue.TIMESTAMP,
            lastUpdatedOn: firebase.database.ServerValue.TIMESTAMP,
            gameSpecId: "gameSpec" + idSuffix,
        });
        dbSet(db().ref("/gamePortal/gamePortalUsers/" + uid + "/privateButAddable/matchMemberships/" + matchId), {
            addedByUid: uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
        });
        var _a;
    }
    function initMessaging(registration) {
        console.log('Init push messaging');
        messaging().useServiceWorker(registration);
        messaging().onMessage(function (payload) {
            // TODO: students, show in-app notification here
            console.log("Here you can handle push notification in foreground, using payload=", payload);
        });
        messaging().onTokenRefresh(function () {
            console.log('onTokenRefresh: if for some reason the FCM token changed, then we write it again in DB');
            messaging().getToken()
                .then(function (refreshedToken) {
                console.log('Token refreshed:', refreshedToken, "uid=", uid);
                if (uid) {
                    setFcmToken(refreshedToken);
                }
            });
        });
    }
    function setFcmToken(token) {
        console.log('Token:', token);
        dbSet(db().ref("/gamePortal/gamePortalUsers/" + uid + "/privateFields/fcmTokens/" + token), {
            "lastTimeReceived": firebase.database.ServerValue.TIMESTAMP,
            "platform": "web",
        });
        gotFcmToken();
    }
    function getFcmToken() {
        console.log("getFcmToken");
        messaging().getToken().then(function (token) {
            setFcmToken(token);
        }, function (err) {
            console.log('Unable to retrieve refreshed token ', err);
        });
    }
    var notificationCounter = 0;
    function sendPushNotification(onDisconnect) {
        notificationCounter++;
        console.log('Send notification to myself. notificationCounter=', notificationCounter);
        var messageData = db().ref("gamePortal/matches/" + matchId + "/participants/" + uid + "/pingOpponents");
        if (onDisconnect)
            messageData = messageData.onDisconnect();
        dbSet(messageData, firebase.database.ServerValue.TIMESTAMP);
    }
    function requestPermissionOrSendPushNotification() {
        if (hasFcmToken) {
            console.log('sendPushNotification in 2 seconds (so you will have time to switch to another tab or close the browser)');
            setTimeout(function () { return sendPushNotification(false); }, 2000);
            return;
        }
        console.log('Request permission to get push notifications.');
        messaging().requestPermission()
            .then(function () {
            console.log('Notification permission granted.');
            getFcmToken();
        })
            .catch(function (err) {
            console.log('Unable to get permission to notify.', err);
        });
    }
    function firebaseLogin() {
        firebase.auth().signInAnonymously()
            .then(function (result) {
            console.info(result);
            writeUserIfNeeded();
        })
            .catch(function (error) {
            console.error("Failed auth: ", error);
        });
    }
    function init() {
        // Initialize Firebase
        var config = {
            apiKey: "AIzaSyA_UNWBNj7zXrrwMYq49aUaSQqygDg66SI",
            authDomain: "testproject-a6dce.firebaseapp.com",
            databaseURL: "https://testproject-a6dce.firebaseio.com",
            projectId: "testproject-a6dce",
            storageBucket: "",
            messagingSenderId: "957323548528"
        };
        firebase.initializeApp(config);
        if ('serviceWorker' in navigator) {
            var serviceWorker = navigator.serviceWorker;
            serviceWorker.register('https://yoav-zibin.github.io/FirebaseExample/firebase-messaging-sw.js').then(function (registration) {
                // Registration was successful
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
                initMessaging(registration);
                firebaseLogin();
            }, function (err) {
                // registration failed :(
                console.error('ServiceWorker registration failed: ', err);
            });
        }
        else {
            console.error('No ServiceWorker!');
        }
    }
    init();
    document.getElementById('requestPermission').onclick = requestPermissionOrSendPushNotification;
})(pushNotifications || (pushNotifications = {}));
//# sourceMappingURL=firebasePushNotifications.js.map