
// Signalling using firebase.
// We send messages to a user by writing SignalData to
// gamePortal/gamePortalUsers/$userId/privateButAddable/signal/$signalId
// And the target user will read the signals and delete them after reading them.
const SDP1 = 'sdp1';
const SDP2 = 'sdp2';
const CANDIDATE = 'candidate';
type SignalType = typeof SDP1 | typeof SDP2 | typeof CANDIDATE;
interface SignalMsg {
  addedByUid: string;
  timestamp: any;
  signalType: SignalType;
  signalData: string;
}

function checkCondition(desc: string, cond: any) {
  if (!cond) {
    throw new Error('Condition check failed for: ' + desc);
  }
  return cond;
}

interface VideoNameElement {
  video: HTMLVideoElement;
  name: HTMLDivElement;
}

module videoChat {
  
  interface UserIdToSignals {
    [userId: string]: SignalMsg[];
  }
  interface UserIdToPeerConnection {
    [userId: string]: MyPeerConnection;
  }
  const waitingSignals: UserIdToSignals = {};

  export let localMediaStream: any = null;
  let localVideoElement: VideoNameElement;

  let opponentUserIds: string[];
  let remoteVideoElements: VideoNameElement[];

  const peerConnections: UserIdToPeerConnection = {};

  let nav: any = navigator;
  navigator.getUserMedia = nav.getUserMedia || nav.webkitGetUserMedia || nav.mozGetUserMedia;

  export function updateOpponents(_myUserId: string, _opponentIds: string[]) {
    console.log("updateOpponents:", _myUserId, _opponentIds);
    checkCondition('call getUserMedia() first', localMediaStream);
    checkCondition("TODO: handle multiple calls!", !opponentUserIds);
    opponentUserIds = _opponentIds.slice();
    let index = 0;
    localVideoElement = getVideoElement(index++);
    setVideoStream(localVideoElement, localMediaStream);
    // TODO: add user names until video shows up
    remoteVideoElements = [];
    for (let userId of opponentUserIds) {
      const remoteVideoElement = getVideoElement(index++);
      remoteVideoElements.push(remoteVideoElement);
      createMyPeerConnection(userId, waitingSignals[userId]);
      delete waitingSignals[userId];
    }
  }

  export function restartPeerConnection(userId: string) {
    createMyPeerConnection(userId, []);
  }

  function createMyPeerConnection(userId: string, signals: SignalMsg[]) {
    console.log("createMyPeerConnection targetUserId=", userId, ' signals=', signals);
    if (peerConnections[userId]) {
      peerConnections[userId].close();
    }
    peerConnections[userId] = new MyPeerConnection(userId, signals);
  }

  export function receivedVideoStream(userId: string, stream: any) {
    setVideoStream(remoteVideoElements[opponentUserIds.indexOf(userId)], stream);
  }

  export function receivedMessage(signal: SignalMsg) {
    const uid = signal.addedByUid;
    const existingSignals = waitingSignals[uid];
    const peerConnection = peerConnections[uid];
    const signalType: SignalType = signal.signalType;
    if (peerConnection) {
      if (peerConnection.canReceiveMessage(signalType)) {
        peerConnection.receivedMessage(signal);
      } else {
        // We either drop the signal or create a new peerConnection
        if (signalType === SDP1) {
          console.warn("Got SDP1, so creating new connection");
          createMyPeerConnection(uid, [signal]);
        } else {
          console.warn("Dropping signal", signal);
        }
      }
      return;
    }

    switch (signalType) {
      case SDP2:
        console.warn("Throwing away SDP2:", signal);
        break;
      case SDP1:
        if (existingSignals) {
          console.warn("Throwing away signals=", existingSignals);
        }
        waitingSignals[uid] = [signal];
        break;
      case CANDIDATE:
        if (!existingSignals) {
          console.warn("Throwing away candidate:", signal);
        } else {
          existingSignals.push(signal);
        }
        break;
    }
  }

  export function getElementById(id: string): HTMLElement {
    return checkCondition('getElementById', document.getElementById(id)!);
  }
  function getVideoElement(index: number): VideoNameElement {
    const video = <HTMLVideoElement> getElementById('videoElement' + index);
    const div = <HTMLDivElement> getElementById('videoParticipantName' + index);
    return {video: video, name: div};
  }

  function setVideoStream(videoName: VideoNameElement, stream: any) {
    const {video, name} = videoName;
    video.style.display = 'inline';
    name.style.display = 'none';
    if ('srcObject' in video) {
      video.srcObject = stream;
    } else {
      (<any>video).src = window.URL ? window.URL.createObjectURL(stream) : stream;
    }
    if ('getVideoTracks' in stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if ('getSettings' in videoTrack) {
        const settings = videoTrack.getSettings();
        if (settings.width && settings.height) {
          const width = settings.width + "px";
          const height = settings.height + "px";
          setWidthHeight(video, width, height);
          setWidthHeight(name, width, height);
        }
      }
    }
  }

  function setWidthHeight(elem: HTMLElement, width: string, height: string) {
    const style = elem.style;
    style.width = width;
    style.height = height;
    style.minWidth = width;
    style.minHeight = height;
    style.maxWidth = width;
    style.maxHeight = height;
  }
  
  export function getUserMedia() {
    // get the local stream, show it in the local video element and send it
    console.log('Requesting getUserMedia...');
    return navigator.mediaDevices.getUserMedia({
        "audio": true, 
        "video": {
          facingMode: "user", width: 150, height: 150
        } 
      })
      .then(
        (stream: any) => {
          console.log("getUserMedia response: ", stream);
          localMediaStream = stream;   
        }, (err: any) => { console.error("Error in getUserMedia: ", err); });
  }
}


// See:
// https://www.html5rocks.com/en/tutorials/webrtc/basics/
class MyPeerConnection {
  private isCaller: boolean;
  private gotSdp: boolean;
  private isClosed: boolean = false;
  private pc: RTCPeerConnection;
  constructor(
    public targetUserId: string,
    initialSignals: SignalMsg[]) {
    
    console.log("MyPeerConnection: initialSignals=", initialSignals);
    const pc = new RTCPeerConnection(MyPeerConnection.configuration);
    this.pc = pc;
    checkCondition('localMediaStream', videoChat.localMediaStream);
    pc.addStream(videoChat.localMediaStream);
    
    // send any ice candidates to the other peer
    pc.onicecandidate = (evt: any) => {
      if (this.isClosed) {
        console.warn("onicecandidate after close");
        return;
      }
      console.log("onicecandidate: ", evt);
      if (evt.candidate) {
        webRTC.sendMessage(this.targetUserId, CANDIDATE, evt.candidate);
      }
    };

    // once remote stream arrives, show it in the remote video element
    pc.onaddstream = (evt: any) => {
      if (this.isClosed) {
        console.warn("onaddstream after close");
        return;
      }
      console.log("onaddstream: ", evt);
      videoChat.receivedVideoStream(this.targetUserId, evt.stream);
    };

    const stateChangeHandler = (connectionState: string) => {
      if (this.isClosed) {
        return;
      }
      if (connectionState === "failed" ||
          connectionState === "disconnected" ||
          connectionState === "closed") {
        this.close();
        setTimeout(() => videoChat.restartPeerConnection(this.targetUserId), 1000);
      }
    };
    pc.oniceconnectionstatechange = (evt: any) => {
      console.log("oniceconnectionstatechange: ", evt, " iceConnectionState=", pc.iceConnectionState, "this.isClosed=", this.isClosed);
      stateChangeHandler(pc.iceConnectionState);
    };
    if ('onconnectionstatechange' in pc) {
      const anyPc = <any>pc;
      anyPc.onconnectionstatechange = (evt: any) => {
        console.log("onconnectionstatechange: ", evt, " connectionState=", anyPc.connectionState, "this.isClosed=", this.isClosed);
        stateChangeHandler(anyPc.connectionState);
      };
    }
  
    const isCaller = !initialSignals || initialSignals.length == 0;
    this.isCaller = isCaller;
    if (isCaller) {
      pc.createOffer().then(
        this.gotDescription.bind(this),
        (err: any) => { console.error("Error in createOffer: ", err); }
      );
    } else {
      checkCondition(SDP1, initialSignals[0].signalType == SDP1);
      // DOMException: CreateAnswer can't be called before SetRemoteDescription.
      for (let signal of initialSignals) {
        this.receivedMessage(signal);
      }
      pc.createAnswer().then(
        this.gotDescription.bind(this),
        (err: any) => { console.error("Error in createAnswer: ", err); }
      );
    }
  }

  didGetSdp() { return this.gotSdp; }
  getIsCaller() { return this.isCaller; }
  close() {
    this.isClosed = true;
    this.pc.close();
  }

  static configuration = {
    'iceServers': [{
      'urls': 'stun:stun.l.google.com:19302'
    }]
  };
  
  gotDescription(desc: any) {
    console.log("gotDescription: ", desc);
    this.pc.setLocalDescription(desc).then(
      () => { console.log("setLocalDescription success"); }, 
      (err: any) => { console.error("Error in setLocalDescription: ", err); }
    );
    webRTC.sendMessage(this.targetUserId, this.isCaller ? SDP1 : SDP2, desc);
  }

  canReceiveMessage(signalType: SignalType) {
    switch (signalType) {
      case SDP2:
      case SDP1:
        return !this.gotSdp && (signalType === (this.isCaller ? SDP2 : SDP1));
      case CANDIDATE:
        return this.gotSdp;
    }
  }
  receivedMessage(signalMsg: SignalMsg) {
    console.log("receivedMessage signalMsg=", signalMsg);
    const signalType: SignalType = signalMsg.signalType;
    checkCondition('canReceiveMessage', this.canReceiveMessage(signalType));
    const signalData: any = JSON.parse(signalMsg.signalData);
    switch (signalType) {
      case SDP2:
      case SDP1:
        this.gotSdp = true;
        this.pc.setRemoteDescription(new RTCSessionDescription(signalData)).then(
          () => { console.log("setRemoteDescription success"); }, 
          (err: any) => { console.error("Error in setRemoteDescription: ", err); }
        );
        break;
      case CANDIDATE:
        this.pc.addIceCandidate(new RTCIceCandidate(signalData)).then(
          () => { console.log("addIceCandidate success"); }, 
          (err: any) => { console.error("Error in addIceCandidate: ", err); }
        );
        break;
    }
  }
}


module webRTC {
  function db() { return firebase.database(); }

  function prettyJson(obj: any): string {
    return JSON.stringify(obj, null, '  ');
  }

  function dbSet(ref: any, writeVal: any) {
    let writeValJson = prettyJson(writeVal);
    console.log(`Writing path=`, ref.toString(), ` writeVal=`, writeValJson, `...`);
    ref.set(writeVal);
  }

  
  let uid: string = '';
  function firebaseLogin() {
    console.info("My uid=", uid);
    listenToMessages();
  }

  function init() {
    // Initialize Firebase
    var config = {
      apiKey: "AIzaSyAeYnutBmwwKSh6s7wlPMopGcslYS4ZlW8",
      authDomain: "webrtc-5f627.firebaseapp.com",
      databaseURL: "https://webrtc-5f627.firebaseio.com",
      projectId: "webrtc-5f627",
      storageBucket: "",
      messagingSenderId: "860429001771"
    };
    firebase.initializeApp(config);
    firebaseLogin();
  }
  
  export function sendMessage(targetUserId: string, signalType: SignalType, signalData: any) {
    if (!targetUserId) throw new Error("Missing targetUserId");
    let ref = db().ref(`/gamePortal/gamePortalUsers/${targetUserId}/privateButAddable/signals`).push();
    let signalMsg: SignalMsg = {
      addedByUid: uid,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      signalData: JSON.stringify(signalData),
      signalType: signalType,
    };
    dbSet(ref, signalMsg);
    ref.onDisconnect().remove();
  }

  function listenToMessages() {
    let path = `/gamePortal/gamePortalUsers/${uid}/privateButAddable/signals`;
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
          videoChat.receivedMessage(signal);
        }
        db().ref(path).update(updates);
      }
    );
  }
  
  function updateParticipantsUserIds() { 
    let participantsUserIds: string = (<HTMLInputElement>videoChat.getElementById('participantsUserIds')).value;
    if (!participantsUserIds || participantsUserIds.indexOf(uid) == -1) {
      alert("You must enter participantsUserIds, that includes myUserId");
      return;
    }
    const _participantsUserIds = participantsUserIds.split(",").map(s => s.trim());
    const opponentUserIds = _participantsUserIds.slice();
    const myIndex = _participantsUserIds.indexOf(uid);
    opponentUserIds.splice(myIndex, 1);
    videoChat.updateOpponents(uid, opponentUserIds);
  }

  
  uid = window.location.search ? window.location.search.substr(1) : ''+Math.floor(Math.random()*10);
  (<HTMLInputElement>videoChat.getElementById('myUserId')).value = uid;
  init();
  videoChat.getUserMedia();
  videoChat.getElementById('updateParticipantsUserIds').onclick = updateParticipantsUserIds;

}
