const http = require('http');
const hostname = '127.0.0.1';
const port = 3000;
const admin = require('firebase-admin');
const serviceAccount = require('./secrets/firebase.json');

const discordGuildId = '821785285423136788';
const discordLobbyId = "830778236933242930";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const loobyDoc = db.collection('Lobbies');
const fbDiscordDoc = db.collection('Discord');

const Discord = require('discord.js');
const client = new Discord.Client();


client.once('ready', () => {
	console.log('Ready!');
});

client.login(require("./secrets/discord.json").token);

var inviteCache = {};

const guilds = client.guilds;
// .get('821785285423136788');
let guild = null;
guilds.fetch(discordGuildId).then(guildParam => {
  console.log(guildParam.name);
  guild = guildParam;
  guild.fetchInvites().then(guildInvites => {
    inviteCache[guild.id] = guildInvites;
  });
})
.catch(console.error);

let lobbyChannel = null;
client.channels.fetch(discordLobbyId).then(lobbyChan => {
  lobbyChannel = lobbyChan;
})
.catch(console.error);;

client.on('guildMemberAdd', member => {
  // To compare, we need to load the current invite list.
  member.guild.fetchInvites().then(guildInvites => {
    // This is the *existing* invites for the guild.
    const ei = inviteCache[member.guild.id];
    // Update the cached invites for the guild.
    inviteCache[member.guild.id] = guildInvites;
    // Look through the invites, find the one for which the uses went up.
    const invite = guildInvites.find(i => ei.get(i.code).uses < i.uses);

    if (invite === undefined) {
      return;
    }

    const userId = member.id;

    fbDiscordDoc.where('discordInvite', '==', invite.url).get().then(snapshot => {
      if (snapshot.empty) {
        console.log('No matching documents.');
        return;
      }  
      snapshot.forEach(doc => {
        doc.ref.set({
          discordUserId: userId,
          discordName: member.displayName
        }, { merge: true })
      });    
    }).catch();
  });
});

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World');
});

setInterval(() => {
  //console.log(JSON.stringify(inviteCache));
  if (inviteCache !== undefined) {
    console.log("LALALALA", Object.values(inviteCache)[0])
  }
}, 60000);

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

fbDiscordDoc.onSnapshot(docSnapshot => {
  docSnapshot.docChanges().forEach(change => {
    if (guild === null) return;
    if (change.type === 'added') {
      console.log('Added Discord Entry: ', change.doc.data());
      lobbyChannel.createInvite()
          .then(invite => {
            console.log(`Created an invite with a code of ${invite.code} and url ${invite.url}`);
            inviteCache[guild.id][invite.code] = invite;
            change.doc.ref.set({
              discordInvite: invite.url
            }, { merge: true });
          })
          .catch(console.error);

    }
    if (change.type === 'modified') {
      console.log('Modified Discord Entry: ', change.doc.data());
    }
    if (change.type === 'removed') {
      console.log('Removed Discord Entry: ', change.doc.data());
    }
  })}, err => {
    console.log(`Encountered error: ${err}`);
  });

  const channelCache = {};

  const addToChannel = (channelId, userId) => {
    const userExists = channelCache[channelId][userId];
    if (!userExists) {
      channelCache[channelId][userId] = true;
      
    }
  }

loobyDoc.onSnapshot(docSnapshot => {
  docSnapshot.docChanges().forEach(change => {
    if (guild === null) return;
    if (change.type === 'added') {
      console.log('New Lobby: ', change.doc.data());
      const lobbyData = change.doc.data()
      guild.channels.create(`${lobbyData?.host?.name}'s Lobby`, { reason: 'Players', type: "voice" })
        .then(channel => {
          change.doc.ref.set({
            channel: {
              id: channel.id,
            }
          }, { merge: true });
          channelCache[channel.id] = {};
          const players = Object.keys(lobbyData.players);
          players?.forEach( id => {
            channelCache[channel.id][id] = { moved: false };
          }); 

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




