const isTestProject = false;
const projectName = isTestProject ? "testproject-a6dce" : "universalgamemaker";
const certificateName = isTestProject ? "testproject-firebase-adminsdk.json" : "universalgamemaker-firebase-adminsdk.json";
const serviceAccount = require(`../../Certificates/${certificateName}`);
const admin = require("firebase-admin");
const parse = require('csv-parse/lib/sync');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${projectName}.firebaseio.com`,
  storageBucket: `${projectName}.appspot.com`
});
console.log('Project name:', projectName);
const db = admin.database();
const allPromises = [];
function refSet(path, val) {
  // console.log("refSet path=" + path);
  promise = db.ref(path).set(val);
  allPromises.push(promise);
  return promise;
}

const downLoadUrlPromises = [];
const allImages = {};
function fixDownloadUrl(imageId, image) {
  if (allImages[imageId]) {
    image = allImages[imageId];
  } else {
    allImages[imageId] = image;
  }
  return image;
  /*
  // Newly created images won't be compressed.
  // I've already updated gameBuilder to use compressed, so no need for this code anymore.

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
  */
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

// For all elements in this list, swap their front-back images.
const elementsToFlip = {
  '-L0rS5LnoWCaZpodkV5B': [ 4, 7, 45, 50, 13, 25, 8, 22, 20, 52, 23, 37, 11, 19, 36, 35, 38, 26, 12, 39, 49, 3, 51, 5, 48, 47, 2, 9, 10, 1, 24, 14, 46, 21  ]
};

const gamesToSkip = [
  "3 Man Chess",
  "chemistry ludo spec",
  "Gourd Chess",
  "Connect_6",
  "dice_war_yw",
  "Five in a row",
  "liar's dice", "chuiniu", 'reversi_initial_state'
];

const gamesToRename = {
  'three_men_initial': "3 men's morris",
  "nine men's morris": "9 men's morris",
  "reversi-sm":	"Reversi",
  "banqi_sm": "Banqi",
};

const badMancalaSpec = "-KxLz3FAFZX5RrKR-mhN";
const screenshotsToMap = {
  "-KxLz3HKZcyR22qfys5x": badMancalaSpec // mancala-spec --> mancala
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
    for (let [imageId,image] of Object.entries(imageIdToImage)) {
      fixDownloadUrl(imageId, imageIdToImage[imageId]);
    }
    for (let [gameSpecId,spec] of Object.entries(specIdToSpec)) {

      let screenShotImageId = spec.screenShotImageId;
      let gameName = spec.gameName;
      if (gamesToRename[gamesToRename]) gameName = gamesToRename[gamesToRename];
      const wikipediaUrl = spec.wikipediaUrl == "https://no-wiki.com" ? '' : spec.wikipediaUrl || '';
      if (!screenShotImageId) {
        // If it's in the mapping, use the mapped spec's screenshot
        if(screenshotsToMap[gameSpecId]){
          const mappedSpecId = screenshotsToMap[gameSpecId];
          const mappedSpec = specIdToSpec[mappedSpecId];
          screenShotImageId = mappedSpec.screenShotImageId;
          spec.screenShotImageId = screenShotImageId;
        }else{
          continue;
        }
      }
      if (!spec.pieces) continue; // skip that game that has no pieces.
      if (gamesToSkip.indexOf(gameName) !== -1) continue;
      if (gameSpecId === badMancalaSpec) continue;
      specCount++;
      gameSpecs.push({
        gameSpecId: gameSpecId,
        gameName: gameName,
        screenShotImageId: screenShotImageId,
        wikipediaUrl: wikipediaUrl,
        screenShotImage: fixDownloadUrl(screenShotImageId, imageIdToImage[screenShotImageId])
      });
      // console.log(gameSpecId + "," + gameName + "," + wikipediaUrl);

      const images = {};
      const elements = {};
      const boardImageId = spec.board.imageId;
      images[boardImageId] = fixDownloadUrl(boardImageId, imageIdToImage[boardImageId]);
      const decksIndices = {};
      for (let [_index, piece] of Object.entries(spec.pieces)) {
        const elementId = piece.pieceElementId;
        let element = elementIdToElement[elementId];
        if (piece.deckPieceIndex !== -1) {
          decksIndices[piece.deckPieceIndex] = true;
        }
      }
      const numOfDecks = Object.keys(decksIndices).length;
      if (numOfDecks > 1) {
        console.warn('Game with multiple decks: gameSpecId=' + gameSpecId + ' gameName=' + gameName);
      }
      let shouldAddDeck = false;
      let minX = 100;
      let maxX = 0;
      let minY = 100;
      let maxY = 0;
      const piecesNum = Object.entries(spec.pieces).length;
      for (let [_index, piece] of Object.entries(spec.pieces)) {
        const elementId = piece.pieceElementId;
        let element = elementIdToElement[elementId];
        if (element.elementKind == 'card' && piece.deckPieceIndex === -1) {
          // If the game has just one deck, then let's fix it.
          if (numOfDecks == 1) {
            piece.deckPieceIndex = Object.keys(decksIndices)[0];
          } else if (numOfDecks == 0) {
            shouldAddDeck = true;
            piece.deckPieceIndex = piecesNum;
            minX = Math.min(minX, piece.initialState.x);
            maxX = Math.max(maxX, piece.initialState.x);
            minY = Math.min(minY, piece.initialState.y);
            maxY = Math.max(maxY, piece.initialState.y);
          } else {
            console.warn('card without a deck: elementId=' + elementId + ' gameSpecId=' + gameSpecId + ' gameName=' + gameName);
            break;
          }
        }
      }

      if(elementsToFlip[gameSpecId]){
        let indices = elementsToFlip[gameSpecId];
        for(let index of indices){
          let elementId = spec.pieces[index].pieceElementId;
          let element = elementIdToElement[elementId];
          let holder = element.images[0].imageId;
          element.images[0].imageId = element.images[1].imageId;
          element.images[1].imageId = holder;
        }
      }

      if (shouldAddDeck) {
        const deckElementId = gameSpecId + '-Deck';
        spec.pieces[piecesNum] = {
          pieceElementId: deckElementId,
          deckPieceIndex: -1,
          initialState: {
            x: minX, y: minY,
            zDepth: 1,
            currentImageIndex: 0,
          },
        };
        elementIdToElement[deckElementId] = {
          height: ((maxY - minY)/100) * images[boardImageId].height,
          width: ((maxX - minX)/100) * images[boardImageId].width,
          elementKind: 'cardsDeck',
          images: [],
          isDraggable: false
        };
      }

      for (let [_index, piece] of Object.entries(spec.pieces)) {
        const elementId = piece.pieceElementId;
        let element = elementIdToElement[elementId];
        if (piece.deckPieceIndex !== -1) {
          changeElementToCard(element);
        }
        elements[elementId] = element;
        for (let [k,v] of Object.entries(element.images)) {
          images[v.imageId] = fixDownloadUrl(v.imageId, imageIdToImage[v.imageId]);
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
      for (let [k,v] of Object.entries(allImages)) {
        refSet(`/gameBuilder/images/${k}/cloudStoragePath`, v.cloudStoragePath);
        refSet(`/gameBuilder/images/${k}/downloadURL`, v.downloadURL);
      }

      // Sorting specs by votes
      for (let spec of gameSpecs) {
        if (!specIdToRecord[spec.gameSpecId]) {
          console.warn("Missing spec in our spreadsheet=" + spec.gameSpecId + " " + spec.gameName);
        }
      }
      function specToVote(spec) {
        // Sort by vote and then by game name.
        const vote = Number(specIdToRecord[spec.gameSpecId] ? specIdToRecord[spec.gameSpecId]['Votes'] : 0);
        return vote ? vote : 0;
      }
      gameSpecs.sort((spec1, spec2) => {
        return 10*(specToVote(spec2) - specToVote(spec1)) + spec1.gameName.localeCompare(spec2.gameName);
      });
      for (let i=0; i<10; i++) {
        console.log('spec pos i=', i,' ', gameSpecs[i].gameName, " vote=", specToVote(gameSpecs[i]));
      }

      refSet("/gamePortal/gamesInfoAndSpec/gameInfos", gameSpecs);
      refSet("/gamePortal/gamesInfoAndSpec/gameSpecsForPortal", gameSpecsForPortal);
      Promise.all(allPromises).then(() => {
        console.log("All Done");
        admin.app().delete();
      }).catch((e) => console.error("Promise error: " + e));
    });
  }));
}

// An array of records:
  /*
  { GameSpecID: '-L-_249g8mD8e8K-1L6T',
    'Game name': 'L-Game',
    'Better game name': '',
    'Should delete?': '',
    'Game wiki link': 'https://en.wikipedia.org/wiki/L_game',
    Owner: 'Sisi',
    Votes: '',
    'Comments/issues': 'None' },
    */
let ourSpreadsheetRecords;
let specIdToRecord = {};

fs = require('fs')
fs.readFile('NYU Spring 2018 - All games.csv', 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  // console.log(data);
  ourSpreadsheetRecords = parse(data, {columns: true});
  // console.log(ourSpreadsheetRecords);
  for (let record of ourSpreadsheetRecords) {
    specIdToRecord[record['GameSpecID']] = record; 
  }
  downloadDatabase();
});

