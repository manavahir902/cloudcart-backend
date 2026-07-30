const { SQSClient } = require('@aws-sdk/client-sqs');

const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'ap-south-1' });

module.exports = sqsClient;