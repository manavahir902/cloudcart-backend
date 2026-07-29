const { S3Client } = require('@aws-sdk/client-s3');

// NOTE: No accessKeyId/secretAccessKey here on purpose. The AWS SDK
// automatically detects and uses the IAM role attached to this EC2 instance
// (cloudcart-ec2-role from Phase 5/11) via the instance metadata service.
// This is the same "never hardcode credentials" principle from Phase 1 -
// it applies to application code just as much as to your personal CLI.
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });

module.exports = s3Client;
