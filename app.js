const { App, ExpressReceiver } = require('@slack/bolt');
const serverlessExpress = require('@vendia/serverless-express');
const { login } = require("tplink-cloud-api");

let tplink;

const loginIfRequired = async () => {
  if (!tplink) {
    tplink = await login(process.env.KASA_USERNAME, process.env.KASA_PASSWORD);
  }

  return tplink;
};

// Initialize your custom receiver
const expressReceiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: expressReceiver
});

app.message('list devices', async ({ say }) => {
  console.log('HELLO WORLD')
});


module.exports.handler = serverlessExpress({
  app: expressReceiver.app
});
