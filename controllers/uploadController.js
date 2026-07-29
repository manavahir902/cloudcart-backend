const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { randomUUID } = require('crypto');
const s3Client = require('../config/s3');

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// POST /api/uploads/presign
// The client calls this FIRST to get a temporary upload URL, then uploads
// the actual file bytes directly to S3 using that URL - our server never
// sees or handles the image data itself.
exports.getPresignedUploadUrl = async (req, res) => {
  try {
    const { fileType } = req.body; // e.g. "image/jpeg"
    if (!fileType || !fileType.startsWith('image/')) {
      return res.status(400).json({ error: 'A valid image fileType is required' });
    }

    // Unique key so two users uploading "photo.jpg" at the same time never collide
    const key = `products/${randomUUID()}-${Date.now()}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    // expiresIn: 300 = this URL is only valid for 5 minutes. Why so short?
    // A pre-signed URL grants upload permission to whoever holds the link.
    // A short expiry means even if it leaked (browser history, logs), the
    // window for misuse is small. The client should request a fresh one
    // right before uploading, not cache it.
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    res.json({ uploadUrl, key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
};

// GET /api/uploads/view/:key
// Similarly, since the bucket blocks all public access, viewing an image
// also goes through a short-lived signed URL rather than a public link.
// (In Phase 17 we'll replace this pattern with CloudFront for public-facing
// product images, which is faster and doesn't need per-request signing -
// this presigned GET pattern remains useful for private content later.)
exports.getPresignedViewUrl = async (req, res) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: req.params.key,
    });
    const viewUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    res.json({ viewUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate view URL' });
  }
};
