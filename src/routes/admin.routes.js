const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const upload = require('../middleware/upload.middleware');

// Protect all admin routes
router.use(authMiddleware);
router.use(allowRoles('admin'));

router.post('/create-college-account', adminController.createCollegeAccount);
router.get('/colleges', adminController.getColleges);
router.put('/approve-college/:id', adminController.approveCollege);
router.get('/students', adminController.getStudents);
router.get('/applications', adminController.getApplications);
router.get('/stats', adminController.getSystemStats);
router.get('/users', adminController.getAllUsers);
router.put('/users/:id/ban', adminController.banUser);
router.put('/users/:id/unban', adminController.unbanUser);
router.delete('/users/:id', adminController.deleteUser);
router.put('/applications/:id/status', adminController.updateApplicationStatus);
router.get('/enquiries', adminController.getEnquiries);

// Route for Admins to view/edit specific college profiles directly
router.get('/college/:id', adminController.getCollegeDetails);
router.put('/college/:id', adminController.updateCollegeDetails);
router.post('/college/:id/logo', upload.single('logo'), adminController.uploadCollegeLogo);
router.post('/college/:id/cover', upload.single('cover'), adminController.uploadCollegeCover);
router.post('/college/:id/brochure', upload.single('brochure'), adminController.uploadCollegeBrochure);

module.exports = router;
