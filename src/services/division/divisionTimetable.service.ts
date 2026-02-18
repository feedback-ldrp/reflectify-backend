/**
 * @file src/services/division/divisionTimetable.service.ts
 * @description Service for fetching division timetable data (day/slot grid).
 */

import { prisma } from '../common/prisma.service';

class DivisionTimetableService {
  /**
   * Get timetable data for a specific division.
   */
  public async getTimetableByDivisionId(divisionId: string) {
    const timetable = await prisma.divisionTimetable.findUnique({
      where: { divisionId, isDeleted: false },
    });
    return timetable;
  }

  /**
   * Get all timetables (optionally filtered by division IDs).
   */
  public async getAllTimetables() {
    const timetables = await prisma.divisionTimetable.findMany({
      where: { isDeleted: false },
      include: {
        division: {
          include: {
            semester: true,
            department: true,
          },
        },
      },
    });
    return timetables;
  }
}

export const divisionTimetableService = new DivisionTimetableService();
