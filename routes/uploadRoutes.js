const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');

router.post('/presign', uploadController.getPresignedUploadUrl);
router.get('/view/:key', uploadController.getPresignedViewUrl);

module.exports = router;
