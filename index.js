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
    }
    if (change.type === 'removed') {
    }
  })}, err => {
    console.log(`Encountered error: ${err}`);
  });

  const channelCache = {};

  const addToChannel = (channelId, userId, channel) => {
    const userExists = channelCache[channelId][userId];
    if (userExists === undefined) {
      fbDiscordDoc.doc(userId).get().then(doc => {
        if (!doc?.exists) {
          return;
        }
        const user = doc.data();
        const discordId = user?.discordUserId;
        channelCache[channelId][userId] = discordId || 0;
        if (!discordId) {
          return;
        }
        guild.members.fetch(discordId).then(user => {
            user.voice.setChannel(channel);
        }).catch();
      }).catch();
    }
  }

  const removeFromChannel = (userId, channelId, channel) => {
    delete channelCache[channelId][userId];
    if (Object.keys(channelCache[channelId]).length === 0) {
      channel.delete();
    }
  }

loobyDoc.onSnapshot(docSnapshot => {
  docSnapshot.docChanges().forEach(change => {
    if (guild === null) return;
    if (change.type === 'added') {
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
            addToChannel(channel?.id, id, channel);
          }); 

        })
        .catch(console.error);
    }
    if (change.type === 'modified') {
      const lobbyData = change.doc.data()
      const channelId = change.doc.data().channel?.id;
      client.channels.fetch(channelId)
        .then(channel => {
          const cachedPlayers = Object.keys(channelCache[channelId]);
          const players = Object.keys(lobbyData.players);
          const disconnectedPlayer = cachedPlayers.filter(player => !players.includes(player));
          disconnectedPlayer.forEach(id => { removeFromChannel(id, channelId, channel); });
          players?.forEach( id => {
            addToChannel(channelId, id, channel);
          }); 
        })
        .catch(console.error);
    }
    if (change.type === 'removed') {
      const channelId = change.doc.data().channel.id;
      const userIds = Object.keys(channelCache[channelId]);
      client.channels.fetch(channelId)
        .then(channel => {
          userIds.forEach(id => {
            const discordId = channelCache[channelId][id];
            console.log(discordId);
            if (discordId === 0) {
              removeFromChannel(id, channelId, channel);
              return;
            }
            guild.members.fetch(discordId).then(user => {
              user.voice.setChannel(lobbyChannel).then(() => removeFromChannel(id, channelId, channel)).catch(console.error);
            }).catch(console.error);
          });
         })
      .catch(console.error);
    }
  });
}, err => {
  console.log(`Encountered error: ${err}`);
});




