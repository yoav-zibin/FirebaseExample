// Radhika Mattoo, rm3485@nyu.edu
const serviceAccount = require("../../Certificates/universalgamemaker-firebase-adminsdk.json");
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://universalgamemaker.firebaseio.com",
  storageBucket: 'universalgamemaker.appspot.com'
});

const db = admin.database();
const storage = admin.storage().bucket();

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
          console.log("Downloaded file to", filename, " err=", err);
        });
      }
    });
    console.log("Finished downloading");
  });
}
downloadImages();