const { GetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const cognitoClient = require('../config/cognito');

// Protects routes that require a logged-in user (orders, profile, etc).
// The client sends the accessToken (from login) in the Authorization header
// as "Bearer <token>". We ask Cognito to verify it and tell us who it belongs
// to - we never decode/trust the token ourselves, Cognito is the source of truth.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const accessToken = authHeader.split(' ')[1];

  try {
    const result = await cognitoClient.send(new GetUserCommand({
      AccessToken: accessToken,
    }));

    // Cognito returns user attributes as an array of {Name, Value} pairs -
    // reshape into a plain object so controllers can just do req.user.email
    const attributes = {};
    result.UserAttributes.forEach(attr => {
      attributes[attr.Name] = attr.Value;
    });

    req.user = {
      email: attributes.email,
      cognitoSub: attributes.sub,
    };

    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = requireAuth;