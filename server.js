require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();

// ---- Middleware ----
app.use(helmet());                 // secure HTTP headers
app.use(cors());                   // allow frontend to call this API (we'll restrict origin later)
app.use(express.json());           // parse JSON request bodies
app.use(morgan('combined'));       // log every request

// ---- Health check route ----
// Why this matters: the ALB (Phase 7) will hit this endpoint constantly to check
// "is this server alive?" before sending it real traffic. Without it, the load
// balancer has no way to know if an instance is healthy or should be taken out of rotation.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- API routes ----
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/uploads', uploadRoutes);

// ---- 404 handler ----
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ---- Global error handler ----
// Why: without this, an unhandled error in any route crashes the whole process.
// This catches errors and returns a clean response instead of taking the server down.
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CloudCart backend running on port ${PORT}`);
});
