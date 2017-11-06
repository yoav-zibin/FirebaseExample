var pushNotifications;
(function (pushNotifications) {
    function db() { return firebase.database(); }
    function messaging() { return firebase.messaging(); }
    let uid = null;
    let groupId = null;
    let hasFcmToken = false;
    function prettyJson(obj) {
        return JSON.stringify(obj, null, '  ');
    }
    function dbSet(ref, writeVal) {
        let writeValJson = prettyJson(writeVal);
        console.log(`Writing path=`, ref.toString(), ` writeVal=`, writeValJson, `...`);
        let promise = ref.set(writeVal);
        promise.then(() => {
            console.log(`Writing path=`, ref.toString(), ` succeeded.`);
        });
        return promise;
    }
    function writeUser() {
        let myUserPath = `/users/${uid}`;
        dbSet(db().ref(myUserPath), {
            publicFields: {
                avatarImageUrl: `https://foo.bar/avatar`,
                displayName: `Yoav Ziii`,
                isConnected: true,
                lastSeen: firebase.database.ServerValue.TIMESTAMP,
            },
            privateFields: {
                email: `yoav.zibin@yooo.goo`,
                createdOn: firebase.database.ServerValue.TIMESTAMP,
                phoneNumber: ``,
                facebookId: ``,
                googleId: ``,
                twitterId: ``,
                githubId: ``,
            },
        });
        writeGroup();
    }
    function gotFcmToken() {
        hasFcmToken = true;
        document.getElementById('requestPermission').innerHTML = "Send push notification in 2 seconds (so you can test both getting a notification in the foreground and background)";
    }
    function writeUserIfNeeded() {
        uid = firebase.auth().currentUser.uid;
        console.info("My uid=", uid);
        let myUserPath = `/users/${uid}`;
        db().ref(myUserPath).once('value').then((snap) => {
            let myUserInfo = snap.val();
            if (!myUserInfo) {
                writeUser();
                return;
            }
            console.log("User already exists");
            if (myUserInfo.privateFields && myUserInfo.privateFields.fcmTokens) {
                gotFcmToken();
            }
            if (myUserInfo.privateButAddable && myUserInfo.privateButAddable.groups) {
                console.log("Group already exists");
                groupId = Object.keys(myUserInfo.privateButAddable.groups)[0];
                return;
            }
            writeGroup();
        });
    }
    function writeGroup() {
        console.log("Create group");
        let groupData = db().ref(`/gamePortal/groups`).push();
        groupId = groupData.key;
        let groupPromise = dbSet(groupData, {
            participants: {
                [uid]: { participantIndex: 0 },
            },
            groupName: ``,
            createdOn: firebase.database.ServerValue.TIMESTAMP,
        });
        dbSet(db().ref(`/users/${uid}/privateButAddable/groups/${groupId}`), {
            addedByUid: uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
        });
    }
    function initMessaging(registration) {
        messaging().useServiceWorker(registration);
        messaging().onMessage(function (payload) {
            console.log("Message received when using the site (in foreground): ", payload);
            console.log("Careful! We handle push notifications in foreground, both here and inside the service worker (firebase-messaging-sw.js) in self.addEventListener('push', ...) , so careful of this case!");
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
        dbSet(db().ref(`/users/${uid}/privateFields/fcmTokens/${token}`), {
            "createdOn": firebase.database.ServerValue.TIMESTAMP,
            "lastTimeReceived": firebase.database.ServerValue.TIMESTAMP,
            "platform": "web",
            "app": "GamePortalAngular",
        });
        gotFcmToken();
    }
    function getFcmToken() {
        messaging().getToken()
            .then(function (token) {
            setFcmToken(token);
        })
            .catch(function (err) {
            console.log('Unable to retrieve refreshed token ', err);
        });
    }
    function sendPushNotification() {
        console.log('Send notification to myself.');
        let pushNotificationData = db().ref(`gamePortal/pushNotification`).push();
        dbSet(pushNotificationData, {
            "fromUserId": uid,
            "toUserId": uid,
            "groupId": groupId,
            "timestamp": firebase.database.ServerValue.TIMESTAMP,
            // Push notification message fields, see
            // https://firebase.google.com/docs/cloud-messaging/http-server-ref
            // https://firebase.google.com/docs/cloud-messaging/js/first-message
            "title": "title",
            "body": "body",
        });
    }
    function requestPermissionOrSendPushNotification() {
        if (hasFcmToken) {
            console.log('sendPushNotification in 2 seconds (so you will have time to switch to another tab or close the browser)');
            setTimeout(sendPushNotification, 2000);
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
            console.error(`Failed auth: `, error);
        });
    }
    function init() {
        // Initialize Firebase
        let config = {
            apiKey: "AIzaSyDA5tCzxNzykHgaSv1640GanShQze3UK-M",
            authDomain: "universalgamemaker.firebaseapp.com",
            databaseURL: "https://universalgamemaker.firebaseio.com",
            projectId: "universalgamemaker",
            storageBucket: "universalgamemaker.appspot.com",
            messagingSenderId: "144595629077"
        };
        firebase.initializeApp(config);
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('firebase-messaging-sw.js').then(function (registration) {
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