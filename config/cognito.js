const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');

// Same pattern as config/s3.js - no hardcoded credentials. This uses the
// cloudcart-ec2-role IAM role's cognito-idp permissions automatically.
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

module.exports = cognitoClient;