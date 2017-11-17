module webRTC {
  function db() { return firebase.database(); }
  function messaging() { return firebase.messaging(); }

  function prettyJson(obj: any): string {
    return JSON.stringify(obj, null, '  ');
  }

  function dbSet(ref: any, writeVal: any) {
    let writeValJson = prettyJson(writeVal);
    console.log(`Writing path=`, ref.toString(), ` writeVal=`, writeValJson, `...`);
    ref.set(writeVal);
  }

  
  let uid: string = null;

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
  }

  function writeUserIfNeeded() {
    uid = firebase.auth().currentUser.uid;
    console.info("My uid=", uid);
    listenToMessages();
    (<HTMLInputElement>document.getElementById('myUserId')).value = uid;
    
    let myUserPath = `/users/${uid}`;
    db().ref(myUserPath).once('value').then((snap)=>{
      let myUserInfo = snap.val();
      if (!myUserInfo) {
        writeUser();
        return;
      }
      console.log("User already exists");
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
    firebaseLogin();
  }

  // Signalling using firebase.
  // We send messages to a user by writing SignalData to
  // users/$userId/privateButAddable/signal/$signalId
  // And the target user will read the signals and delete them after reading them.
  interface SignalMsg {
    addedByUid: string;
    timestamp: any;
    signalType: string;
    signalData: string;
  }
  function sendMessage(signalType: string, signalData: string) {
    if (!targetUserId) throw new Error("Missing targetUserId");
    let ref = db().ref(`users/${targetUserId}/privateButAddable/signal`).push();
    let signalMsg: SignalMsg = {
      addedByUid: uid,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      signalData: signalData,
      signalType: signalType,
    };
    dbSet(ref, signalMsg);
  }
  function listenToMessages() {
    let path = `users/${uid}/privateButAddable/signal`;
    db().ref(path).on('value',
      (snap: any) => {
        let signals: any = snap.val();
        console.log("Got signals=", signals);
        if (!signals) return;

        let signalIds = Object.keys(signals);
        signalIds.sort((signalId1, signalId2) => signals[signalId1].timestamp - signals[signalId2].timestamp); // oldest entries are at the beginning

        let updates: any = {};
        for (let signalId of signalIds) {
          updates[signalId] = null;
          receivedMessage(signals[signalId]);
        }
        db().ref(path).update(updates);
      }
    );
  }
  
  function callUser() {
    targetUserId = (<HTMLInputElement>document.getElementById('targetUserId')).value;
    if (!targetUserId) {
      alert("You must enter targetUserId");
      return;
    }
    console.log("Calling targetUserId=", targetUserId);
    start(true);
  }

  let pc: any = null;
  let targetUserId: string = null;
  const configuration = {
    'iceServers': [{
      'urls': 'stun:stun.l.google.com:19302'
    }]
  };
  const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
  };
  let nav: any = navigator;
  navigator.getUserMedia = nav.getUserMedia || nav.webkitGetUserMedia || nav.mozGetUserMedia;

  function setVideoStream(isLocal: boolean, stream: any) {
    let video = <HTMLVideoElement> document.getElementById(isLocal ? 'localvideo' : 'remotevideo');
    if ('srcObject' in video) {
      video.srcObject = stream;
    } else if (window.URL) {
      video.src = window.URL.createObjectURL(stream);
    } else {
      video.src = stream;
    }
  }
  
  // Code from:
  // https://www.html5rocks.com/en/tutorials/webrtc/basics/
  function gotDescription(desc: any) {
    console.log("gotDescription: ", desc);
    pc.setLocalDescription(desc);
    sendMessage("sdp", desc);
  }
  // run start(true) to initiate a call
  function start(isCaller: boolean) {
    console.log("start: isCaller=", isCaller);
    pc = new RTCPeerConnection(configuration);

    // send any ice candidates to the other peer
    pc.onicecandidate = function (evt: any) {
      console.log("onicecandidate: ", evt);
      if (evt.candidate) {
        sendMessage("candidate", evt.candidate);
      }
    };

    // once remote stream arrives, show it in the remote video element
    pc.onaddstream = function (evt: any) {
      console.log("onaddstream: ", evt);
      setVideoStream(false, evt.stream);
    };

    // get the local stream, show it in the local video element and send it
    console.log('Requesting getUserMedia...');
    navigator.mediaDevices.getUserMedia({ "audio": true, "video": true })
    .then(
      function (stream: any) {
        console.log("getUserMedia response: ", stream);
        setVideoStream(true, stream);
        pc.addStream(stream);

        if (isCaller) {
          pc.createOffer(offerOptions).then(
            gotDescription,
            (err: any) => { console.error("Error in createOffer: ", err); }
          );
        } else {
          pc.createAnswer().then(
            gotDescription,
            (err: any) => { console.error("Error in createAnswer: ", err); }
          );
        }
        
      }, (err: any) => { console.error("Error in getUserMedia: ", err); });
  }
  
  const ONE_MINUTE_MILLIS = 60 * 1000;
  function receivedMessage(signalMsg: SignalMsg) {
    console.log("receivedMessage signalMsg=", signalMsg);
    const now = new Date().getTime();
    if (now - ONE_MINUTE_MILLIS > signalMsg.timestamp) {
      console.warn("Ignoring signal because it's more than a minute old");
      return;
    }
    if (!pc) {
      targetUserId = signalMsg.addedByUid;
      start(false);
    }

    var signalType = signalMsg.signalType
    var signalData: any = signalMsg.signalData;
    if (signalType == 'sdp') {
      pc.setRemoteDescription(new RTCSessionDescription(signalData)).then(
        () => { console.log("setRemoteDescription success"); }, 
        (err: any) => { console.error("Error in setRemoteDescription: ", err); }
      );
    } else if (signalType == 'candidate') {
      pc.addIceCandidate(new RTCIceCandidate(signalData)).then(
        () => { console.log("addIceCandidate success"); }, 
        (err: any) => { console.error("Error in addIceCandidate: ", err); }
      );
    }
  }

  init();
  document.getElementById('callUser').onclick = callUser;

}