var main;
(function (main) {
    var uid = "";
    var commands = [];
    function db() { return firebase.database(); }
    function canRead(path) {
        commands.push({ type: "r", path: path, shouldSucceed: true });
    }
    function cannotRead(path) {
        commands.push({ type: "r", path: path, shouldSucceed: false });
    }
    function write(path, val) {
        commands.push({ type: "w", path: path, shouldSucceed: true, writeVal: val });
    }
    function cannotWrite(path, val) {
        commands.push({ type: "w", path: path, shouldSucceed: false, writeVal: val });
    }
    function executeCommands() {
        if (commands.length == 0) {
            console.log("Finished test successfully :)");
            return;
        }
        var command = commands.shift();
        var path = command.path;
        var shouldSucceed = command.shouldSucceed;
        var writeVal = command.writeVal;
        if (command.type == "r") {
            db().ref(path).once('value', function (snap) {
                // successCallback
                if (!shouldSucceed) {
                    console.error("We managed to read path=", path, " but we should have failed!");
                }
                else {
                    console.log("Reading path=", path, " returned ", snap.val());
                    executeCommands();
                }
            }, function (err) {
                if (shouldSucceed) {
                    console.error("We failed to read path=", path, " but we should have succeeded!");
                }
                else {
                    console.log("Reading path=", path, " failed as expected with err=", err);
                    executeCommands();
                }
            });
        }
        else {
            db().ref(path).set(writeVal, function (err) {
                // on complete
                if (!err) {
                    if (!shouldSucceed) {
                        console.error("We managed to write path=", path, " writeVal=", writeVal, " but we should have failed!");
                    }
                    else {
                        console.log("Writing path=", path, " writeVal=", writeVal, " succeeded.");
                        executeCommands();
                    }
                }
                else {
                    if (shouldSucceed) {
                        console.error("We failed to write path=", path, " writeVal=", writeVal, " but we should have succeeded! err=", err);
                    }
                    else {
                        console.log("Writing path=", path, " writeVal=", writeVal, " failed as expected with err=", err);
                        executeCommands();
                    }
                }
            });
        }
    }
    function runDbTest() {
        uid = firebase.auth().currentUser.uid;
        canRead("/images/123");
        cannotWrite("/images/123", 42);
        write("/images/123", {
            "downloadURL": "https://blabla.com",
            "width": 1024,
            "height": 10,
            "is_board_image": true,
            "key": "abc",
            "name": "whatever",
            "uploader_email": "yoav@goo.bar",
            "uploader_uid": uid,
            "createdOn": firebase.database.ServerValue.TIMESTAMP,
        });
        write("/images/123/downloadURL", "https://blabla.com/sdfsdf");
        cannotWrite("/images/123/downloadURL", "http://blabla.com/sdfsdf");
        cannotWrite("/images/123/width", "123");
        cannotWrite("/images/123/width", 1025);
        cannotWrite("/images/123/height", 2);
        cannotWrite("/images/123/is_board_image", 2);
        cannotWrite("/images/123/uploader_email", "not_email@");
        cannotWrite("/images/123/uploader_uid", "not_email");
        // Reading another user's data.
        canRead("/users/123/publicFields");
        cannotRead("/users/123/privateFields");
        cannotRead("/users/123/privateButAddable");
        cannotRead("/users/123");
        cannotWrite("/users/123/publicFields/isConnected", true);
        write("/users/" + uid, {
            "publicFields": {
                "avatarImageUrl": "https://foo.bar/avatar",
                "displayName": "Yoav Ziii",
                "isConnected": true,
                "lastSeen": firebase.database.ServerValue.TIMESTAMP,
            },
            "privateFields": {
                "email": "yoav.zibin@yooo.goo",
                "createdOn": firebase.database.ServerValue.TIMESTAMP,
            },
        });
        write("/users/" + uid + "/publicFields/displayName", "New name!");
        write("/users/" + uid + "/privateButAddable/chats/4242", {
            "addedByUid": uid,
            "timestamp": firebase.database.ServerValue.TIMESTAMP,
        });
        cannotWrite("/users/" + uid + "/privateButAddable/chats/4243", {
            "addedByUid": uid,
        });
        cannotWrite("/users/" + uid + "/privateButAddable/chats/4243", {
            "timestamp": firebase.database.ServerValue.TIMESTAMP,
        });
        write("/recentlyConnected/123", {
            "uid": uid,
            "timestamp": firebase.database.ServerValue.TIMESTAMP,
        });
        write("/recentlyConnected/123", null);
        write("/specs/some_game", {
            "uploader_uid": uid,
            "spec": "whatever",
            "createdOn": firebase.database.ServerValue.TIMESTAMP,
        });
        write("/chats/123", {
            "participants": (_a = {},
                _a[uid] = true,
                _a["ab123"] = true,
                _a),
            "groupName": "",
            "createdOn": firebase.database.ServerValue.TIMESTAMP,
        });
        write("/chats/123/messages/456", {
            "senderUid": uid,
            "message": "message",
            "timestamp": firebase.database.ServerValue.TIMESTAMP,
        });
        executeCommands();
        var _a;
    }
    function init() {
        var config = {
            apiKey: "AIzaSyA_UNWBNj7zXrrwMYq49aUaSQqygDg66SI",
            authDomain: "testproject-a6dce.firebaseapp.com",
            databaseURL: "https://testproject-a6dce.firebaseio.com",
            projectId: "testproject-a6dce",
            storageBucket: "",
            messagingSenderId: "957323548528"
        };
        firebase.initializeApp(config);
        console.log("firebase.auth().currentUser=", firebase.auth().currentUser);
        firebase.auth().onAuthStateChanged(function (user) {
            console.log("onAuthStateChanged user=", user);
            if (user) {
                runDbTest();
                return;
            }
            // No auth user.
            cannotRead("/images/123"); // We must authenticate first.
        });
    }
    function login() {
        var provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithRedirect(provider)
            .then(function (result) {
            console.info(result);
            // This gives you a Google Access Token. You can use it to access the Google API.
            //let token = result.credential.accessToken;
            // The signed-in user info.
            //let user = result.user;
            runDbTest();
        })
            .catch(function (error) {
            console.error("Failed auth: ", error);
        });
    }
    document.getElementById('login').onclick = login;
    init();
})(main || (main = {}));
//# sourceMappingURL=index.js.map