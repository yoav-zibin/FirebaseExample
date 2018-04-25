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
const allPromises = [];
function refSet(path, val) {
  console.log("refSet path=" + path);
  promise = db.ref(path).set(val);
  allPromises.push(promise);
  return promise;
}

function downloadDatabase(){
  let database_json = {};
  db.ref("/gamePortal/gamePortalUsers").once("value", (snap) => {
    const users = snap.val();
    for (let [userId,userInfo] of Object.entries(users)) {
      if (!userInfo.publicFields) {
        refSet(`/gamePortal/gamePortalUsers/${userId}/publicFields`, {displayName: 'Unknown'});
      }
    }
    Promise.all(allPromises).then(() => {
      admin.app().delete();
    }).catch((e) => console.error("Promise error: " + e));
  });
}
downloadDatabase();