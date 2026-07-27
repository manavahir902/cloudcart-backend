const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// GET /api/products - list all products (with optional search/filter later)
router.get('/', productController.getAllProducts);

// GET /api/products/:id - single product detail
router.get('/:id', productController.getProductById);

// POST /api/products - admin only (we'll add auth middleware in Phase 12 with Cognito)
router.post('/', productController.createProduct);

module.exports = router;
