/**
 * @file src/controllers/adminUser/adminUser.controller.ts
 * @description Controller for non-superadmin user management (by superadmin).
 */

import { Request, Response } from 'express';
import { prisma } from '../../services/common/prisma.service';
import asyncHandler from '../../utils/asyncHandler';
import AppError from '../../utils/appError';
import { Designation } from '@prisma/client';
import { hashPassword } from '../../utils/hash';

export const getAllAdmins = asyncHandler(async (_req: Request, res: Response) => {
  // Exclude superadmins
  const admins = await prisma.admin.findMany({
    where: { isSuper: false, isDeleted: false },
    select: { id: true, name: true, email: true, designation: true, createdAt: true, updatedAt: true },
  });
  res.status(200).json({ status: 'success', data: admins });
});

export const getAdminById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const admin = await prisma.admin.findUnique({
    where: { id, isSuper: false, isDeleted: false },
    select: { id: true, name: true, email: true, designation: true, createdAt: true, updatedAt: true },
  });
  if (!admin) throw new AppError('Admin not found.', 404);
  res.status(200).json({ status: 'success', data: admin });
});

export const createAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, designation } = req.body;
  if (!Object.values(Designation).includes(designation)) {
    throw new AppError('Invalid designation.', 400);
  }
  const hashedPassword = await hashPassword(password);
  const admin = await prisma.admin.create({
    data: { name, email, password: hashedPassword, designation, isSuper: false },
    select: { id: true, name: true, email: true, designation: true, createdAt: true, updatedAt: true },
  });
  res.status(201).json({ status: 'success', data: admin });
});

export const updateAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, password, designation } = req.body;
  const updateData: any = {};
  if (name) updateData.name = name;
  if (email) updateData.email = email;
  if (designation) {
    if (!Object.values(Designation).includes(designation)) {
      throw new AppError('Invalid designation.', 400);
    }
    updateData.designation = designation;
  }
  if (password) updateData.password = await hashPassword(password);
  const admin = await prisma.admin.update({
    where: { id, isSuper: false, isDeleted: false },
    data: updateData,
    select: { id: true, name: true, email: true, designation: true, createdAt: true, updatedAt: true },
  });
  res.status(200).json({ status: 'success', data: admin });
});

export const softDeleteAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.admin.update({ where: { id, isSuper: false }, data: { isDeleted: true } });
  res.status(204).json({ status: 'success', data: null });
});
