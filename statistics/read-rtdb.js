//const serviceAccount = require("../../universalgamemaker-firebase-adminsdk.json");
const serviceAccount = require("../../testproject-firebase-adminsdk.json");
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // databaseURL: "https://universalgamemaker.firebaseio.com",
  // storageBucket: 'universalgamemaker.appspot.com'
  databaseURL: "https://testproject-a6dce.firebaseio.com/",
  storageBucket: 'testproject-a6dce.appspot.com'
});

const db = admin.database();
const dbRef = db.ref("/gameBuilder");
const dbTarget = db.ref("/gamePortal/gamesInfoAndSpec/gameInfo");
const dbTargetSpec = db.ref("/gamePortal/gamesInfoAndSpec/gameSpecsForPortal");
let final = [];

// Sequential Execution of all Promises. Example taken from github
// function asyncFunc(e) {
//   return new Promise((resolve, reject) => {
//     setTimeout(() => resolve(e), e * 1000);
//   });
// }

// var writeUserData = function (promises) { 
//     return promises.reduce((promise, item) => {
//       return promise
//         .then((result) => {
//           return asyncFunc(item).then(result => {
//             final.push(result)
//             return result + " Done"
//           })
//         })
//         .catch(console.error)
//     }, Promise.resolve())
//   };

function downloadDatabase_GameSpecs(){
  //dbTargetSpec.remove();
  let database_json = {};
  const promises = [];
  dbRef.once("value", (gameBuilder) => {
    const specs = gameBuilder.child('gameSpecs');
    const elements = gameBuilder.child('elements');
    const images = gameBuilder.child('images');
    database_json["specs"] = specs.toJSON();
    specs.forEach((spec) =>{
      const dbTargetElem = db.ref("/gamePortal/gamesInfoAndSpec/gameSpecsForPortal/"+spec.key+"/elements");
      const dbTargetImg = db.ref("/gamePortal/gamesInfoAndSpec/gameSpecsForPortal/"+spec.key+"/images");
      const screenShootImageId = spec.child("screenShootImageId").val();
      const gameName = spec.child("gameName").val();
      const pieces = spec.child("pieces");
      if (screenShootImageId) {
        console.log("gameSpecId=" + spec.key + " gameName=" + gameName + " screenShootImageId=" + screenShootImageId);
       //dbTargetSpec.remove();
        promises.push(dbTargetSpec.child(spec.key).set({
             gameSpec: spec.val()
           }));  
         pieces.forEach((pieces) =>{
          const pieceElementId = pieces.child("pieceElementId").val(); 
          elements.forEach((elements) =>{       
            if(pieceElementId === elements.key)
            {
              promises.push(dbTargetElem.child(elements.key).set(elements.val()));
              const elemImageId = elements.child("images/0/imageId").val();
              images.forEach((images) =>{              
                if(elemImageId === images.key)
                {
                 promises.push(dbTargetImg.child(images.key).set(images.val()));                  
                }
              }); 
            }
          });                    
        });  
      }    
    });
    Promise.all(promises).then( "Done Adding elements" );
    //Promise.all(promises).then( () => admin.app().delete() );
    //writeUserData(promises).then(() => console.log("Done Adding")); // Sequential 
    //admin.app().delete();
  });
}



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

//downloadDatabase();
downloadDatabase_GameSpecs();