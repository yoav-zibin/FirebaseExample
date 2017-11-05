module pushNotifications {
  function db() { return firebase.database(); }
  function messaging() { return firebase.messaging(); }
  
  let uid: string = null;
  let groupId: string = null;
  let hasFcmToken = false;

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
        pushNotificationsToken: ``,
      },
    });

    writeGroup();
  }

  function gotFcmToken() {
    hasFcmToken = true;
    document.getElementById('requestPermission').innerHTML = "Send push notification";
  }

  function writeUserIfNeeded() {
    uid = firebase.auth().currentUser.uid;
    console.info("My uid=", uid);
    let myUserPath = `/users/${uid}`;
    db().ref(myUserPath).once('value').then((snap)=>{
      let myUserInfo = snap.val();
      if (!myUserInfo) {
        writeUser();
        return;
      }
      console.log("User already exists");
      if (myUserInfo.privateFields && myUserInfo.privateFields.pushNotificationsToken) {
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
        [uid]: {participantIndex: 0},
      },
      groupName: ``,
      createdOn: firebase.database.ServerValue.TIMESTAMP,
    });
    
    dbSet(db().ref(`/users/${uid}/privateButAddable/groups/${groupId}`), {
      addedByUid: uid,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    });
  }

  function initMessaging(registration: any) {
    messaging().useServiceWorker(registration);

    messaging().onMessage(function(payload: any) {
      console.log("Message received when using the site (in foreground): ", payload);
      /* payload is:
      {
        "from": "144595629077",
        "collapse_key": "do_not_collapse",
        "data": {
          "fromUserId": "Ikg7ctOMN0bWiOEoYca3Gm4pEWa2",
          "groupId": "-Ky7jLs23EeJ5Dilt_tI",
          "toUserId": "Ikg7ctOMN0bWiOEoYca3Gm4pEWa2",
          "timestamp": "1509827591946"
        },
        "notification": {
          "title": "title",
          "body": "body"
        }
      }*/
      alert("Got notification, check the JS console");
    });

    messaging().onTokenRefresh(function() {
      console.log('onTokenRefresh: if for some reason the FCM token changed, then we write it again in DB');
      messaging().getToken()
      .then(function(refreshedToken) {
        console.log('Token refreshed:', refreshedToken, "uid=", uid);
        if (uid) {
          setFcmToken(refreshedToken);
        }
      });
    });
  }

  function setFcmToken(token: string) {
    console.log('Token:', token);
    dbSet(db().ref(`/users/${uid}/privateFields/pushNotificationsToken`), token);
    gotFcmToken();
  }

  function getFcmToken() {
    messaging().getToken()
    .then(function(token) {
      setFcmToken(token);
    })
    .catch(function(err) {
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
      sendPushNotification();
      return;
    }

    console.log('Request permission to get push notifications.');
    messaging().requestPermission()
    .then(function() {
      console.log('Notification permission granted.');
      getFcmToken();
    })
    .catch(function(err) {
      console.log('Unable to get permission to notify.', err);
    });
  }

  function firebaseLogin() {
    firebase.auth().signInAnonymously()
      .then(function(result) {
        console.info(result);
        writeUserIfNeeded();
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
        initMessaging(registration);
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
  document.getElementById('requestPermission').onclick = requestPermissionOrSendPushNotification();

}  