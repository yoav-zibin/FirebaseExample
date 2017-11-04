var pushNotifications;
(function (pushNotifications) {
    function db() { return firebase.database(); }
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
        let uid = firebase.auth().currentUser.uid;
        console.info("My uid=", uid);
        let userPromise = dbSet(db().ref(`/users/${uid}`), {
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
                pushNotificationsToken: ``,
            },
        });
        // Create group
        let groupData = db().ref(`/gamePortal/groups`).push();
        let groupId = groupData.key;
        let groupPromise = dbSet(groupData, {
            participants: {
                [uid]: { participantIndex: 0 },
            },
            groupName: ``,
            createdOn: firebase.database.ServerValue.TIMESTAMP,
        });
        const messaging = firebase.messaging();
        messaging.onMessage(function (payload) {
            console.log("Message received when using the site (in foreground): ", payload);
            alert("Got notification, check the JS console");
        });
        messaging.onTokenRefresh(function () {
            console.log('onTokenRefresh: if for some reason the FCM token changed, then we write it again in DB');
            messaging.getToken()
                .then(function (refreshedToken) {
                console.log('Token refreshed:', refreshedToken);
                dbSet(db().ref(`/users/${uid}/privateFields/pushNotificationsToken`), refreshedToken);
            });
        });
        messaging.requestPermission()
            .then(function () {
            console.log('Notification permission granted.');
            messaging.getToken()
                .then(function (token) {
                console.log('Token:', token);
                let fcmTokenPromise = dbSet(db().ref(`/users/${uid}/privateFields/pushNotificationsToken`), token);
                // Wait for all DB write operations to finish.
                Promise.all([fcmTokenPromise, userPromise, groupPromise]).then(() => {
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
                });
            })
                .catch(function (err) {
                console.log('Unable to retrieve refreshed token ', err);
            });
        })
            .catch(function (err) {
            console.log('Unable to get permission to notify.', err);
        });
    }
    function firebaseLogin() {
        firebase.auth().signInAnonymously()
            .then(function (result) {
            console.info(result);
            writeUser();
        })
            .catch(function (error) {
            console.error(`Failed auth: `, error);
        });
    }
    function login() {
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
                firebase.messaging().useServiceWorker(registration);
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
    document.getElementById('login').onclick = login;
})(pushNotifications || (pushNotifications = {}));
//# sourceMappingURL=firebasePushNotifications.js.map