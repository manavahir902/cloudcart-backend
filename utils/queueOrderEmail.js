const { SendMessageCommand } = require('@aws-sdk/client-sqs');
const sqsClient = require('../config/sqs');

// Replaces the direct SES call in orderController.js. The controller's job
// now ends the moment this message is queued (near-instant) - it no longer
// waits on, or even knows about, SES at all. A separate Lambda (Phase 14
// continued) picks this message up and does the actual sending.
async function queueOrderConfirmationEmail(toEmail, order) {
  const command = new SendMessageCommand({
    QueueUrl: process.env.SQS_ORDER_QUEUE_URL,
    MessageBody: JSON.stringify({
      type: 'ORDER_CONFIRMATION',
      toEmail,
      order,
    }),
  });
  await sqsClient.send(command);
}

module.exports = queueOrderConfirmationEmail;