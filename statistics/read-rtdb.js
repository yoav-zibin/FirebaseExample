const serviceAccount = require("../../universalgamemaker-firebase-adminsdk.json");
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://universalgamemaker.firebaseio.com",
  storageBucket: 'universalgamemaker.appspot.com'
});

const db = admin.database();
const dbRef = db.ref("/gameBuilder");
const dbTarget = db.ref("/gamePortal/gamesInfoAndSpec/gameInfos");

function downloadDatabase(){
  let database_json = {};
  dbRef.once("value", (gameBuilder) => {
    const specs = gameBuilder.child('gameSpecs');
    const elements = gameBuilder.child('elements');
    const images = gameBuilder.child('images');
    // dbTarget.remove();
    specs.forEach((spec) =>{
      const screenShootImageId = spec.child("screenShootImageId").val();
      const gameName = spec.child("gameName").val();
      if (screenShootImageId) {
        //console.log("gameSpecId=" + spec.key + " gameName=" + gameName + " screenShootImageId=" + screenShootImageId);
        dbTarget.push({
          gameName: gameName,
          gameSpecId: spec.key,
          screenShootImageId: screenShootImageId,
          numberOfMatches: 0,
          screenShotImage: images.child(screenShootImageId).val()
        });
      }
    });
    admin.app().delete();
  });
}

function exampleDownloadUrl() {
  const storage = admin.storage().bucket();
  const file = storage.file("compressed/-L5uNRbN3zNwj5OcFtks.png");
  return file.getSignedUrl({
    action: 'read',
    expires: '03-09-2491'
  }).then(signedUrls => {
    console.log(signedUrls[0]);
  });
  
}

downloadDatabase();

exampleDownloadUrl();