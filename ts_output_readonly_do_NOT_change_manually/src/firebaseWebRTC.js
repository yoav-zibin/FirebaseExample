// Signalling using firebase.
// We send messages to a user by writing SignalData to
// gamePortal/gamePortalUsers/$userId/privateButAddable/signal/$signalId
// And the target user will read the signals and delete them after reading them.
var SDP1 = 'sdp1';
var SDP2 = 'sdp2';
var CANDIDATE = 'candidate';
function checkCondition(desc, cond) {
    if (!cond) {
        throw new Error('Condition check failed for: ' + desc);
    }
    return cond;
}
var videoChat;
(function (videoChat) {
    var waitingSignals = {};
    videoChat.localMediaStream = null;
    var localVideoElement;
    var opponentUserIds = [];
    var remoteVideoElements;
    var peerConnections = {};
    function updateOpponents(_myUserId, _opponentIds) {
        console.log("updateOpponents:", _myUserId, _opponentIds);
        var oldOpponentIds = opponentUserIds;
        opponentUserIds = _opponentIds.slice();
        var index = 0;
        localVideoElement = getVideoElement(index++);
        checkCondition('call getUserMedia() first', videoChat.localMediaStream);
        setVideoStream(localVideoElement, videoChat.localMediaStream);
        // Close old connections that aren't going to be reused.
        for (var _i = 0, oldOpponentIds_1 = oldOpponentIds; _i < oldOpponentIds_1.length; _i++) {
            var oldUserId = oldOpponentIds_1[_i];
            if (opponentUserIds.indexOf(oldUserId) === -1) {
                closeMyPeerConnection(oldUserId);
            }
        }
        // Create/reuse connections.
        remoteVideoElements = [];
        for (var _a = 0, opponentUserIds_1 = opponentUserIds; _a < opponentUserIds_1.length; _a++) {
            var userId = opponentUserIds_1[_a];
            var remoteVideoElement = getVideoElement(index++);
            remoteVideoElements.push(remoteVideoElement);
            var oldPeerConnection = peerConnections[userId];
            if (oldPeerConnection && oldOpponentIds.indexOf(userId) !== -1) {
                // reuse and set video stream
                var stream = oldPeerConnection.getRemoteStream();
                if (stream) {
                    receivedVideoStream(userId, stream);
                }
                else {
                    showUserName(userId);
                }
            }
            else {
                createMyPeerConnection(userId, waitingSignals[userId]);
                delete waitingSignals[userId];
            }
        }
    }
    videoChat.updateOpponents = updateOpponents;
    function restartPeerConnection(userId) {
        showUserName(userId);
        setTimeout(function () { return createMyPeerConnection(userId, []); }, 1000);
    }
    videoChat.restartPeerConnection = restartPeerConnection;
    function closeMyPeerConnection(userId) {
        if (peerConnections[userId]) {
            peerConnections[userId].close();
        }
        delete peerConnections[userId];
    }
    function createMyPeerConnection(userId, signals) {
        if (opponentUserIds.indexOf(userId) === -1) {
            console.warn("createMyPeerConnection for non-opponent", opponentUserIds, userId);
            return;
        }
        showUserName(userId);
        console.log("createMyPeerConnection targetUserId=", userId, ' signals=', signals);
        closeMyPeerConnection(userId);
        peerConnections[userId] = new MyPeerConnection(userId, signals);
    }
    function receivedVideoStream(userId, stream) {
        setVideoStream(getRemoteVideoElement(userId), stream);
    }
    videoChat.receivedVideoStream = receivedVideoStream;
    function getRemoteVideoElement(userId) {
        var index = opponentUserIds.indexOf(userId);
        checkCondition('getRemoteVideoElement', index !== -1);
        return remoteVideoElements[index];
    }
    function receivedMessage(signal) {
        var uid = signal.addedByUid;
        var existingSignals = waitingSignals[uid];
        var peerConnection = peerConnections[uid];
        var signalType = signal.signalType;
        if (peerConnection) {
            if (peerConnection.canReceiveMessage(signalType)) {
                peerConnection.receivedMessage(signal);
            }
            else {
                // We either drop the signal or create a new peerConnection
                if (signalType === SDP1) {
                    console.warn("Got SDP1, so creating new connection");
                    createMyPeerConnection(uid, [signal]);
                }
                else {
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
                }
                else {
                    existingSignals.push(signal);
                }
                break;
        }
    }
    videoChat.receivedMessage = receivedMessage;
    function getElementById(id) {
        return checkCondition('getElementById', document.getElementById(id));
    }
    videoChat.getElementById = getElementById;
    function getVideoElement(index) {
        var video = getElementById('videoElement' + index);
        var div = getElementById('videoParticipantName' + index);
        return { video: video, name: div };
    }
    function showUserName(userId) {
        setVideoOrNameVisible(getRemoteVideoElement(userId), false);
    }
    function setVideoOrNameVisible(videoName, isVideoVisible) {
        console.log(isVideoVisible ? "Showing video" : "Showing name");
        var video = videoName.video, name = videoName.name;
        video.style.display = isVideoVisible ? 'inline' : 'none';
        name.style.display = isVideoVisible ? 'none' : 'table';
    }
    function setVideoStream(videoName, stream) {
        setVideoOrNameVisible(videoName, true);
        var video = videoName.video, name = videoName.name;
        if ('srcObject' in video) {
            video.srcObject = stream;
        }
        else {
            video.src = window.URL ? window.URL.createObjectURL(stream) : stream;
        }
        if ('getVideoTracks' in stream) {
            var videoTrack = stream.getVideoTracks()[0];
            if ('getSettings' in videoTrack) {
                var settings = videoTrack.getSettings();
                if (settings.width && settings.height) {
                    var width = settings.width + "px";
                    var height = settings.height + "px";
                    setWidthHeight(video, width, height);
                    setWidthHeight(name, width, height);
                }
            }
        }
    }
    function setWidthHeight(elem, width, height) {
        var style = elem.style;
        style.width = width;
        style.height = height;
        style.minWidth = width;
        style.minHeight = height;
        style.maxWidth = width;
        style.maxHeight = height;
    }
    var _isSupported = !!window.RTCPeerConnection && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    function isSupported() {
        return _isSupported;
    }
    videoChat.isSupported = isSupported;
    function hasUserMedia() {
        return !!videoChat.localMediaStream;
    }
    videoChat.hasUserMedia = hasUserMedia;
    function getUserMedia() {
        // get the local stream, show it in the local video element and send it
        console.log('Requesting getUserMedia...');
        return navigator.mediaDevices.getUserMedia({
            "audio": true,
            "video": {
                facingMode: "user", width: 150, height: 150
            }
        })
            .then(function (stream) {
            console.log("getUserMedia response: ", stream);
            videoChat.localMediaStream = stream;
        }, function (err) {
            _isSupported = false;
            console.error("Error in getUserMedia: ", err);
        });
    }
    videoChat.getUserMedia = getUserMedia;
    videoChat.configuration = {
        'iceServers': [{
                'urls': 'stun:stun.l.google.com:19302'
            }]
    };
    if ('fetch' in window) {
        console.log('Adding xirsys turn&ice servers');
        fetch("https://global.xirsys.net/_turn/GamePortal/", {
            method: 'PUT',
            body: '',
            headers: new Headers({
                "Authorization": "Basic " + btoa("yoavzibin:ffca05a6-372c-11e8-b68d-bdfb507d2f2f")
            })
        }).then(function (res) { return res.json(); })
            .catch(function (error) { return console.error('Error:', error); })
            .then(function (response) {
            var iceServers = response.v.iceServers;
            console.log('Success:', response, "ICE List: " + iceServers);
            videoChat.configuration.iceServers = videoChat.configuration.iceServers.concat(iceServers);
        });
    }
})(videoChat || (videoChat = {}));
// See:
// https://www.html5rocks.com/en/tutorials/webrtc/basics/
var MyPeerConnection = /** @class */ (function () {
    function MyPeerConnection(targetUserId, initialSignals) {
        var _this = this;
        this.targetUserId = targetUserId;
        this.isClosed = false;
        this.remoteStream = null;
        console.log("MyPeerConnection: initialSignals=", initialSignals);
        var pc = new RTCPeerConnection(videoChat.configuration);
        this.pc = pc;
        checkCondition('localMediaStream', videoChat.localMediaStream);
        pc.addStream(videoChat.localMediaStream);
        // send any ice candidates to the other peer
        pc.onicecandidate = function (evt) {
            if (_this.isClosed) {
                console.warn("onicecandidate after close");
                return;
            }
            console.log("onicecandidate: ", evt);
            if (evt.candidate) {
                webRTC.sendMessage(_this.targetUserId, CANDIDATE, evt.candidate);
            }
        };
        // once remote stream arrives, show it in the remote video element
        var addedStream = function (stream) {
            if (_this.isClosed) {
                console.warn("onaddstream after close");
                return;
            }
            _this.remoteStream = stream;
            videoChat.receivedVideoStream(_this.targetUserId, stream);
        };
        if ('ontrack' in pc) {
            pc.ontrack = function (event) {
                console.log("ontrack: ", event);
                addedStream(event.streams[0]);
            };
        }
        else {
            pc.onaddstream = function (event) {
                console.log("onaddstream: ", event);
                if (event.stream) {
                    addedStream(event.stream);
                }
            };
        }
        var stateChangeHandler = function (connectionState) {
            if (_this.isClosed) {
                return;
            }
            if (connectionState === "failed" ||
                connectionState === "disconnected" ||
                connectionState === "closed") {
                _this.close();
                videoChat.restartPeerConnection(_this.targetUserId);
            }
        };
        pc.oniceconnectionstatechange = function (evt) {
            console.log("oniceconnectionstatechange: ", evt, " iceConnectionState=", pc.iceConnectionState, "this.isClosed=", _this.isClosed);
            stateChangeHandler(pc.iceConnectionState);
        };
        if ('onconnectionstatechange' in pc) {
            var anyPc_1 = pc;
            anyPc_1.onconnectionstatechange = function (evt) {
                console.log("onconnectionstatechange: ", evt, " connectionState=", anyPc_1.connectionState, "this.isClosed=", _this.isClosed);
                stateChangeHandler(anyPc_1.connectionState);
            };
        }
        var isCaller = !initialSignals || initialSignals.length == 0;
        this.isCaller = isCaller;
        if (isCaller) {
            pc.createOffer().then(this.gotDescription.bind(this), function (err) { console.error("Error in createOffer: ", err); });
        }
        else {
            checkCondition(SDP1, initialSignals[0].signalType == SDP1);
            // DOMException: CreateAnswer can't be called before SetRemoteDescription.
            for (var _i = 0, initialSignals_1 = initialSignals; _i < initialSignals_1.length; _i++) {
                var signal = initialSignals_1[_i];
                this.receivedMessage(signal);
            }
            pc.createAnswer().then(this.gotDescription.bind(this), function (err) { console.error("Error in createAnswer: ", err); });
        }
    }
    MyPeerConnection.prototype.didGetSdp = function () { return this.gotSdp; };
    MyPeerConnection.prototype.getIsCaller = function () { return this.isCaller; };
    MyPeerConnection.prototype.getRemoteStream = function () { return this.remoteStream; };
    MyPeerConnection.prototype.close = function () {
        this.isClosed = true;
        this.remoteStream = null;
        this.pc.close();
    };
    MyPeerConnection.prototype.gotDescription = function (desc) {
        console.log("gotDescription: ", desc);
        this.pc.setLocalDescription(desc).then(function () { console.log("setLocalDescription success"); }, function (err) { console.error("Error in setLocalDescription: ", err); });
        webRTC.sendMessage(this.targetUserId, this.isCaller ? SDP1 : SDP2, desc);
    };
    MyPeerConnection.prototype.canReceiveMessage = function (signalType) {
        switch (signalType) {
            case SDP2:
            case SDP1:
                return !this.gotSdp && (signalType === (this.isCaller ? SDP2 : SDP1));
            case CANDIDATE:
                return this.gotSdp;
        }
    };
    MyPeerConnection.prototype.receivedMessage = function (signalMsg) {
        console.log("receivedMessage signalMsg=", signalMsg);
        var signalType = signalMsg.signalType;
        checkCondition('canReceiveMessage', this.canReceiveMessage(signalType));
        var signalData = JSON.parse(signalMsg.signalData);
        switch (signalType) {
            case SDP2:
            case SDP1:
                this.gotSdp = true;
                this.pc.setRemoteDescription(new RTCSessionDescription(signalData)).then(function () { console.log("setRemoteDescription success"); }, function (err) { console.error("Error in setRemoteDescription: ", err); });
                break;
            case CANDIDATE:
                this.pc.addIceCandidate(new RTCIceCandidate(signalData)).then(function () { console.log("addIceCandidate success"); }, function (err) { console.error("Error in addIceCandidate: ", err); });
                break;
        }
    };
    return MyPeerConnection;
}());
var webRTC;
(function (webRTC) {
    function db() { return firebase.database(); }
    function prettyJson(obj) {
        return JSON.stringify(obj, null, '  ');
    }
    function dbSet(ref, writeVal) {
        var writeValJson = prettyJson(writeVal);
        console.log("Writing path=", ref.toString(), " writeVal=", writeValJson, "...");
        ref.set(writeVal);
    }
    var uid = '';
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
    function sendMessage(targetUserId, signalType, signalData) {
        if (!targetUserId)
            throw new Error("Missing targetUserId");
        var ref = db().ref("/gamePortal/gamePortalUsers/" + targetUserId + "/privateButAddable/signals").push();
        var signalMsg = {
            addedByUid: uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            signalData: JSON.stringify(signalData),
            signalType: signalType,
        };
        dbSet(ref, signalMsg);
        ref.onDisconnect().remove();
    }
    webRTC.sendMessage = sendMessage;
    function listenToMessages() {
        var path = "/gamePortal/gamePortalUsers/" + uid + "/privateButAddable/signals";
        db().ref(path).on('value', function (snap) {
            var signals = snap.val();
            console.log("Got signals=", signals);
            if (!signals)
                return;
            var signalIds = Object.keys(signals);
            signalIds.sort(function (signalId1, signalId2) { return signals[signalId1].timestamp - signals[signalId2].timestamp; }); // oldest entries are at the beginning
            var updates = {};
            for (var _i = 0, signalIds_1 = signalIds; _i < signalIds_1.length; _i++) {
                var signalId = signalIds_1[_i];
                updates[signalId] = null;
                var signal = signals[signalId];
                videoChat.receivedMessage(signal);
            }
            db().ref(path).update(updates);
        });
    }
    function updateParticipantsUserIds() {
        var participantsUserIds = videoChat.getElementById('participantsUserIds').value;
        if (!participantsUserIds || participantsUserIds.indexOf(uid) == -1) {
            alert("You must enter participantsUserIds, that includes myUserId");
            return;
        }
        var _participantsUserIds = participantsUserIds.split(",").map(function (s) { return s.trim(); });
        var opponentUserIds = _participantsUserIds.slice();
        var myIndex = _participantsUserIds.indexOf(uid);
        opponentUserIds.splice(myIndex, 1);
        videoChat.updateOpponents(uid, opponentUserIds);
    }
    uid = window.location.search ? window.location.search.substr(1) : '' + Math.floor(Math.random() * 10);
    videoChat.getElementById('myUserId').value = uid;
    init();
    videoChat.getUserMedia();
    videoChat.getElementById('updateParticipantsUserIds').onclick = updateParticipantsUserIds;
})(webRTC || (webRTC = {}));
//# sourceMappingURL=firebaseWebRTC.js.map