/**
 * @file src/api/v1/routes/adminUser.routes.ts
 * @description Defines API routes for non-superadmin user management (by superadmin).
 */

import { Router } from 'express';
import { Designation } from '@prisma/client';
import {
  getAllAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  softDeleteAdmin,
} from '../../../controllers/adminUser/adminUser.controller';
import { isAuthenticated, authorizeRoles } from '../../../middlewares/auth.middleware';

const router = Router();

// All routes require superadmin
router.use(isAuthenticated, authorizeRoles(Designation.SUPER_ADMIN));

router.get('/', getAllAdmins);
router.get('/:id', getAdminById);
router.post('/', createAdmin);
router.patch('/:id', updateAdmin);
router.delete('/:id', softDeleteAdmin);

export default router;
