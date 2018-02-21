// Radhika Mattoo, rm3485@nyu.edu

const admin = require("firebase-admin");
const gcs = require('@google-cloud/storage')();
const imagemagick = require('imagemagick');
const os = require('os');
const path = require('path');
const realFs = require('fs');
const mkdirp = require('mkdirp');
const fs = require('graceful-fs');
fs.gracefulify(realFs);
const Jimp = require("jimp");
const serviceAccount = require("./credentials.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://universalgamemaker.firebaseio.com",
  storageBucket: 'universalgamemaker.appspot.com'
});

const db = admin.database();
const storage = admin.storage().bucket();
const dbRef = db.ref("/gameBuilder");

const db_outfile = "database.json";
const images_outfile = "image_data.json";
const stats_outfile = "image_stats.json";

// Game name |
// Original size in KB |
// Size for quality=70 without compressing PNGs |
// Size for quality=70 without compressing PNGs |
// Size for quality=70 with compressing PNGs as JPGs |
// Size for quality=70 with compressing PNGs as JPGs

function downloadDatabase(){
  let database_json = {};
  dbRef.once("value", (gameBuilder) => {
    const specs = gameBuilder.child('gameSpecs');
    const elements = gameBuilder.child('elements');
    const images = gameBuilder.child('images');

    database_json["specs"] = specs.toJSON();
    database_json["elements"] = elements.toJSON();
    database_json["images"] = images.toJSON();
    specs.forEach((spec) =>{
      let json = spec.child('pieces').toJSON();
      if(typeof json == "string"){ //it's a badly formatted array!
        let array_obj = JSON.parse(database_json["specs"][spec.key]["pieces"]);
        let build = {};
        for(let i = 0; i < array_obj.length; i++){
          build[i] = array_obj[i];
        }
        database_json["specs"][spec.key]["pieces"] = build;
      }
    });
    fs.writeFileSync(db_outfile, JSON.stringify(database_json, null, 2));
    console.log("Saved JSON to", db_outfile);
  });
}

function downloadImages(){
  storage.getFiles(function(err, files){
    files.forEach((file) =>{
      file.download({
        destination: file.name
      },(err) =>{
        console.log("Downloaded file to", file.name);
      });
    });
  });
}

function getGameData(){
  let game_data = {}; // {gameName: {board:___, nonBoard: [__,___]}}
  const string = fs.readFileSync(db_outfile);
  const obj = JSON.parse(string);

  const specs = obj['specs'];
  const images = obj['images'];
  const elements = obj['elements'];

  for(let specId in specs) {
    const name = specs[specId]['gameName'];
    const imageId = specs[specId]['board']['imageId'];
    const imagePath = images[imageId]['cloudStoragePath'];

    game_data[name] = {};
    game_data[name]['board'] = imagePath;
    game_data[name]['nonboard'] = [];

    const pieces = specs[specId]['pieces'];
    for(let element in pieces){
      const elementId = pieces[element]['pieceElementId'];
      const image_set = elements[elementId]['images'];
      for(let image in image_set){
        const imageId = image_set[image]['imageId'];
        const imgPath = images[imageId]['cloudStoragePath'];
        game_data[name]['nonboard'].push(imgPath);
      }
    }
  }
  fs.writeFileSync(images_outfile, JSON.stringify(game_data, null, 2));
  console.log("Wrote game image data to", images_outfile);
  return game_data;
}

function convertBoardImage(board_file, board_ext){
    let filename = path.basename(board_file, board_ext);
    filename += ".jpg";
    let outpath = "./images/boardToJPG/" + game.replace(/ /g, '');
    let finalpath = path.join(outpath, filename);
    mkdirp(outpath, (err) =>{
      if(err) throw err;
      imagemagick.convert([board_file, finalpath], (err, stdout) =>{
        if (err) throw err;
        console.log("Converted image");
      });
    });
}

function convertNonBoardImages(nonboard_files, destination_path, quality, promises, compress, game){
  const allowed = ['.jpg', '.jpeg', '.png'];

  for(let i = 0; i < nonboard_files.length; i++){
    const file = nonboard_files[i];
    const ext = path.extname(file);

    if(allowed.indexOf(ext) >= 0){

      if(compress){ //Force convert to .jpg
        filename = path.basename(file, ext);
        filename += '.jpg';
      }else{
        filename = path.basename(file);
      }

      let outpath = destination_path + game.replace(/ /g, '');
      let finalpath = path.join(outpath, filename);

      promises.push(Jimp.read(file).then((img) =>{
        return img.quality(quality).write(finalpath);
      }).catch((err) =>{
        return err;
      }));
    } //if
  } //for loop

}

function getGameSize(board_file, board_ext, nonboard_files, game, destination_path, compress){
  const allowed = ['.jpg', '.jpeg', '.png'];
  let size_sum = 0;
  for(let i = 0; i < nonboard_files.length; i++){
      const file = nonboard_files[i];
      const ext = path.extname(file);
      if(allowed.indexOf(ext) >= 0){
        let filename;
        if(compress){ //must be .jpg file
          filename = path.basename(file, ext);
          filename += '.jpg';
        }else{
          filename = path.basename(file);
        }
        let outpath = destination_path + game.replace(/ /g, '');
        let finalpath = path.join(outpath, filename);
        size_sum += getFilesizeInBytes(finalpath);
      }
  }
  // add new or old board image
  if(board_ext != '.jpg'){
    // add newly generated image
    let filename = path.basename(board_file, board_ext);
    filename += ".jpg";
    let outpath = "./images/boardToJPG/" + game.replace(/ /g, '');
    let finalpath = path.join(outpath, filename);
    size_sum += getFilesizeInBytes(finalpath);
  }else{
    // add old image
    size_sum += getFilesizeInBytes(board_file);
  }
  return bytesToSize(size_sum);
}

function generateStats(){
  let stats = {}; //{gameName: {original : ___, q70_uncompressed:_____, q70_compressed:____, q50_uncompressed:____, q50_compressed:____}}
  const extensions = ['.jpg', '.png', '.jpeg'];
  const dir50 = "images/50";
  const dir70 = "images/70";
  const str = fs.readFileSync(images_outfile);
  const game_data = JSON.parse(str);
  const promises = [];
  let count = 0;
  for (let game in game_data) {
    if (game_data.hasOwnProperty(game)) {
      const data = game_data[game];
      const board_file = data['board'];
      const nonboard_files = data['nonboard'];
      const board_ext = path.extname(board_file);

      // ORIGINAL SUMMED SIZE
      let size_sum = 0;
      let size = getFilesizeInBytes(board_file);
      size_sum += size;
      for(let i = 0; i < nonboard_files.length; i++){
        let filename = nonboard_files[i];
        size_sum += getFilesizeInBytes(filename);
      }
      stats[count] = {};
      stats[count]['game'] = game;
      stats[count]['original'] = bytesToSize(size_sum);

      if(board_ext != ".jpg"){
        convertBoardImage(board_file, board_ext);
      }

      // convert non-board images to q70
      let quality = 70;
      let compress = false;
      let destination_path = "./images/q70/uncompressed/";
      convertNonBoardImages(nonboard_files, destination_path , quality, promises, compress);

      // compress non-board images to q70
      compress = true;
      destination_path = "./images/q70/compressed/";
      convertNonBoardImages(nonboard_files, destination_path, quality, promises, compress, game);

      // compress non-board images to q50
      quality = 50;
      destination_path = "./images/q50/compressed/";
      convertNonBoardImages(nonboard_files, destination_path, quality, promises, compress, game);

      // convert non-board images to q50
      compress = false;
      destination_path = "./images/q50/uncompressed/";
      convertNonBoardImages(nonboard_files, destination_path, quality, promises, compress, game);
      count += 1;

    }
  } //game for each

  console.log("Waiting for file conversions to finish...");
  Promise.all(promises).then(() =>{
    console.log("Finished all file conversions!");
    let count = 0;
    for (let game in game_data) {
      if (game_data.hasOwnProperty(game)) {
        const data = game_data[game];
        const board_file = data['board'];
        const nonboard_files = data['nonboard'];
        const board_ext = path.extname(board_file);
        let compress = false;

        stats[count]['q70_uncompressed'] = getGameSize(board_file, board_ext, nonboard_files, game, "./images/q70/uncompressed/", compress);
        stats[count]['q50_uncompressed'] = getGameSize(board_file, board_ext, nonboard_files, game, "./images/q50/uncompressed/", compress);

        compress = true;

        stats[count]['q70_compressed'] = getGameSize(board_file, board_ext, nonboard_files, game, "./images/q70/compressed/", compress);
        stats[count]['q50_compressed'] = getGameSize(board_file, board_ext, nonboard_files, game, "./images/q50/compressed/", compress);
        count += 1;
      }
    }
    // write json file
    console.log("Writing statistics to file");
    fs.writeFileSync(stats_outfile, JSON.stringify(stats, null, 2));
    return admin.app().delete();
  }).catch((err) =>{
    console.log("Error: ");
    console.log(err);
    return admin.app().delete();
  });

}

// Taken from: https://techoverflow.net/2012/09/16/how-to-get-filesize-in-node-js/
function getFilesizeInBytes(filename) {
    const stats = fs.statSync(filename);
    const fileSizeInBytes = stats.size;
    return fileSizeInBytes;
}

// Taken from: https://stackoverflow.com/questions/15900485/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript
function bytesToSize(bytes) {
   var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
   if (bytes == 0) return '0 Byte';
   var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
   return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

function main(){
  downloadDatabase();
  // downloadImages();
  // getGameData();
  // generateStats();
  // admin.app().delete();
}

main();
