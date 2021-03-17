const http = require('http');
const hostname = '127.0.0.1';
const port = 3000;
const admin = require('firebase-admin');
const serviceAccount = require('./secrets/firebase.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const doc = db.collection('Lobbies');

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World');
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

doc.onSnapshot(docSnapshot => {
  docSnapshot.docChanges().forEach(change => {
    if (change.type === 'added') {
      console.log('New Lobby: ', change.doc.data());
    }
    if (change.type === 'modified') {
      console.log('Modified Lobby: ', change.doc.data());
    }
    if (change.type === 'removed') {
      console.log('Removed Lobby: ', change.doc.data());
    }
  });

  console.log(`Received doc snapshot:`,  docSnapshot);
  // ...
}, err => {
  console.log(`Encountered error: ${err}`);
});





