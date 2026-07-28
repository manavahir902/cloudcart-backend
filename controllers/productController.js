const pool = require('../config/db');

// NOTE: This now queries real MySQL on RDS instead of the in-memory array
// from Phase 6. The route signatures (routes/productRoutes.js) didn't need
// to change at all - that's the payoff of separating routes/controllers/data.

exports.getAllProducts = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

exports.createProduct = async (req, res) => {
  const { name, description, price, stock, category } = req.body;
  if (!name || !price) {
    return res.status(400).json({ error: 'name and price are required' });
  }
  try {
    // Using ? placeholders (parameterized queries) instead of string-concatenating
    // the request body directly into SQL. This is the standard defense against
    // SQL injection - never build queries with template literals from user input.
    const [result] = await pool.query(
      'INSERT INTO products (name, description, price, stock, category) VALUES (?, ?, ?, ?, ?)',
      [name, description || null, price, stock || 0, category || 'Uncategorized']
    );
    res.status(201).json({ id: result.insertId, name, price, stock, category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create product' });
  }
};
