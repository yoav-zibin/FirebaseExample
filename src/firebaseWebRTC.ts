
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
    uid = 'uid' + Math.floor(100000 * Math.random());
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
    writeUserIfNeeded();
  }

  function init() {
    // Initialize Firebase
    var config = {
      apiKey: "AIzaSyC2p0MXPE-yIQjnNztbxlK2on7EAMnBO54",
      authDomain: "mytest-a0c11.firebaseapp.com",
      databaseURL: "https://mytest-a0c11.firebaseio.com",
      projectId: "mytest-a0c11",
      storageBucket: "mytest-a0c11.appspot.com",
      messagingSenderId: "212624241094"
    };
    firebase.initializeApp(config);
    firebaseLogin();
  }
  
  export function sendMessage(targetUserId: string, signalType: string, signalData: any) {
    if (!targetUserId) throw new Error("Missing targetUserId");
    let ref = db().ref(`users/${targetUserId}/privateButAddable/signal`).push();
    let signalMsg: SignalMsg = {
      addedByUid: uid,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      signalData: JSON.stringify(signalData),
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
          let signal:SignalMsg = signals[signalId];
          
          let foundPeer = false;
          for (let peerConnection of peerConnections) {
            if (peerConnection.targetUserId === signal.addedByUid) {
              peerConnection.receivedMessage(signal);
              foundPeer = true;
              break;
            }
          }
          if (!foundPeer) {
            createMyPeerConnection(signal.addedByUid, false);
          }
        }
        db().ref(path).update(updates);
      }
    );
  }
  
  function callUser() { 
    let targetUserId: string = (<HTMLInputElement>document.getElementById('targetUserId')).value;
    if (!targetUserId) {
      alert("You must enter targetUserId");
      return;
    }
    createMyPeerConnection(targetUserId, true);
  }

  function createMyPeerConnection(targetUserId: string, isCaller: boolean) {
    console.log("createMyPeerConnection targetUserId=", targetUserId, ' isCaller=', isCaller);
    let index = peerConnections.length;
    let video = getVideoElement('remotevideo' + index);
    let peer: MyPeerConnection = new MyPeerConnection(targetUserId, video);
    peerConnections.push(peer);
    peer.start(isCaller);
  }

  export let localMediaStream: any = null;
  let peerConnections: MyPeerConnection[] = [];
  let nav: any = navigator;
  navigator.getUserMedia = nav.getUserMedia || nav.webkitGetUserMedia || nav.mozGetUserMedia;


  function getVideoElement(id: string) {
    return <HTMLVideoElement> document.getElementById(id);
  }

  export function setVideoStream(video: any, stream: any) {
    if ('srcObject' in video) {
      video.srcObject = stream;
    } else if (window.URL) {
      video.src = window.URL.createObjectURL(stream);
    } else {
      video.src = stream;
    }
  }
  
  function getUserMedia() {
    // get the local stream, show it in the local video element and send it
    console.log('Requesting getUserMedia...');
    navigator.mediaDevices.getUserMedia({ "audio": true, "video": true })
    .then(
      (stream: any) => {
        console.log("getUserMedia response: ", stream);
        setVideoStream(getVideoElement('localvideo'), stream);
        localMediaStream = stream;   
      }, (err: any) => { console.error("Error in getUserMedia: ", err); });
  }


  init();
  getUserMedia();
  document.getElementById('callUser').onclick = callUser;

}


class MyPeerConnection {
  pc: any = null;
  constructor(public targetUserId: string, public remoteVideoElement: HTMLVideoElement) {}

  static configuration = {
    'iceServers': [{
      'urls': 'stun:stun.l.google.com:19302'
    }]
  };
  static offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
  };
  
  // Code from:
  // https://www.html5rocks.com/en/tutorials/webrtc/basics/
  gotDescription(desc: any) {
    console.log("gotDescription: ", desc);
    this.pc.setLocalDescription(desc);
    webRTC.sendMessage(this.targetUserId, "sdp", desc);
  }

  // run start(true) to initiate a call
  //let count: number = 1;
  start(isCaller: boolean) {
    console.log("start: isCaller=", isCaller);
    this.pc = new RTCPeerConnection(MyPeerConnection.configuration);

    // send any ice candidates to the other peer
    this.pc.onicecandidate = (evt: any) => {
      console.log("onicecandidate: ", evt);
      if (evt.candidate) {
        webRTC.sendMessage(this.targetUserId, "candidate", evt.candidate);
      }
    };

    // once remote stream arrives, show it in the remote video element
    this.pc.onaddstream = (evt: any) => {
      console.log("onaddstream: ", evt);
      webRTC.setVideoStream(this.remoteVideoElement, evt.stream);
    };

    
    if (isCaller) {
      this.pc.createOffer(MyPeerConnection.offerOptions).then(
        this.gotDescription.bind(this),
        (err: any) => { console.error("Error in createOffer: ", err); }
      );
    } else {
      this.pc.createAnswer().then(
        this.gotDescription.bind(this),
        (err: any) => { console.error("Error in createAnswer: ", err); }
      );
    }
    this.pc.addStream(webRTC.localMediaStream);
  }
  
  //const ONE_MINUTE_MILLIS = 60 * 1000;
   receivedMessage(signalMsg: SignalMsg) {
    console.log("receivedMessage signalMsg=", signalMsg);
    const now = new Date().getTime();
    if (now - /*ONE_MINUTE_MILLIS*/60 * 1000 > signalMsg.timestamp) {
      console.warn("Ignoring signal because it's more than a minute old");
      return;
    }
    if (!this.pc) {
      this.targetUserId = signalMsg.addedByUid;
      this.start(false);
    }

    let signalType = signalMsg.signalType
    let signalData: any = JSON.parse(signalMsg.signalData);
    if (signalType == "sdp") {
      this.pc.setRemoteDescription(new RTCSessionDescription(signalData)).then(
        () => { console.log("setRemoteDescription success"); }, 
        (err: any) => { console.error("Error in setRemoteDescription: ", err); }
      );
    } else if (signalType == "candidate") {
      this.pc.addIceCandidate(new RTCIceCandidate(signalData)).then(
        () => { console.log("addIceCandidate success"); }, 
        (err: any) => { console.error("Error in addIceCandidate: ", err); }
      );
    }
  }
}