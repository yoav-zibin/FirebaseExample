const serviceAccount = require("../../universalgamemaker-firebase-adminsdk.json");
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://universalgamemaker.firebaseio.com",
  storageBucket: 'universalgamemaker.appspot.com'
});

const db = admin.database();
const dbRef = db.ref("/gameBuilder");
const dbTarget = db.ref("/gamePortal/gamesInfoAndSpec/gameInfo");
const dbTargetSpec = db.ref("/gamePortal/gamesInfoAndSpec/gameSpecsForPortal");

var writeGameData = function (promisesImages,itemElements,itemsSpecs) {
//console.log(dbTargetElem);
  Promise.all(promisesImages).then(
    (promises) => {
      // promises = promises.filter(promise => !(promise instanceof Error));    
      const errorsImages = promises.filter(promise => (promise instanceof Error));
      console.log("Image Errors Encountered:" + errorsImages);
      console.log(" Finished Writing Images");
    }
  ).then(val => {
    const promisesElements = [];
    Object.keys(itemElements).forEach(function(key) {
        const dbTargetElem = db.ref("/gamePortal/gamesInfoAndSpec/gameSpecsForPortal/"+itemElements[key].specKey+"/elements");
        promisesElements.push(dbTargetElem.child(itemElements[key].key).set(itemElements[key].value));
   });
    return Promise.all(promisesElements).then(
      (promises) => {
        // promises = promises.filter(promise => !(promise instanceof Error));  
        const errorsElements = promises.filter(promise => (promise instanceof Error));
        console.log("Element Errors Encountered:" + errorsElements);
        console.log(" Finished Writing Elements");
      }
    )
}).then(val => {
  const promisesSpecs = [];
  Object.keys(itemsSpecs).forEach(function(key) {
    promisesSpecs.push(dbTargetSpec.child(itemsSpecs[key].key).update({
           gameSpec: itemsSpecs[key].value
         }));
 });
    return Promise.all(promisesSpecs).then(
      (promises) => {
        // promises = promises.filter(promise => !(promise instanceof Error));      
        const errorsSpecs = promises.filter(promise => (promise instanceof Error));
        console.log("Game Specification Errors Encountered:" + errorsSpecs);
        console.log(" Finished Writing Specs");
      }
    )
}).then(finalVal => {
    console.log(" Transfer Complete!! ");
    return admin.app().delete();
}).catch((err) =>{
  console.log("Error Encountered: ");
  console.log(err);
  return admin.app().delete();
});

};


function downloadDatabase(){
  //dbTargetSpec.remove();
  let database_json = {};
  const promisesImages = [];
  const itemElements = [];
  const itemSpecs = [];
  dbRef.once("value", (gameBuilder) => {
    const specs = gameBuilder.child('gameSpecs');
    const elements = gameBuilder.child('elements');
    const images = gameBuilder.child('images');
    specs.forEach((spec) =>{   
        const dbTargetImg = db.ref("/gamePortal/gamesInfoAndSpec/gameSpecsForPortal/"+spec.key+"/images");
        const screenShootImageId = spec.child("screenShootImageId").val();
        const gameName = spec.child("gameName").val();
        const pieces = spec.child("pieces");
        if (screenShootImageId) {
            //console.log("gameSpecId=" + spec.key + " gameName=" + gameName + " screenShootImageId=" + screenShootImageId);
            // dbTargetSpec.remove();
            const boardImageId = spec.child("board").child("imageId").val();
            var gameSpec = {};
            gameSpec.key = spec.key;
            gameSpec.value = spec.val();
            itemSpecs.push(gameSpec);
            pieces.forEach((pieces) =>{
                const pieceElementId = pieces.child("pieceElementId").val();
                elements.forEach((elements) =>{       
                    if(pieceElementId === elements.key)
                    {
                        var gameElement = {};
                        gameElement.key = elements.key;
                        gameElement.specKey = spec.key;
                        gameElement.value = elements.val();
                        itemElements.push(gameElement);
                        const elemImageId = elements.child("images");
                        elemImageId.forEach((elemImageId) =>{  
                            const elemImageVal = elemImageId.child("imageId").val();      
                            promisesImages.push(dbTargetImg.child(elemImageVal).set(images.child(elemImageVal).val()));   
                        });    
                    }
                });                    
            });    
             promisesImages.push(dbTargetImg.child(boardImageId).set(images.child(boardImageId).val()));   
        }     
    });
     writeGameData(promisesImages, itemElements, itemSpecs);
  });
}

downloadDatabase();