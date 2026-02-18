/**
 * @file src/controllers/division/divisionTimetable.controller.ts
 * @description Controller for Division Timetable operations.
 */

import { Request, Response } from 'express';
import { divisionTimetableService } from '../../services/division/divisionTimetable.service';
import asyncHandler from '../../utils/asyncHandler';
import AppError from '../../utils/appError';

/**
 * Get timetable data for a specific division.
 * GET /divisions/:divisionId/timetable
 */
export const getDivisionTimetable = asyncHandler(
  async (req: Request, res: Response) => {
    const { divisionId } = req.params;

    if (!divisionId) {
      throw new AppError('Division ID is required.', 400);
    }

    const timetable =
      await divisionTimetableService.getTimetableByDivisionId(divisionId);

    res.status(200).json({
      status: 'success',
      data: {
        timetable: timetable,
      },
    });
  }
);

/**
 * Get all timetables.
 * GET /division-timetables
 */
export const getAllTimetables = asyncHandler(
  async (_req: Request, res: Response) => {
    const timetables = await divisionTimetableService.getAllTimetables();

    res.status(200).json({
      status: 'success',
      results: timetables.length,
      data: {
        timetables: timetables,
      },
    });
  }
);
