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

const Discord = require('discord.js');
const client = new Discord.Client();


client.once('ready', () => {
	console.log('Ready!');
});

client.login(require("./secrets/discord.json").token);

const guilds = client.guilds;
// .get('821785285423136788');
let guild = null;
guilds.fetch('821785285423136788').then(guildParam => {
  console.log(guildParam.name);
  guild = guildParam;
})
.catch(console.error);;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World');
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

const getChannel = () => {

}

doc.onSnapshot(docSnapshot => {
  docSnapshot.docChanges().forEach(change => {
    if (guild === null) return;
    if (change.type === 'added') {
      console.log('New Lobby: ', change.doc.data());
      guild.channels.create("Matchup", { reason: 'Players', type: "voice" })
        .then(channel => {
          channel.createInvite({ temporary: true })
          .then(invite => {
            console.log(`Created an invite with a code of ${invite.code} and url ${invite.url}`);
            change.doc.ref.set({
              channel: {
                id: channel.id,
                invite: invite.url
              }
            }, { merge: true });
          })
          .catch(console.error);
        })
        .catch(console.error);
    }
    if (change.type === 'modified') {
      console.log('Modified Lobby: ', change.doc.data());
    }
    if (change.type === 'removed') {
      console.log('Removed Lobby: ', change.doc.data());

      const channelId = change.doc.data().channel.id;
      client.channels.fetch(channelId)
        .then(channel => {
          channel.delete();
        })
        .catch(console.error);
    }
  });
}, err => {
  console.log(`Encountered error: ${err}`);
});




