const serviceAccount = require("../../Certificates/universalgamemaker-firebase-adminsdk.json");
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://universalgamemaker.firebaseio.com",
  storageBucket: 'universalgamemaker.appspot.com'
});

const db = admin.database();
const dbRef = db.ref("/gameBuilder");

function downloadDatabase(){
  let database_json = {};
  dbRef.once("value", (gameBuilder) => {
    const specs = gameBuilder.child('gameSpecs');
    const elements = gameBuilder.child('elements');
    const images = gameBuilder.child('images');

    specs.forEach((spec) =>{
      const screenShootImageId = spec.child("screenShootImageId").val();
      const gameName = spec.child("gameName").val();
      if (screenShootImageId) {
        console.log("gameName=" + gameName + " screenShootImageId=" + screenShootImageId);
      }
    });
  });
}

downloadDatabase();