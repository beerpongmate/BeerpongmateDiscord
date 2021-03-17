const admin = require('firebase-admin');

const serviceAccount = require('../secrets/firebase.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function listenToSessions() {
  const db = admin.firestore();
  const snapshot = await db.collection('Lobbies').get();
  snapshot.forEach((doc) => {
    console.log(doc.id, '=>', doc.data());
  });
}

function FirebaseController(server) {
  this.server = server;
  
  listenToSessions();
};

module.export = FirebaseController;