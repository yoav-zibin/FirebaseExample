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

const allPromises = [];
function refSet(path, val) {
  // console.log("refSet path=" + path);
  promise = db.ref(path).set(val);
  allPromises.push(promise);
  return promise;
}

const db = admin.database();
db.ref("/gamePortal/gamePortalUsers").once("value", (snap) => {
  const gamePortalUsers = snap.val();
  for (let [userId,user] of Object.entries(gamePortalUsers)) {
    // privateButAddable includes signals and matchMemberships
    refSet(`/gamePortal/gamePortalUsers/${userId}/privateButAddable`, null);
  }
  refSet(`/gamePortal/gamePortalUsers/matches`, null);
  Promise.all(allPromises).then(() => {
    console.log("All Done");
    admin.app().delete();
  }).catch((e) => console.error("Promise error: " + e));
});