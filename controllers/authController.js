const {
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const cognitoClient = require('../config/cognito');
const pool = require('../config/db');

const CLIENT_ID = process.env.COGNITO_CLIENT_ID;

// POST /api/auth/register
// Cognito now owns password storage, hashing, and validation entirely -
// we never touch or see the raw password beyond this one SignUp call.
// We still insert a row into our own `users` table, but WITHOUT a password
// column - this row exists only to hold app-specific data (role, joins to
// orders) keyed by the Cognito user's identity.
exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }

  try {
    const signUpResult = await cognitoClient.send(new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'name', Value: name },
        { Name: 'email', Value: email },
      ],
    }));

    // Store app-specific data locally, linked by Cognito's "sub" (unique user id)
    await pool.query(
      'INSERT INTO users (name, email, cognito_sub) VALUES (?, ?, ?)',
      [name, email, signUpResult.UserSub]
    );

    res.status(201).json({
      message: 'Registered. Check your email for a verification code.',
      userSub: signUpResult.UserSub,
    });
  } catch (err) {
    // Cognito throws named errors like UsernameExistsException - surfacing
    // err.name gives the frontend something specific to react to, instead
    // of a generic 500.
    console.error(err);
    if (err.name === 'UsernameExistsException') {
      return res.status(409).json({ error: 'User already exists' });
    }
    res.status(500).json({ error: 'Registration failed', detail: err.name });
  }
};

// POST /api/auth/confirm
// New step that didn't exist in our old hand-rolled auth: Cognito emails a
// 6-digit code on signup, and the account is unusable until confirmed. This
// is the "email verification" Cognito gives us for free.
exports.confirm = async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'email and code are required' });
  }
  try {
    await cognitoClient.send(new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
    }));
    res.json({ message: 'Account confirmed. You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Confirmation failed', detail: err.name });
  }
};

// POST /api/auth/login
// Cognito's InitiateAuth handles the actual password check and issues its
// own tokens (AccessToken, IdToken, RefreshToken) - we just pass those back
// to the client. No more jsonwebtoken.sign() - Cognito is the token issuer now.
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const authResult = await cognitoClient.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }));

    res.json({
      accessToken: authResult.AuthenticationResult.AccessToken,
      idToken: authResult.AuthenticationResult.IdToken,
      refreshToken: authResult.AuthenticationResult.RefreshToken,
      expiresIn: authResult.AuthenticationResult.ExpiresIn,
    });
  } catch (err) {
    console.error(err);
    if (err.name === 'NotAuthorizedException' || err.name === 'UserNotFoundException') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (err.name === 'UserNotConfirmedException') {
      return res.status(403).json({ error: 'Please confirm your email first' });
    }
    res.status(500).json({ error: 'Login failed', detail: err.name });
  }
};