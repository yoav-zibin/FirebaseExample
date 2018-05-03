const isTestProject = true;
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
const allPromises = [];
function refSet(path, val) {
  // console.log("refSet path=" + path);
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

function trimImageFields(img) {
  return {
    height: img.height,
    width: img.width,
    isBoardImage: img.isBoardImage,
    downloadURL: img.downloadURL,
    cloudStoragePath: img.cloudStoragePath,
  };
}

function trimElementFields(element) {
  return {
    height: element.height,
    width: element.width,
    elementKind: element.elementKind,
    images: element.images,
    isDraggable: element.isDraggable
  };
}

function trimGameSpecFields(gameSpec) {
  return {
    board: {imageId : gameSpec.board.imageId},
    pieces: gameSpec.pieces,
    screenShotImageId: gameSpec.screenShotImageId,
    gameName: gameSpec.gameName,
    wikipediaUrl: gameSpec.wikipediaUrl,
  };
}

function trimObject(obj, trimFunc) {
  for (let [id, v] of Object.entries(obj)) {
    obj[id] = trimFunc(v);
  }
}

function changeElementToCard(element) {
  // One game had toggable elements in a deck of cards, so we fix it here.
  if (Object.keys(element.images).length != 2) throw new Error('changeElementToCard');
  element.elementKind = 'card';
}

function downloadDatabase(){
  let database_json = {};
  allPromises.push(db.ref("/gameBuilder").once("value", (snap) => {
    const gameBuilder = snap.val();
    const specIdToSpec = gameBuilder.gameSpecs;
    const elementIdToElement = gameBuilder.elements;
    const imageIdToImage = gameBuilder.images;
    trimObject(specIdToSpec, trimGameSpecFields);
    trimObject(elementIdToElement, trimElementFields);
    trimObject(imageIdToImage, trimImageFields);
    let specCount = 0;
    let gameSpecs = [];
    let gameSpecsForPortal = {};
    for (let [gameSpecId,spec] of Object.entries(specIdToSpec)) {
      
      const screenShotImageId = spec.screenShotImageId;
      let gameName = spec.gameName;
      const wikipediaUrl = spec.wikipediaUrl == "https://no-wiki.com" ? '' : spec.wikipediaUrl || '';
      if (!screenShotImageId) continue;
      if (!spec.pieces) continue; // skip that game that has no pieces.
      if (gameName == 'reversi_initial_state') continue;
      if (gameName == 'reversi-sm') gameName = 'Reversi';
      specCount++;
      gameSpecs.push({
        gameSpecId: gameSpecId,
        gameName: gameName,
        screenShotImageId: screenShotImageId,
        wikipediaUrl: wikipediaUrl,
        screenShotImage: fixDownloadUrl(imageIdToImage[screenShotImageId])
      });
      console.log(gameSpecId + "," + gameName + "," + wikipediaUrl);
      
      const images = {};
      const elements = {};
      images[spec.board.imageId] = fixDownloadUrl(imageIdToImage[spec.board.imageId]);
      for (let [_index, piece] of Object.entries(spec.pieces)) {
        const elementId = piece.pieceElementId;
        let element = elementIdToElement[elementId];
        if (piece.deckPieceIndex !== -1) changeElementToCard(element);
        elements[elementId] = element;
        for (let [k,v] of Object.entries(element.images)) {
          images[v.imageId] = fixDownloadUrl(imageIdToImage[v.imageId]);
        }
      }

      if (Object.keys(elements).length == 0) throw new Error("no elements in gameSpecId=" + gameSpecId);
      gameSpecsForPortal[gameSpecId] = {
        images: images,
        elements: elements,
        gameSpec: spec,
      };
    }
    //console.log('wrote specCount=' + specCount);
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

