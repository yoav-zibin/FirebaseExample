const isTestProject = false;
const projectName = isTestProject ? "testproject-a6dce" : "universalgamemaker";
const certificateName = isTestProject ? "testproject-firebase-adminsdk.json" : "universalgamemaker-firebase-adminsdk.json";
const serviceAccount = require(`../../Certificates/${certificateName}`);
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${projectName}.firebaseio.com`,
  storageBucket: `${projectName}.appspot.com`
});

const db = admin.database();
const dbRef = db.ref("/gameBuilder");
const allPromises = [];
function refSet(path, val) {
  console.log("refSet path=" + path);
  promise = db.ref(path).set(val);
  allPromises.push(promise);
  return promise;
}

const downLoadUrlPromises = [];
function fixDownloadUrl(image) {
  if (image.cloudStoragePath.startsWith("compressed")) return image; // already fixed.
  image.cloudStoragePath = image.cloudStoragePath.replace("images", "compressed");
  const storage = admin.storage().bucket();
  const file = storage.file(image.cloudStoragePath);
  const promise = file.getSignedUrl({
    action: 'read',
    expires: '03-09-2491'
  }).then(signedUrls => {
    if (!signedUrls[0]) throw new Error("Can't fix " + image.cloudStoragePath + " signedUrls=" + signedUrls);
    image.downloadURL = signedUrls[0];
  });
  downLoadUrlPromises.push(promise);
  return image;
}

function downloadDatabase(){
  let database_json = {};
  allPromises.push(dbRef.once("value", (gameBuilder) => {
    const specs = gameBuilder.child('gameSpecs');
    const elementIdToElement = gameBuilder.child('elements').val();
    const imageIdToImage = gameBuilder.child('images').val();
    // dbTarget.remove();
    let specCount = 0;
    let gameSpecs = [];
    let gameSpecsForPortal = {};
    specs.forEach((spec) =>{
      const screenShotImageId = spec.child("screenShotImageId").val();
      const gameName = spec.child("gameName").val();
      if (!screenShotImageId) return;
      specCount++;
      // console.log("gameSpecId=" + spec.key + " gameName=" + gameName + " screenShotImageId=" + screenShotImageId);
      gameSpecs.push({
        gameSpecId: spec.key,
        gameName: gameName,
        screenShotImageId: screenShotImageId,
        screenShotImage: fixDownloadUrl(imageIdToImage[screenShotImageId])
      });

      let specVal = spec.val();
      const images = {};
      const elements = {};
      images[specVal.board.imageId] = fixDownloadUrl(imageIdToImage[specVal.board.imageId]);
      spec.child('pieces').forEach(piece => {
        const elementId = piece.child('pieceElementId').val();
        let element = elementIdToElement[elementId];
        elements[elementId] = element;
        for (let [k,v] of Object.entries(element.images)) {
          images[v.imageId] = fixDownloadUrl(imageIdToImage[v.imageId]);
        }
      });

      gameSpecsForPortal[spec.key] = {
        images: images,
        elements: elements,
        gameSpec: spec.val(),
      };
    });
    Promise.all(downLoadUrlPromises).then(()=> {
      refSet("/gamePortal/gamesInfoAndSpec/gameInfos", gameSpecs);
      refSet("/gamePortal/gamesInfoAndSpec/gameSpecsForPortal", gameSpecsForPortal);
      Promise.all(allPromises).then(() => {
        admin.app().delete();
      }).catch((e) => console.error("Promise error: " + e));
    });
  }));
}


downloadDatabase();

