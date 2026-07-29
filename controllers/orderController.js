const pool = require('../config/db');
const sendOrderConfirmationEmail = require('../utils/sendOrderEmail');

// Helper: look up our internal MySQL user id from the Cognito identity
// attached to req.user by authMiddleware. Every order-related query needs
// this, so it's factored out rather than repeated in each function.
async function getLocalUserId(cognitoSub) {
  const [rows] = await pool.query('SELECT id FROM users WHERE cognito_sub = ?', [cognitoSub]);
  if (rows.length === 0) return null;
  return rows[0].id;
}

// POST /api/orders
// Body: { items: [{ productId, quantity }], shippingAddress }
exports.createOrder = async (req, res) => {
  const { items, shippingAddress } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }

  const connection = await pool.getConnection();
  try {
    const userId = await getLocalUserId(req.user.cognitoSub);
    if (!userId) {
      return res.status(404).json({ error: 'User record not found' });
    }

    // Why a transaction: an order involves multiple writes (orders row +
    // multiple order_items rows + stock decrements). If step 3 of 5 fails
    // partway through, we do NOT want half an order sitting in the database -
    // a transaction lets us roll everything back atomically on any failure.
    await connection.beginTransaction();

    let total = 0;
    const itemDetails = [];

    for (const item of items) {
      const [productRows] = await connection.query(
        'SELECT * FROM products WHERE id = ? FOR UPDATE', // FOR UPDATE locks the row to prevent a race condition where two simultaneous orders both read stale stock
        [item.productId]
      );
      if (productRows.length === 0) {
        throw new Error(`Product ${item.productId} not found`);
      }
      const product = productRows[0];
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      total += product.price * item.quantity;
      itemDetails.push({
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        price_at_purchase: product.price,
      });

      await connection.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, product.id]
      );
    }

    const [orderResult] = await connection.query(
      'INSERT INTO orders (user_id, status, total, shipping_address) VALUES (?, ?, ?, ?)',
      [userId, 'pending', total, shippingAddress || '']
    );
    const orderId = orderResult.insertId;

    for (const item of itemDetails) {
      await connection.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)',
        [orderId, item.productId, item.quantity, item.price_at_purchase]
      );
    }

    await connection.commit();

    // Email is sent AFTER commit, and its failure doesn't fail the request.
    // Why: the order is already successfully placed and paid-for (in real
    // flow) by this point - a flaky email shouldn't make the customer think
    // their order failed when it didn't. We log the error instead.
    sendOrderConfirmationEmail(req.user.email, { id: orderId, total, items: itemDetails })
      .catch(err => console.error('Order confirmation email failed:', err));

    res.status(201).json({ orderId, total, status: 'pending' });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to create order' });
  } finally {
    connection.release();
  }
};

// GET /api/orders
exports.getMyOrders = async (req, res) => {
  try {
    const userId = await getLocalUserId(req.user.cognitoSub);
    if (!userId) return res.status(404).json({ error: 'User record not found' });

    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

// GET /api/orders/:id
exports.getOrderById = async (req, res) => {
  try {
    const userId = await getLocalUserId(req.user.cognitoSub);
    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const [items] = await pool.query(
      'SELECT oi.*, p.name FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?',
      [req.params.id]
    );
    res.json({ ...orders[0], items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
};

// PATCH /api/orders/:id/cancel
exports.cancelOrder = async (req, res) => {
  try {
    const userId = await getLocalUserId(req.user.cognitoSub);
    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (orders[0].status !== 'pending') {
      return res.status(400).json({ error: 'Only pending orders can be cancelled' });
    }
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', req.params.id]);
    res.json({ message: 'Order cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
};