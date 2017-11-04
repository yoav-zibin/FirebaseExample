module pushNotifications {
  const messaging = firebase.messaging();
  const db = firebase.database();
  let uid: string = null;
  let groupId: string = null;

  function prettyJson(obj: any): string {
    return JSON.stringify(obj, null, '  ')
  }

  function dbSet(ref: any, writeVal: any) {
    let writeValJson = prettyJson(writeVal);
    console.log(`Writing path=`, ref.toString(), ` writeVal=`, writeValJson, `...`);
    let promise = ref.set(writeVal);
    promise.then(()=>{
      console.log(`Writing path=`, ref.toString(), ` succeeded.`);
    })
    return promise;
  }

  function writeUser() {
    uid = firebase.auth().currentUser.uid;
    console.info("My uid=", uid);
    dbSet(db .ref(`/users/${uid}`), {
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
    let groupData = db .ref(`/gamePortal/groups`).push();
    groupId = groupData.key;
    let groupPromise = dbSet(groupData, {
      participants: {
        [uid]: {participantIndex: 0},
      },
      groupName: ``,
      createdOn: firebase.database.ServerValue.TIMESTAMP,
    });
    
    messaging.onMessage(function(payload: any) {
      console.log("Message received when using the site (in foreground): ", payload);
      alert("Got notification, check the JS console");
    });

    messaging.onTokenRefresh(function() {
      console.log('onTokenRefresh: if for some reason the FCM token changed, then we write it again in DB');
      messaging.getToken()
      .then(function(refreshedToken) {
        console.log('Token refreshed:', refreshedToken);
        dbSet(db .ref(`/users/${uid}/privateFields/pushNotificationsToken`), refreshedToken);
      });
    });
  }

  function getFcmToken() {
    messaging.getToken()
    .then(function(token) {
      console.log('Token:', token);
      let fcmTokenPromise = dbSet(db .ref(`/users/${uid}/privateFields/pushNotificationsToken`), token);
      // Wait for all DB write operations to finish.
      Promise.all([fcmTokenPromise]).then(() => {
        console.log('Send notification to myself.');
        let pushNotificationData = db .ref(`gamePortal/pushNotification`).push();
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
      })
    })
    .catch(function(err) {
      console.log('Unable to retrieve refreshed token ', err);
    });
  }
  
  function requestPermission() {
    messaging.requestPermission()
    .then(function() {
      console.log('Notification permission granted.');
      
    })
    .catch(function(err) {
      console.log('Unable to get permission to notify.', err);
    });
  }

  function firebaseLogin() {
    firebase.auth().signInAnonymously()
      .then(function(result) {
        console.info(result);
        writeUser();
      })
      .catch(function(error) {
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
      (<any>navigator).serviceWorker.register('firebase-messaging-sw.js').then(function(registration: any) {
        // Registration was successful
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
        messaging.useServiceWorker(registration);
        firebaseLogin();
      }, function(err: any) {
        // registration failed :(
        console.error('ServiceWorker registration failed: ', err);
      });
    } else {
      console.error('No ServiceWorker!');
    }
  }

  init();
  document.getElementById('requestPermission').onclick = requestPermission;

}  