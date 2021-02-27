const { App, ExpressReceiver } = require('@slack/bolt');
const serverlessExpress = require('@vendia/serverless-express');
const { login } = require("tplink-cloud-api");

let tplink;
const icons = {
  'On': 'large_green_circle',
  'Off': 'red_circle',
  'Offline': 'skull'
};
const colours = {
  'On': 'good',
  'Off': 'danger',
  'Offline': 'warning'
};

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

  console.log(deviceList);

  const attachments = await Promise.all(deviceList.map(async (device) => {
    const { alias, deviceId } = device;

    console.log(`Checking relay state for ${alias} (${deviceId})`);

    const hs100 = tplink.getHS100(deviceId);
    let status = 'Off';
    try {
      const relayState = await hs100.getRelayState();
      status = relayState ? 'On' : 'Off'
    } catch(e) {
      console.log(`Error getting relay state for ${alias}`, e.message);
      if (e.message === 'Device is offline') {
        status = 'Offline'
      }
    }

    console.log(alias, status);

    return {
      "text": `*${alias || deviceId}*: :${icons[status]}: ${status}`,
      "fallback": "Cannot manage devices",
      "callback_id": "toggle-device",
      "color": colours[status],
      "attachment_type": "default",
      "actions": status !== 'Offline' ? [
          {
              "name": "toggle-device",
              "text": `Turn ${status === 'On' ? 'Off' : 'On'}`,
              "type": "button",
              "value": `${deviceId}::${status === 'On' ? 'Off' : 'On'}`,
          }
      ] : []
    };
  }));

  console.log(attachments);

  await say({
    attachments,
  });
});

app.action({ callback_id: 'toggle-device' }, async ({ action, ack, say }) => {
  const [deviceId, targetState] = action.value.split('::');

  console.log(`Command received to turn ${alias} ${targetState}`);

  const tplink = await loginIfRequired();
  const hs100 = tplink.getHS100(deviceId);

  await ack();
  await hs100[targetState === 'On' ? 'powerOn' : 'powerOff']();

  const text = `Turned ${hs100.device.alias} ${targetState}`;

  await say({
    attachments: [
      {
        "text": text,
        "fallback": text,
        "color": 'good',
      },
    ],
  });
});

module.exports.handler = serverlessExpress({
  app: expressReceiver.app
});
