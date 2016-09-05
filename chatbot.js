const Faye = require('faye');
const request = require('request');

const config = require('./config');
const joker = require('./services/jokeService.js');
const wiki = require('./services/wikiService');
const weather = require('./services/weatherService');
const places = require('./services/mapService');
const morejokes = require('./services/morejokes');

const ROOM_ID  = config.roomId;
const TOKEN   = config.token;

const DEPLOY_FLAG = process.env.DEPLOY || false;

const META_HANDSHAKE_SUFFIX_URL = '/meta/handshake';
const FAYE_CLIENT_URL = 'https://ws.gitter.im/faye';
const SERVER_PREFIX_URL = "http://127.0.0.1:5000";
const SERVER_DEPLOY_URL = `${SERVER_PREFIX_URL}/deploy`;
const SERVER_HOWDOI_PREFIX_URL = `${SERVER_PREFIX_URL}/howdoi?query=`;
const CHATROOM_SUFFIX_URL = `/v1/rooms/${ROOM_ID}/chatMessages`;
const CHATROOM_URL = `https://api.gitter.im${CHATROOM_SUFFIX_URL}`;

const BOT_MENTION_NAME = '@osdc-bot';
const BOT_ACTIONS = {
  HELP: 'help',
  JOKE: 'joke',
  DEPLOY: 'deploy',
  HOWDOI: 'howdoi',
  WIKI : 'wiki',
  WEATHER: 'weather',
  PLACES: 'locate',
  MOREJOKES : 'morejokes'
};

// Authentication extension
var ClientAuthExt = function() {};

ClientAuthExt.prototype.outgoing = (message, callback) => {
  if (message.channel === META_HANDSHAKE_SUFFIX_URL) {
    if (!message.ext) { message.ext = {}; }
    message.ext.token = TOKEN;
  }
  callback(message);
};

ClientAuthExt.prototype.incoming = (message, callback) => {
  if(message.channel === META_HANDSHAKE_SUFFIX_URL) {
    if(message.successful) {
      console.log('Successfuly subscribed to room: ', ROOM_ID);
      if (DEPLOY_FLAG) {
        send("Deployment Successful");
      }
    } else {
      console.log('Something went wrong: ', message.error);
    }
  }
  callback(message);
};

// Faye client
const client = new Faye.Client(FAYE_CLIENT_URL, {
  timeout: 60,
  retry: 5,
  interval: 1
});

// Add Client Authentication extension
client.addExtension(new ClientAuthExt());

// A dummy handler to echo incoming messages
const messageHandler = (msg) => {
  if (msg.model && msg.model.fromUser) {
    console.log("Message: ", msg.model.text);
    console.log("From: ", msg.model.fromUser.displayName);

    reply_to_user(msg.model.fromUser, msg.model.text);
  }
};

function _getStartsWith(parsedMessage) {
  var result = null;
  for (var botAction in BOT_ACTIONS) {
    if (parsedMessage.startsWith(BOT_ACTIONS[botAction])) {
      result = BOT_ACTIONS[botAction];
      console.log(`[INFO] In loop ${result}`);
      break;
    }
  }
  return result;
}

function _getBotHelp() {
  var resultString = "You can:";
  for (var botAction in BOT_ACTIONS) {
    resultString += `\n- ${BOT_ACTIONS[botAction]}`;
  }
  return resultString;
}

function reply_to_user(user, message) {
  const displayName = user.displayName;
  const username = user.username;
  if (message.startsWith(BOT_MENTION_NAME)) {
    const parsedMessage = message.slice(BOT_MENTION_NAME.length + 1);
    const startsWithString = _getStartsWith(parsedMessage);
    const cityName = parsedMessage.substr(parsedMessage.indexOf(' ')+1);
    if (startsWithString === BOT_ACTIONS.HELP) {
      send(_getBotHelp(), username);
    }

    if (startsWithString === BOT_ACTIONS.JOKE) {
      joker.getJoke(send, username);
    }

    if (startsWithString === BOT_ACTIONS.DEPLOY) {
      request({
        url: SERVER_DEPLOY_URL,
        method: "GET"
      }, (error, response, body) => {
      });
    }

    if (startsWithString === BOT_ACTIONS.HOWDOI) {
      var query = encodeURIComponent(parsedMessage.slice(7, parsedMessage.length));
      request({
        url: SERVER_HOWDOI_PREFIX_URL + query,
        method: "GET"
      }, (error, response, body) => {
        send(body);
      });
    }

    if (startsWithString === BOT_ACTIONS.WIKI) {
      var requestedData = parsedMessage.slice(5, parsedMessage.length);
      wiki(send, username, requestedData);
    }

    if (startsWithString === BOT_ACTIONS.WEATHER) {
      weather.getWeather(send, username, cityName);
    }

    if (startsWithString === BOT_ACTIONS.PLACES) {
      places.getPlaces(send, username, cityName);
    }

    if (startsWithString === BOT_ACTIONS.MOREJOKES) {
      morejokes.getMorejokes(send, username);
    }
  }
}

function _postOnChat(message) {
  request({
    url: CHATROOM_URL,
    headers: {
      Authorization : `Bearer ${TOKEN}`
    },
    method: "POST",
    json: true,
    body: {
      text: message
    }
  }, (error, response, body) => {
  });
}

function send(message, username) {
  _postOnChat(username ? `@${username} ${message}` : message);
}

client.subscribe(`/api${CHATROOM_SUFFIX_URL}`, messageHandler, {});
