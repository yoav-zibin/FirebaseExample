// Radhika Mattoo, rm3485@nyu.edu
const admin = require("firebase-admin");
const gcs = require('@google-cloud/storage')();
const os = require('os');
const path = require('path');
const imagemin = require('imagemin');
const imageminJpegtran = require('imagemin-jpegtran');
const imageminPngquant = require('imagemin-pngquant');
const pngToJpeg = require('png-to-jpeg');
const fs = require('fs-extra');
const jimp = require('jimp');
const serviceAccount = require("./credentials.json");
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: "https://universalgamemaker.firebaseio.com",
//   storageBucket: 'universalgamemaker.appspot.com'
// });
//
// const db = admin.database();
// const storage = admin.storage().bucket();
// const dbRef = db.ref("/gameBuilder");

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
    let downloaded = [];
    files.forEach((file) =>{
      const filename = file.name;
      if(!downloaded.includes(filename)){
        downloaded.push(filename);
        file.download({
          destination: filename
        },(err) =>{
          console.log("Downloaded file to", filename);
        });
      }
    });
    console.log("Finished downloading");
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
        if(!game_data[name]['nonboard'].includes(imgPath)){
          game_data[name]['nonboard'].push(imgPath);
        }
      }
    }
  }
  fs.writeFileSync(images_outfile, JSON.stringify(game_data, null, 2));
  console.log("Wrote game image data to", images_outfile);
  return game_data;
}

function convertBoardImage(board_file, board_ext, game){
    let filename = path.basename(board_file, board_ext);
    filename += ".jpg";
    let outpath = "./images/boardToJPG/" + game.replace(/ /g, '');

    return imagemin([board_file], outpath, {
      plugins: [
        pngToJpeg({quality: 70})
    	]
    }).then((file) =>{
      let finalpath = path.join(outpath, filename);
      fs.renameSync(path.join(outpath, path.basename(board_file)), finalpath);
    }).catch((err) =>{
      return err;
    });
}

function convertNonBoardImages(nonboard_files, quality, promises, compress, game){
  const allowed = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG'];

  // TODO: refactor code based on batch compression per game
  if(compress){ //make EVERYTHING .jpgs
    let outpath = "./images/q" + quality + "/compressed/" +  game.replace(/ /g, '');
    promises.push(
      imagemin(nonboard_files, outpath, {
        plugins : [
          imageminJpegtran(),
          pngToJpeg({ quality: quality })
        ]
      }).then((buffer) =>{
        let list = fs.readdirSync(outpath);
        console.log("Reading dir for", game, "with", list.length, "image(s)");

        for(let i = 0; i < list.length; i++){
          const file = list[i];
          console.log("\t", file);
          const ext = path.extname(file); //.png
          let filename = path.basename(file, ext); //dog
          let newpath = path.join(outpath, file); //./images/quality/compressed/game/dog.png
          console.log("\tExtension is", ext);

          // rename to JPG
          if(ext != '.jpg' && ext != '.JPG' && ext != '.jpeg' && ext != '.JPEG'){
            filename += '.jpg'; //dog.jpg
            newpath = path.join(outpath, filename); //./images/quality/compressed/game/dog.jpg
            // console.log("\tRenaming ", path.join(outpath, file), "to", newpath );
            fs.renameSync(path.join(outpath, file), newpath);
            fs.unlinkSync(path.join(outpath, file));
          }
          // compare file sizes
          let original = path.join('./images', file);
          const new_size = getFilesizeInBytes(newpath);
          const old_size = getFilesizeInBytes(original);
          if(new_size > old_size){
            console.log("\tResize is bigger, putting old file back", file);
            fs.unlinkSync(newpath);
            let finalpath = path.join(outpath, file);
            console.log("\tWrote file");
            fs.copySync(original, finalpath);
          }
          console.log("\tAT INDEX", i);
        } //for loop

        return;


      }).catch( (err) =>{
        return err;
      })
    );
  }else{ //keep file extensions as is
    let outpath = "./images/q" + quality + "/uncompressed/" +  game.replace(/ /g, '');
    promises.push(
      imagemin(nonboard_files, outpath, {
        plugins : [
          imageminJpegtran(),
          imageminPngquant({ quality: quality })
        ]
      }).then((buffer) =>{
        let list = fs.readdirSync(outpath);
        for(let i = 0; i < list.length; i++){
          const file = list[i];
          const ext = path.extname(file); //.png
          let filename = path.basename(file, ext); //dog
          let newpath = path.join(outpath, file); //./images/quality/compressed/game/dog.png

          // compare file sizes
          let original = path.join('./images', file);
          const new_size = getFilesizeInBytes(newpath);
          const old_size = getFilesizeInBytes(original);
          if(new_size > old_size){
            fs.unlinkSync(newpath);
            let finalpath = path.join(outpath, file);
            fs.copySync(original, finalpath);
          }
        } //for loop

        return;
      }).catch( (err) =>{
        return err;
      })
    );

  } //if-else
}

function getGameSize(board_file, board_ext, nonboard_files, game, destination_path, compress){
  const allowed = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG'];
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
    let filename = path.basename(board_file, board_ext, game);
    filename += ".jpg";
    let outpath = "./images/boardToJPG/" + game.replace(/ /g, '');
    let finalpath = path.join(outpath, filename);
    size_sum += getFilesizeInBytes(finalpath);
  }else{
    // add old image
    size_sum += getFilesizeInBytes(board_file);
  }
  // return bytesToSize(size_sum);
  return size_sum;
}

function generateStats(){
  let stats = {}; //{gameName: {original : ___, q70_uncompressed:_____, q70_compressed:____, q50_uncompressed:____, q50_compressed:____}}
  const extensions = ['.jpg', '.png', '.jpeg', '.JPG', '.JPEG'];
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
      // stats[count]['original'] = bytesToSize(size_sum);
      stats[count]['original'] = size_sum;

      // if(board_ext != ".jpg"){
      //   promises.push(convertBoardImage(board_file, board_ext, game));
      // }

      // convert non-board images to q70
      let quality = 70;
      let compress = false;
      convertNonBoardImages(nonboard_files, quality, promises, compress, game);

      // // compress non-board images to q70
      compress = true;
      convertNonBoardImages(nonboard_files, quality, promises, compress, game);

      // // compress non-board images to q50
      quality = 50;
      convertNonBoardImages(nonboard_files, quality, promises, compress, game);
      //
      // // convert non-board images to q50
      compress = false;
      convertNonBoardImages(nonboard_files,  quality, promises, compress, game);

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
  // downloadDatabase();
  // downloadImages();
  // getGameData();
  // generateStats();
  let list = fs.readdirSync('./images/q70/compressed')
  // admin.app().delete();
}

main();
