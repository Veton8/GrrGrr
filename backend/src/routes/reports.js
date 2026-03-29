const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { submitReport, getReports, updateReport } = require('../controllers/reportController');

// User-facing
router.post('/', authenticate, submitReport);

// Admin endpoints (protected by API key in server.js)
router.get('/admin', authenticate, getReports);
router.patch('/admin/:id', authenticate, updateReport);

module.exports = router;
