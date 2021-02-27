const { App, ExpressReceiver } = require('@slack/bolt');
const serverlessExpress = require('@vendia/serverless-express');
const { login } = require("tplink-cloud-api");

let tplink;

const loginIfRequired = async () => {
  if (!tplink) {
    console.log('Logging in with TPLink');
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
  const tplink = await loginIfRequired();

  console.log('Getting Device List');

  const deviceList = await tplink.getDeviceList();

  await say({
    "attachments": deviceList.map(device => {
      const { status, alias, deviceId } = device;

      const hs100 = tplink.getHS100(deviceId);
      const relayState = await hs100.getRelayState();
      console.log(alias, relayState);
      return {
        "text": `*${alias || deviceId}*: :${status ? 'large_green_circle' : 'red_circle'}: ${status ? 'On' : 'Off'}`,
        "fallback": "Cannot manage devices",
        "callback_id": "toggle-device",
        "color": status ? 'ok' : 'danger',
        "attachment_type": "default",
        "actions": [
            {
                "name": "toggle-device",
                "text": `Turn ${status ? 'Off' : 'On'}`,
                "type": "button",
                "value": `${deviceId}::${status ? 'Off' : 'On'}`,
            }
        ]
      };
    }),
  });
});

app.action({ callback_id: 'toggle-device' }, async ({ body, action, ack, say }) => {
  console.log(body);
  // await say(`<@${body.user.id}> clicked the button`);

  // Acknowledge the action after say() to exit the Lambda process
  await ack();
});

module.exports.handler = serverlessExpress({
  app: expressReceiver.app
});
