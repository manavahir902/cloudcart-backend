const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// NOTE: in-memory user store for tonight. Phase 9-10 swaps this for real
// MySQL user records, and Phase 12 swaps JWT entirely for Amazon Cognito
// (which handles password storage, resets, MFA etc. for you - this JWT
// version is here so you understand what Cognito is actually doing under the hood).
const users = [];

exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }

  const existing = users.find(u => u.email === email);
  if (existing) {
    return res.status(409).json({ error: 'User already exists' });
  }

  // Why hash the password: NEVER store plaintext passwords. bcrypt applies a
  // one-way hash with a random "salt" so even if your database leaks, the
  // actual passwords aren't recoverable.
  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = { id: users.length + 1, name, email, password: hashedPassword };
  users.push(newUser);

  res.status(201).json({ message: 'User registered', userId: newUser.id });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Why JWT: instead of the server keeping session state in memory, we issue
  // a signed token containing the user's identity. The client sends this
  // token on every request, the server verifies the signature - no server-side
  // session storage needed, which makes scaling to multiple EC2 instances
  // behind a load balancer much simpler (any instance can verify any token).
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET || 'dev-secret-change-this',
    { expiresIn: '2h' }
  );

  res.json({ token });
};
