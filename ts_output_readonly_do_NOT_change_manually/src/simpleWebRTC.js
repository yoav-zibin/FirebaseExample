var configuration = {
    'iceServers': [{
            'urls': 'stun:stun.l.google.com:19302'
        }]
};
var pc1 = new RTCPeerConnection(configuration);
var pc2 = new RTCPeerConnection(configuration);
var localStream;
console.log('Requesting getUserMedia...');
navigator.mediaDevices.getUserMedia({
    "audio": true,
    "video": {
        facingMode: "user", width: 150, height: 150
    }
})
    .then(function (_localStream) {
    localStream = _localStream;
    console.log("getUserMedia response: ", localStream);
    setVideoStream('localVideo', localStream);
    createPCs(localStream);
});
function setVideoStream(videoId, stream) {
    var video = document.getElementById(videoId);
    video.srcObject = stream;
}
function createPCs(localStream) {
    pc1.addStream(localStream);
    pc1.onicecandidate = function (evt) { return onicecandidate(pc2, evt); };
    pc2.onicecandidate = function (evt) { return onicecandidate(pc1, evt); };
    pc1.onaddstream = function (evt) { return onaddstream(pc1, evt); };
    pc2.onaddstream = function (evt) { return onaddstream(pc2, evt); };
    pc1.createOffer().then(function (desc) { return gotDescription(true, pc1, pc2, desc); });
}
function onicecandidate(targetPC, evt) {
    console.log("onicecandidate: ", evt);
    if (evt.candidate) {
        targetPC.addIceCandidate(new RTCIceCandidate(evt.candidate)).then(function () { console.log("addIceCandidate success"); }, function (err) { console.error("Error in addIceCandidate: ", err); });
    }
}
function onaddstream(myPC, evt) {
    console.log("onaddstream: ", evt);
    if (evt.stream) {
        if (myPC == pc1)
            throw new Error("Internal bug");
        setVideoStream('pcVideo', evt.stream);
    }
}
function gotDescription(isOffer, myPC, targetPC, desc) {
    console.log("gotDescription: ", desc);
    myPC.setLocalDescription(desc).then(function () { console.log("setLocalDescription success"); }, function (err) { console.error("Error in setLocalDescription: ", err); });
    targetPC.setRemoteDescription(new RTCSessionDescription(desc)).then(function () { console.log("setRemoteDescription success"); }, function (err) { console.error("Error in setRemoteDescription: ", err); });
    if (isOffer) {
        targetPC.createAnswer().then(function (desc) { return gotDescription(false, pc2, pc1, desc); });
    }
}
//# sourceMappingURL=simpleWebRTC.js.map