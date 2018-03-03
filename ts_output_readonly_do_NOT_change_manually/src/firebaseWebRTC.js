var webRTC;
(function (webRTC) {
    function db() { return firebase.database(); }
    function messaging() { return firebase.messaging(); }
    function prettyJson(obj) {
        return JSON.stringify(obj, null, '  ');
    }
    function dbSet(ref, writeVal) {
        let writeValJson = prettyJson(writeVal);
        console.log(`Writing path=`, ref.toString(), ` writeVal=`, writeValJson, `...`);
        ref.set(writeVal);
    }
    let uid = null;
    function writeUser() {
        let myUserPath = `/gamePortal/gamePortalUsers/${uid}`;
        dbSet(db().ref(myUserPath), {
            publicFields: {
                isConnected: true,
                lastSeen: firebase.database.ServerValue.TIMESTAMP,
                supportsWebRTC: true,
            },
            privateFields: {
                createdOn: firebase.database.ServerValue.TIMESTAMP,
                phoneNumber: ``,
                countryCode: ``,
            },
        });
    }
    function writeUserIfNeeded() {
        uid = 'uid' + Math.floor(100000 * Math.random());
        console.info("My uid=", uid);
        listenToMessages();
        document.getElementById('myUserId').value = uid;
        let myUserPath = `/gamePortal/gamePortalUsers/${uid}`;
        db().ref(myUserPath).once('value').then((snap) => {
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
            apiKey: 'AIzaSyDA5tCzxNzykHgaSv1640GanShQze3UK-M',
            authDomain: 'universalgamemaker.firebaseapp.com',
            databaseURL: 'https://universalgamemaker.firebaseio.com',
            projectId: 'universalgamemaker',
            storageBucket: 'universalgamemaker.appspot.com',
            messagingSenderId: '144595629077'
        };
        firebase.initializeApp(config);
        firebaseLogin();
    }
    function sendMessage(targetUserId, signalType, signalData) {
        if (!targetUserId)
            throw new Error("Missing targetUserId");
        let ref = db().ref(`/gamePortal/gamePortalUsers/${targetUserId}/privateButAddable/signals`).push();
        let signalMsg = {
            addedByUid: uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            signalData: JSON.stringify(signalData),
            signalType: signalType,
        };
        dbSet(ref, signalMsg);
    }
    webRTC.sendMessage = sendMessage;
    function listenToMessages() {
        let path = `/gamePortal/gamePortalUsers/${uid}/privateButAddable/signals`;
        db().ref(path).on('value', (snap) => {
            let signals = snap.val();
            console.log("Got signals=", signals);
            if (!signals)
                return;
            let signalIds = Object.keys(signals);
            signalIds.sort((signalId1, signalId2) => signals[signalId1].timestamp - signals[signalId2].timestamp); // oldest entries are at the beginning
            let updates = {};
            const now = new Date().getTime();
            for (let signalId of signalIds) {
                updates[signalId] = null;
                let signal = signals[signalId];
                if (now - /*ONE_MINUTE_MILLIS*/ 60 * 1000 > signal.timestamp) {
                    console.warn("Ignoring signal because it's more than a minute old");
                    continue;
                }
                let peer = null;
                for (let peerConnection of peerConnections) {
                    if (peerConnection.targetUserId === signal.addedByUid) {
                        peer = peerConnection;
                        break;
                    }
                }
                if (!peer) {
                    peer = createMyPeerConnection(signal.addedByUid, false);
                }
                peer.receivedMessage(signal);
            }
            db().ref(path).update(updates);
        });
    }
    function callUser() {
        let targetUserId = document.getElementById('targetUserId').value;
        if (!targetUserId) {
            alert("You must enter targetUserId");
            return;
        }
        createMyPeerConnection(targetUserId, true);
    }
    function createMyPeerConnection(targetUserId, isCaller) {
        console.log("createMyPeerConnection targetUserId=", targetUserId, ' isCaller=', isCaller);
        let index = peerConnections.length;
        let video = getVideoElement('remotevideo' + index);
        let peer = new MyPeerConnection(targetUserId, video);
        peerConnections.push(peer);
        peer.start(isCaller);
        return peer;
    }
    webRTC.localMediaStream = null;
    let peerConnections = [];
    let nav = navigator;
    navigator.getUserMedia = nav.getUserMedia || nav.webkitGetUserMedia || nav.mozGetUserMedia;
    function getVideoElement(id) {
        return document.getElementById(id);
    }
    function setVideoStream(video, stream) {
        if ('srcObject' in video) {
            video.srcObject = stream;
        }
        else if (window.URL) {
            video.src = window.URL.createObjectURL(stream);
        }
        else {
            video.src = stream;
        }
    }
    webRTC.setVideoStream = setVideoStream;
    function getUserMedia() {
        // get the local stream, show it in the local video element and send it
        console.log('Requesting getUserMedia...');
        navigator.mediaDevices.getUserMedia({ "audio": true, "video": true })
            .then((stream) => {
            console.log("getUserMedia response: ", stream);
            setVideoStream(getVideoElement('localvideo'), stream);
            webRTC.localMediaStream = stream;
        }, (err) => { console.error("Error in getUserMedia: ", err); });
    }
    init();
    getUserMedia();
    document.getElementById('callUser').onclick = callUser;
})(webRTC || (webRTC = {}));
class MyPeerConnection {
    constructor(targetUserId, remoteVideoElement) {
        this.targetUserId = targetUserId;
        this.remoteVideoElement = remoteVideoElement;
        this.pc = null;
        this.needCreateAnswer = false;
    }
    // Code from:
    // https://www.html5rocks.com/en/tutorials/webrtc/basics/
    gotDescription(desc) {
        console.log("gotDescription: ", desc);
        this.pc.setLocalDescription(desc);
        webRTC.sendMessage(this.targetUserId, "sdp", desc);
    }
    // run start(true) to initiate a call
    //let count: number = 1;
    start(isCaller) {
        console.log("start: isCaller=", isCaller);
        this.pc = new RTCPeerConnection(MyPeerConnection.configuration);
        // send any ice candidates to the other peer
        this.pc.onicecandidate = (evt) => {
            console.log("onicecandidate: ", evt);
            if (evt.candidate) {
                webRTC.sendMessage(this.targetUserId, "candidate", evt.candidate);
            }
        };
        // once remote stream arrives, show it in the remote video element
        this.pc.onaddstream = (evt) => {
            console.log("onaddstream: ", evt);
            webRTC.setVideoStream(this.remoteVideoElement, evt.stream);
        };
        if (isCaller) {
            this.pc.createOffer(MyPeerConnection.offerOptions).then(this.gotDescription.bind(this), (err) => { console.error("Error in createOffer: ", err); });
        }
        else {
            // createAnswer can only be called after setRemoteDescription:
            // Error in createAnswer:  DOMException: CreateAnswer can't be called before SetRemoteDescription.
            this.needCreateAnswer = true;
        }
        this.pc.addStream(webRTC.localMediaStream);
    }
    //const ONE_MINUTE_MILLIS = 60 * 1000;
    receivedMessage(signalMsg) {
        console.log("receivedMessage signalMsg=", signalMsg);
        let signalType = signalMsg.signalType;
        let signalData = JSON.parse(signalMsg.signalData);
        if (signalType == "sdp") {
            this.pc.setRemoteDescription(new RTCSessionDescription(signalData)).then(() => { console.log("setRemoteDescription success"); }, (err) => { console.error("Error in setRemoteDescription: ", err); });
            if (this.needCreateAnswer) {
                this.pc.createAnswer().then(this.gotDescription.bind(this), (err) => { console.error("Error in createAnswer: ", err); });
            }
        }
        else if (signalType == "candidate") {
            this.pc.addIceCandidate(new RTCIceCandidate(signalData)).then(() => { console.log("addIceCandidate success"); }, (err) => { console.error("Error in addIceCandidate: ", err); });
        }
    }
}
MyPeerConnection.configuration = {
    'iceServers': [{
            'urls': 'stun:stun.l.google.com:19302'
        }]
};
MyPeerConnection.offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
};
//# sourceMappingURL=firebaseWebRTC.js.map