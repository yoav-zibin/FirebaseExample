const serviceAccount = require("../../testproject-firebase-adminsdk.json");
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://testproject-a6dce.firebaseio.com/",
  storageBucket: 'testproject-a6dce.appspot.com'
});

const db = admin.database();
const dbRef = db.ref("/gameBuilder");
const dbTarget = db.ref("/gamePortal/gamesInfoAndSpec/gameInfo");
const dbTargetSpec = db.ref("/gamePortal/gamesInfoAndSpec/gameSpecsForPortal");
var dbTargetElement;


var writeUserData = function (promisesSpecs, promisesElemes, promisesImages,itemsElems,itemsSpecs,dbTargetElem) {
//console.log(dbTargetElem);
  Promise.all(promisesImages).then(
    (promises) => {
      promises = promises.filter(promise => !(promise instanceof Error));
      
      errors = promises.filter(promise => (promise instanceof Error));
      console.log("Errors Encountered:" + errors);
      console.log(" Finished Writing Images");
    }
  ).then(val => {
    // for (var key in itemsElems) {
    //         if (itemsElems.hasOwnProperty(key)) {
    //             console.log(itemsElems[key].key + " -> " + itemsElems[key].value);
    //         }
    //     }
    Object.keys(itemsElems).forEach(function(key) {
        const dbTargetElem = db.ref("/gamePortal/gamesInfoAndSpec/gameSpecsForPortal/"+itemsElems[key].specKey+"/elements");
         promisesElemes.push(dbTargetElem.child(itemsElems[key].key).set(itemsElems[key].value));
   });
    return Promise.all(promisesElemes).then(
      (promises) => {
        promises = promises.filter(promise => !(promise instanceof Error));  
        errors = promises.filter(promise => (promise instanceof Error));
        console.log("Errors Encountered:" + errors);
        console.log(" Finished Writing Elements");
      }
    )
}).then(val => {
  Object.keys(itemsSpecs).forEach(function(key) {
    promisesSpecs.push(dbTargetSpec.child(itemsSpecs[key].key).update({
           gameSpec: itemsSpecs[key].value
         }));
 });
    return Promise.all(promisesSpecs).then(
      (promises) => {
        promises = promises.filter(promise => !(promise instanceof Error));
        
        errors = promises.filter(promise => (promise instanceof Error));
        console.log("Errors Encountered:" + errors);
        console.log(" Finished Writing Specs");
      }
    )
}).then(finalVal => {
    console.log(" All elements written successfully");
})

};




function downloadDatabase(){
  //dbTargetSpec.remove();
  let database_json = {};
  const promisesSpecs = [];
  const promisesElemes = [];
  const promisesImages = [];
  const itemsElems= [];
  const itemsSpecs = [];
  dbRef.once("value", (gameBuilder) => {
    const specs = gameBuilder.child('gameSpecs');
    const elements = gameBuilder.child('elements');
    const images = gameBuilder.child('images');
    specs.forEach((spec) =>{
        dbTargetElem = db.ref("/gamePortal/gamesInfoAndSpec/gameSpecsForPortal/"+spec.key+"/elements");
        dbTargetElement = dbTargetElem;
      
        const dbTargetImg = db.ref("/gamePortal/gamesInfoAndSpec/gameSpecsForPortal/"+spec.key+"/images");
        const screenShootImageId = spec.child("screenShootImageId").val();
        const gameName = spec.child("gameName").val();
        const pieces = spec.child("pieces");
        if (screenShootImageId ) {
            //console.log("gameSpecId=" + spec.key + " gameName=" + gameName + " screenShootImageId=" + screenShootImageId);
            //dbTargetSpec.remove();
            var gamespec = {};
            gamespec.key = spec.key;
            gamespec.value = spec.val();
            //gamespec[spec.key] = spec.val()
            itemsSpecs.push(gamespec);
            pieces.forEach((pieces) =>{

                const pieceElementId = pieces.child("pieceElementId").val();
                elements.forEach((elements) =>{       
                    if(pieceElementId === elements.key)
                    {
                        var list = {};
                        list.key = elements.key;
                        list.specKey = spec.key;
                        list.value = elements.val();
                        //list[elements.key] = elements.val();
                        itemsElems.push(list);
                        const elemImageId = elements.child("images/0/imageId").val();
                        images.forEach((images) =>{              
                            if(elemImageId === images.key)
                            {
                                promisesImages.push(dbTargetImg.child(images.key).set(images.val()));                           
                            }
                        }); 
                    }
                });                    
             });  
       //console.log(items);   
        }     
    });
    //Object.keys(itemsElems).map(e => console.log(`key=${e}  value=${Object.values(e)}`));
    writeUserData(promisesSpecs, promisesElemes, promisesImages,itemsElems,itemsSpecs,dbTargetElement);
    //admin.app().delete();
  });
}

downloadDatabase();