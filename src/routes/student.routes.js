const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

// Public routes for colleges
router.get('/colleges', studentController.getColleges);
router.get('/colleges/:id', studentController.getCollegeDetails);
router.post('/enquiries', studentController.submitEnquiry);

// Protected routes for students
router.post('/student/applications', authMiddleware, allowRoles('student'), studentController.createApplication);
router.get('/student/applications', authMiddleware, allowRoles('student'), studentController.getMyApplications);
router.get('/student/profile', authMiddleware, allowRoles('student'), studentController.getProfile);
router.put('/student/profile', authMiddleware, allowRoles('student'), studentController.updateProfile);

module.exports = router;
