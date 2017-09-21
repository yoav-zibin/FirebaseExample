var main;
(function (main) {
    function init() {
        var config = {
            apiKey: "AIzaSyDA5tCzxNzykHgaSv1640GanShQze3UK-M",
            authDomain: "universalgamemaker.firebaseapp.com",
            databaseURL: "https://universalgamemaker.firebaseio.com",
            projectId: "universalgamemaker",
            storageBucket: "universalgamemaker.appspot.com",
            messagingSenderId: "144595629077"
        };
        firebase.initializeApp(config);
        var provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider).then(function (result) {
            console.info(result);
            // This gives you a Google Access Token. You can use it to access the Google API.
            var token = result.credential.accessToken;
            // The signed-in user info.
            var user = result.user;
            // ...
        }).catch(function (error) {
            console.error(error);
        });
    }
    main.init = init;
    init();
})(main || (main = {}));
//# sourceMappingURL=index.js.map