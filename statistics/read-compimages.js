const serviceAccount = require("../../testproject-firebase-adminsdk.json");
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://testproject-a6dce.firebaseio.com/",
  storageBucket: 'testproject-a6dce.appspot.com'
});

const db = admin.database();
const dbRef = db.ref("/gamePortal/gamesInfoAndSpec/gameSpecsForPortal");

function download_Images(){
  //dbTargetSpec.remove();
  console.log("Hello");
  const promises = [];
  dbRef.once("value", (gameImages) => {
    gameImages.forEach((spec) =>{
    const imgs = spec.child('images');
    imgs.forEach((img) =>{                  
        const downloadURL = img.child("downloadURL").val();
        const compressedURL = downloadURL.replace("images", "compressed");
        var updates = {};
        updates[spec.key + '/images/' + img.key + '/downloadURL'] = compressedURL;
        promises.push(dbRef.update(updates));                    
    });
});
    Promise.all(promises).then( () => admin.app().delete() );
});
}
download_Images();