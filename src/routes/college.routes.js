const express = require('express');
const router = express.Router();
const collegeController = require('../controllers/college.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const upload = require('../middleware/upload.middleware');

// Protect all college routes
router.use(authMiddleware);
router.use(allowRoles('college'));

router.get('/profile', collegeController.getProfile);
router.put('/profile', collegeController.updateProfile);
router.post('/brochure', upload.single('brochure'), collegeController.uploadBrochure);
router.post('/logo', upload.single('logo'), collegeController.uploadLogo);
router.post('/cover', upload.single('cover'), collegeController.uploadCoverPhoto);
router.get('/applications', collegeController.getApplications);
router.put('/application-status/:id', collegeController.updateApplicationStatus);

module.exports = router;
