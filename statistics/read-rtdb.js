const serviceAccount = require("../../Certificates/universalgamemaker-firebase-adminsdk.json");
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://universalgamemaker.firebaseio.com",
  storageBucket: 'universalgamemaker.appspot.com'
});

const db = admin.database();
const dbRef = db.ref("/gameBuilder");
const dbTarget = db.ref("/gamePortal/gamesInfoAndSpec/gameInfo");

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
        //console.log("gameSpecId=" + spec.key + " gameName=" + gameName + " screenShootImageId=" + screenShootImageId);
        dbTarget.push({
          gameName: gameName,
          gameSpecId: spec.key,
          screenShootImageId: screenShootImageId,
          numberOfMatches: 0
        });
      }
    });
    admin.app().delete();
  });
}


function downloadDatabase_gameSpecforPortal(){
  //dbTargetSpec.remove();
  let database_json = {};
  dbRef.once("value", (gameBuilder) => {
    const specs = gameBuilder.child('gameSpecs');
    const elements = gameBuilder.child('elements');
    const images = gameBuilder.child('images');
    specs.forEach((spec) =>{
      const dbTargetElem = db.ref("/gamePortal/gamesInfoAndSpec/gameSpecsForPortal/"+spec.key+"/elements");
      const dbTargetImg = db.ref("/gamePortal/gamesInfoAndSpec/gameSpecsForPortal/"+spec.key+"/images");
      const screenShootImageId = spec.child("screenShootImageId").val();
      const gameName = spec.child("gameName").val();
      const pieces = spec.child("pieces");
      if (screenShootImageId && gameName === "Sidjah") {
        console.log("gameSpecId=" + spec.key + " gameName=" + gameName + " screenShootImageId=" + screenShootImageId);
        dbTargetSpec.child(spec.key).set({
          gameSpec: spec.val()
        });   
        pieces.forEach((pieces) =>{
          const pieceElementId = pieces.child("pieceElementId").val();
          console.log(pieceElementId);
          //dbTargetElem.child(pieceElementId).set(elements.child(pieceElementId).val());

          elements.forEach((elements) =>{       
            if(pieceElementId === elements.key)
            {
              console.log(elements.key+ " " + elements.val());
              dbTargetElem.child(elements.key).set(elements.val()).then(function() {
                console.log('Synchronization succeeded');
              })
              .catch(function(error) {
                console.log('Synchronization failed');
              });;
              const elemImageId = elements.child("images/0/imageId").val();
              images.forEach((images) =>{              
                if(elemImageId === images.key)
                {
                  console.log(images.key);
                  dbTargetImg.child(images.key).set(images.val());
                  
                }
              }); 
            }
          });                    
        });  
        //console.log(items);
      }
    });
    //admin.app().delete();
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

exampleDownloadUrl();