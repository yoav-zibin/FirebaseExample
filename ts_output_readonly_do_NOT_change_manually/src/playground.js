let config = {
    apiKey: `AIzaSyA_UNWBNj7zXrrwMYq49aUaSQqygDg66SI`,
    authDomain: `testproject-a6dce.firebaseapp.com`,
    databaseURL: `https://testproject-a6dce.firebaseio.com`,
    projectId: `testproject-a6dce`,
    storageBucket: ``,
    messagingSenderId: `957323548528`
};
firebase.initializeApp(config);
firebase.auth().signInAnonymously()
    .then(function (result) {
    console.info("signInAnonymously succeded! My user id is: ", result.uid);
});
//# sourceMappingURL=playground.js.map