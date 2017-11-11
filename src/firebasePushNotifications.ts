module pushNotifications {
  function db() { return firebase.database(); }
  function messaging() { return firebase.messaging(); }
  
  let uid: string = null;
  let groupId: string = null;
  let hasFcmToken = false;

  function prettyJson(obj: any): string {
    return JSON.stringify(obj, null, '  ');
  }

  function dbSet(ref: any, writeVal: any) {
    let writeValJson = prettyJson(writeVal);
    console.log(`Writing path=`, ref.toString(), ` writeVal=`, writeValJson, `...`);
    ref.set(writeVal);
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
    document.getElementById('requestPermission').innerHTML = "Send push notification in 2 seconds (so you can test both getting a notification in the foreground and background). I'll also send another message after the window is closed.";
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
      if (myUserInfo.privateButAddable && myUserInfo.privateButAddable.groups) {
        console.log("Group already exists");
        setGroupId(Object.keys(myUserInfo.privateButAddable.groups)[0]);
        return;
      }
      writeGroup();
    });
  }

  function setGroupId(_groupId: string) {
    if (!uid) throw Error("Missing uid!");
    if (groupId) throw Error("groupId was already set!");
    groupId = _groupId;
    console.log("Update the FCM token every time the app starts");
    getFcmToken();
    console.log("For testing purposes, setting up onDisconnect so we'll send a push notification when the tab is closed.");
    sendPushNotification(true);
  }

  function writeGroup() {
    console.log("Create group");
    let groupData = db().ref(`/gamePortal/groups`).push();
    setGroupId(groupData.key);
    dbSet(groupData, {
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

  interface PushNotificationPayload {
    notification: PushNotificationMessage;
    data: PushNotificationData;
  }
  interface PushNotificationMessage {
    title: string;
    body: string;
  }
  interface PushNotificationData {
    fromUserId: string;
    groupId: string;
    timestamp: string;
  }

  function initMessaging(registration: any) {
    messaging().useServiceWorker(registration);

    messaging().onMessage(function(payload: PushNotificationPayload) {
      console.log("Here you can handle push notification in foreground, using payload=", payload);
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
    dbSet(db().ref(`/users/${uid}/privateFields/fcmTokens/${token}`), {
      "createdOn": firebase.database.ServerValue.TIMESTAMP,
      "lastTimeReceived": firebase.database.ServerValue.TIMESTAMP,
      "platform": "web",
      "app": "GamePortalAngular",
    });
    gotFcmToken();
  }

  function getFcmToken() {
    console.log("getFcmToken");
    messaging().getToken().then(function(token) {
      setFcmToken(token);
    }, function(err) {
      console.log('Unable to retrieve refreshed token ', err);
    });
  }

  let notificationCounter = 0;

  function sendPushNotification(onDisconnect: boolean) {
    notificationCounter++;
    console.log('Send notification to myself. notificationCounter=', notificationCounter);
    let messageData: any = db().ref(`gamePortal/groups/${groupId}/messages`).push();
    if (onDisconnect) messageData = messageData.onDisconnect();
    dbSet(messageData, {
      "senderUid": uid,
      "message": "TEST_SEND_PUSH_NOTIFICATION" + notificationCounter,
      "timestamp": firebase.database.ServerValue.TIMESTAMP,
    });
  }
  
  function requestPermissionOrSendPushNotification() {
    if (hasFcmToken) {
      console.log('sendPushNotification in 2 seconds (so you will have time to switch to another tab or close the browser)');
      setTimeout(()=>sendPushNotification(false), 2000);
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
      let serviceWorker: any = (<any>navigator).serviceWorker;
      serviceWorker.register('https://yoav-zibin.github.io/FirebaseExample/firebase-messaging-sw.js').then(function(registration: any) {
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
  document.getElementById('requestPermission').onclick = requestPermissionOrSendPushNotification;

}  