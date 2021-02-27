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
  const tplink = await loginIfRequired();
  const deviceList = await tplink.getDeviceList();

  await say({
    "callback_id": "toggle-device",
    blocks: deviceList.flatMap(({ status, alias, deviceId }) => {
      return [
				{
					"type": "section",
					"text": {
						"type": "mrkdwn",
						"text": `*${alias || deviceId}*: :${status ? 'large_green_circle' : 'red_circle'}: ${status ? 'On' : 'Off'}`
					}
				},
				{
					"type": "actions",
					"elements": [
						{
							"type": "button",
							"text": {
								"type": "plain_text",
								"text": `Turn ${status ? 'Off' : 'On'}`
							},
							"value": `${deviceId}::${status ? 'Off' : 'On'}`
						}
					]
				},
				{
					"type": "divider"
				},
      ];
    }),
  });
});

app.action({ callback_id: 'toggle-device' }, async ({ body, ack, say }) => {
  console.log(body);
  // await say(`<@${body.user.id}> clicked the button`);

  // Acknowledge the action after say() to exit the Lambda process
  await ack();
});

module.exports.handler = serverlessExpress({
  app: expressReceiver.app
});
