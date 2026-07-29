const { SendEmailCommand } = require('@aws-sdk/client-ses');
const sesClient = require('../config/ses');

// Separated into its own util (not inline in the controller) because we'll
// likely need order-status-change emails too later (shipped, cancelled) -
// keeping email-sending logic in one place means we don't duplicate the
// SES boilerplate every time.
async function sendOrderConfirmationEmail(toEmail, order) {
  const itemsList = order.items
    .map(i => `- ${i.name} x${i.quantity} (₹${i.price_at_purchase} each)`)
    .join('\n');

  const command = new SendEmailCommand({
    Source: process.env.SES_SENDER_EMAIL, // must be a verified SES identity (Phase 13.1)
    Destination: { ToAddresses: [toEmail] },
    Message: {
      Subject: { Data: `CloudCart Order Confirmed - #${order.id}` },
      Body: {
        Text: {
          Data: `Thanks for your order!\n\nOrder #${order.id}\n\n${itemsList}\n\nTotal: ₹${order.total}\n\nWe'll notify you when it ships.`,
        },
      },
    },
  });

  // Deliberately NOT awaited by the caller in a blocking way that fails the
  // whole request if email sending fails - see orderController.js comment
  // on why order creation should succeed even if the email hiccups.
  await sesClient.send(command);
}

module.exports = sendOrderConfirmationEmail;