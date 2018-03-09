const serviceAccount = require("../../testproject-firebase-adminsdk.json");
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://testproject-a6dce.firebaseio.com/",
  storageBucket: 'testproject-a6dce.appspot.com'
});

const db = admin.database();
const dbRef = db.ref("/gamePortal/gamesInfoAndSpec/gameSpecsForPortal");

// -L-SbyQzVtEP_sDhK2Mz
// https://firebasestorage.googleapis.com/v0/b/universalgamemaker.appspot.com/o/images%2F-L-SbyQzVtEP_sDhK2Mz.png?alt=media&token=c11c45e3-d7f9-465f-a436-38345baaf96a
function download_Images(){
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