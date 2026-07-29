const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const requireAuth = require('../middleware/authMiddleware');

// Every route here requires a valid Cognito access token - applied once at
// the router level rather than repeating requireAuth on each line below.
router.use(requireAuth);

router.post('/', orderController.createOrder);
router.get('/', orderController.getMyOrders);
router.get('/:id', orderController.getOrderById);
router.patch('/:id/cancel', orderController.cancelOrder);

module.exports = router;