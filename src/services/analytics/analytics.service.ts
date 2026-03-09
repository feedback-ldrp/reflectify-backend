/**
 * @file src/services/analytics/analytics.service.ts
 * @description Service layer for feedback analytics operations.
 * Encapsulates business logic and interacts with the Prisma client.
 */

import { Prisma, LectureType } from '@prisma/client';
import { prisma } from '../common/prisma.service';
import AppError from '../../utils/appError';
import {
  OptimizedAnalyticsResponse,
  SubjectDetailedAnalytics,
  FacultyDetailedAnalytics,
  DivisionDetailedAnalytics,
  AcademicYearDetailedAnalytics,
  SubjectRatingAggregated,
  FacultyPerformanceAggregated,
  DivisionPerformanceAggregated,
  AcademicYearTrendAggregated,
  SemesterTrendAggregated,
  DepartmentTrendAggregated,
  OverallStats,
  SubjectFacultyPerformanceAggregated,
  BatchComparisonAggregated,
  AcademicYearDivisionTrendAggregated,
} from './analytics.interfaces';

interface OverallSemesterRatingOutput {
  semesterId: string;
  averageRating: number;
  totalResponses: number;
}

interface SemesterWithResponsesOutput {
  id: string;
  semesterNumber: number;
  departmentId: string;
  academicYear: {
    id: string;
    yearString: string;
  };
  department: {
    id: string;
    name: string;
    abbreviation: string;
  };
  responseCount: number;
}

interface SubjectWiseRatingOutput {
  subject: string;
  lectureType: LectureType;
  averageRating: number;
  responseCount: number;
}

interface HighImpactFeedbackAreaOutput {
  question: string;
  category: string;
  faculty: string;
  subject: string;
  lowRatingCount: number;
  averageRating: number;
}

interface SemesterTrendAnalysisOutput {
  semester: number;
  subject: string;
  averageRating: number;
  responseCount: number;
  academicYearId?: string;
  academicYear?: string;
}

interface AnnualPerformanceTrendOutput {
  year: number;
  averageRating: number;
  completionRate: number;
}

interface DivisionBatchComparisonOutput {
  division: string;
  batch: string;
  averageRating: number;
  responseCount: number;
}

interface LabLectureComparisonOutput {
  lectureType: LectureType;
  averageRating: number;
  responseCount: number;
  formCount: number;
}

interface FacultyPerformanceYearDataOutput {
  Faculty_name: string;
  academic_year: string;
  total_average: number | null;
  total_responses?: number; // Add total responses field
  [key: string]: string | number | null | undefined;
}

interface AllFacultyPerformanceDataOutput {
  academic_year: string;
  faculties: Array<FacultyPerformanceYearDataOutput & { facultyId: string }>;
}

interface SemesterDivisionDetails {
  divisionId: string;
  divisionName: string;
  studentCount: number;
  responseCount: number;
}

interface SemesterDivisionResponseOutput {
  semesterId: string;
  semesterNumber: number;
  academicYear: {
    id: string;
    yearString: string;
  };
  divisions: SemesterDivisionDetails[];
}

interface FilterDictionaryOutput {
  academicYears: Array<{
    id: string;
    yearString: string;
    departments: Array<{
      id: string;
      name: string;
      abbreviation: string;
      subjects: Array<{
        id: string;
        name: string;
        code: string;
        type: string;
      }>;
      semesters: Array<{
        id: string;
        semesterNumber: number;
        divisions: Array<{
          id: string;
          divisionName: string;
        }>;
      }>;
    }>;
  }>;
  lectureTypes: Array<{
    value: LectureType;
    label: string;
  }>;
}

interface CompleteAnalyticsDataOutput {
  semesters: Array<{
    id: string;
    semesterNumber: number;
    departmentId: string;
    academicYearId: string;
    startDate: string | null;
    endDate: string | null;
    semesterType: string;
    department: {
      id: string;
      name: string;
      abbreviation: string;
    };
    academicYear: {
      id: string;
      yearString: string;
    };
    responseCount: number;
  }>;
  subjectRatings: Array<{
    subjectId: string;
    subjectName: string;
    subjectAbbreviation: string;
    lectureType: LectureType;
    averageRating: number;
    responseCount: number;
    semesterNumber: number;
    academicYearId: string;
    facultyId: string;
    facultyName: string;
  }>;
  semesterTrends: Array<{
    subject: string;
    semester: number;
    averageRating: number;
    responseCount: number;
    academicYearId: string;
    academicYear: string;
  }>;
  feedbackSnapshots: Array<{
    id: string;
    academicYearId: string;
    academicYearString: string;
    departmentId: string;
    departmentName: string;
    departmentAbbreviation: string;
    semesterId: string;
    semesterNumber: number;
    divisionId: string;
    divisionName: string;
    subjectId: string;
    subjectName: string;
    subjectAbbreviation: string;
    subjectCode: string;
    facultyId: string;
    facultyName: string;
    facultyAbbreviation: string;
    studentId: string | null;
    studentEnrollmentNumber: string;
    formId: string;
    formStatus: string;
    questionId: string;
    questionType: string;
    questionCategoryId: string;
    questionCategoryName: string;
    questionBatch: string;
    responseValue: any;
    batch: string;
    submittedAt: string;
    createdAt: string;
  }>;
}

class AnalyticsService {
  // Helper function to group an array of objects by a specified key.
  private groupBy<T>(
    array: T[],
    key: (item: T) => string
  ): Record<string, T[]> {
    return array.reduce(
      (groups, item) => {
        const groupKey = key(item);
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(item);
        return groups;
      },
      {} as Record<string, T[]>
    );
  }

  // Helper function to parse raw response value into a numeric score.
  private parseResponseValueToScore(rawResponseValue: any): number | null {
    let score: number | null = null;

    if (typeof rawResponseValue === 'string') {
      const parsedFloat = parseFloat(rawResponseValue);
      if (!isNaN(parsedFloat)) {
        score = parsedFloat;
      } else {
        try {
          const parsedJson = JSON.parse(rawResponseValue);
          if (
            typeof parsedJson === 'object' &&
            parsedJson !== null &&
            'score' in parsedJson &&
            typeof (parsedJson as any).score === 'number'
          ) {
            score = (parsedJson as any).score;
          } else if (typeof parsedJson === 'number') {
            score = parsedJson;
          }
        } catch (e) {
          // console.warn(`Could not parse rawResponseValue as JSON string: ${rawResponseValue}`);
        }
      }
    } else if (
      typeof rawResponseValue === 'object' &&
      rawResponseValue !== null &&
      'score' in rawResponseValue &&
      typeof (rawResponseValue as any).score === 'number'
    ) {
      score = (rawResponseValue as any).score;
    } else if (typeof rawResponseValue === 'number') {
      score = rawResponseValue;
    }

    return typeof score === 'number' && !isNaN(score) ? score : null;
  }

  // Calculates the overall average rating for a specific semester.
  public async getOverallSemesterRating(
    semesterId: string,
    divisionId?: string,
    batch?: string
  ): Promise<OverallSemesterRatingOutput> {
    try {
      const whereClause: Prisma.StudentResponseWhereInput = {
        isDeleted: false,
        feedbackForm: {
          isDeleted: false,
          subjectAllocation: {
            isDeleted: false,
            semesterId,
            semester: { isDeleted: false },
          },
          division: {
            isDeleted: false,
            ...(divisionId && { id: divisionId }),
          },
        },
        student: {
          isDeleted: false,
          ...(batch && { batch }),
        },
      };

      const responses = await prisma.studentResponse.findMany({
        where: whereClause,
        select: {
          responseValue: true,
        },
      });

      if (!responses.length) {
        throw new AppError(
          'No responses found for the given semester and filters.',
          404
        );
      }

      const numericResponses = responses
        .map((r) => parseFloat(String(r.responseValue)))
        .filter((value) => !isNaN(value));

      if (numericResponses.length === 0) {
        throw new AppError('No numeric responses found for calculation.', 404);
      }

      const averageRating =
        numericResponses.reduce((acc, r) => acc + r, 0) /
        numericResponses.length;

      return {
        semesterId,
        averageRating: Number(averageRating.toFixed(2)),
        totalResponses: responses.length,
      };
    } catch (error: any) {
      console.error(
        'Error in AnalyticsService.getOverallSemesterRating:',
        error
      );
      throw error;
    }
  }

  // Retrieves a list of semesters that have associated feedback responses.
  public async getSemestersWithResponses(
    academicYearId?: string,
    departmentId?: string
  ): Promise<SemesterWithResponsesOutput[]> {
    try {
      const whereClause: any = {
        isDeleted: false,
        academicYear: { isDeleted: false },
        department: { isDeleted: false },
        allocations: {
          some: {
            isDeleted: false,
            feedbackForms: {
              some: {
                isDeleted: false,
                responses: {
                  some: {
                    isDeleted: false,
                  },
                },
              },
            },
          },
        },
      };

      if (academicYearId) {
        whereClause.academicYearId = academicYearId;
      }

      if (departmentId) {
        whereClause.departmentId = departmentId;
      }

      const semestersWithResponses = await prisma.semester.findMany({
        where: whereClause,
        select: {
          id: true,
          semesterNumber: true,
          departmentId: true,
          academicYear: {
            select: {
              id: true,
              yearString: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              abbreviation: true,
            },
          },
          allocations: {
            where: {
              isDeleted: false,
            },
            select: {
              feedbackForms: {
                where: {
                  isDeleted: false,
                },
                select: {
                  responses: {
                    where: {
                      isDeleted: false,
                    },
                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          semesterNumber: 'desc',
        },
      });

      const result: SemesterWithResponsesOutput[] = semestersWithResponses.map(
        (semester) => {
          const responseCount = semester.allocations.reduce(
            (total, allocation) => {
              return (
                total +
                allocation.feedbackForms.reduce((formTotal, form) => {
                  return formTotal + form.responses.length;
                }, 0)
              );
            },
            0
          );

          return {
            id: semester.id,
            semesterNumber: semester.semesterNumber,
            departmentId: semester.departmentId,
            academicYear: semester.academicYear,
            department: semester.department,
            responseCount,
          };
        }
      );

      return result;
    } catch (error: any) {
      console.error(
        'Error in AnalyticsService.getSemestersWithResponses:',
        error
      );
      throw new AppError('Failed to retrieve semesters with responses.', 500);
    }
  }

  // Gets subject-wise ratings split by lecture and lab types for a specific semester.
  public async getSubjectWiseLectureLabRating(
    semesterId: string,
    academicYearId?: string
  ): Promise<SubjectWiseRatingOutput[]> {
    try {
      const semester = await prisma.semester.findUnique({
        where: { id: semesterId, isDeleted: false },
        select: { semesterNumber: true, academicYearId: true },
      });

      if (!semester) {
        throw new AppError('Semester not found.', 404);
      }

      const whereClause: Prisma.FeedbackSnapshotWhereInput = {
        isDeleted: false,
        formDeleted: false,
        semesterNumber: semester.semesterNumber,
        ...(academicYearId && { academicYearId }),
        ...(!academicYearId && { academicYearId: semester.academicYearId }),
      };

      const snapshots = await prisma.feedbackSnapshot.findMany({
        where: whereClause,
        select: {
          subjectName: true,
          questionCategoryName: true,
          batch: true,
          responseValue: true,
        },
      });

      if (!snapshots.length) {
        throw new AppError(
          'No feedback data found for the given semester.',
          404
        );
      }

      const groupedData = this.groupBy(snapshots, (snapshot) => {
        let lectureType: LectureType;
        if (
          snapshot.questionCategoryName?.toLowerCase().includes('laboratory') ||
          snapshot.questionCategoryName?.toLowerCase().includes('lab')
        ) {
          lectureType = LectureType.LAB;
        } else if (snapshot.batch && snapshot.batch.toLowerCase() !== 'none') {
          lectureType = LectureType.LAB;
        } else {
          lectureType = LectureType.LECTURE;
        }

        return `${snapshot.subjectName}|${lectureType}`;
      });

      const subjectRatings: SubjectWiseRatingOutput[] = Object.entries(
        groupedData
      ).map(([key, snapshots]) => {
        const [subjectName, lectureType] = key.split('|');

        const numericResponses = snapshots
          .map((snapshot) =>
            this.parseResponseValueToScore(snapshot.responseValue)
          )
          .filter((score): score is number => score !== null);

        const avgRating =
          numericResponses.length > 0
            ? numericResponses.reduce((acc, score) => acc + score, 0) /
            numericResponses.length
            : 0;

        return {
          subject: subjectName,
          lectureType: lectureType as LectureType,
          averageRating: Number(avgRating.toFixed(2)),
          responseCount: snapshots.length,
        };
      });

      return subjectRatings.sort((a, b) => a.subject.localeCompare(b.subject));
    } catch (error: any) {
      console.error(
        'Error in AnalyticsService.getSubjectWiseLectureLabRating:',
        error
      );
      throw error;
    }
  }

  // Identifies high-impact feedback areas (questions with significant low ratings) for a given semester.
  public async getHighImpactFeedbackAreas(
    semesterId: string
  ): Promise<HighImpactFeedbackAreaOutput[]> {
    try {
      const LOW_RATING_THRESHOLD = 3;
      const SIGNIFICANT_COUNT = 5;

      const questionsWithResponses = await prisma.feedbackQuestion.findMany({
        where: {
          isDeleted: false,
          form: {
            isDeleted: false,
            subjectAllocation: {
              isDeleted: false,
              semesterId,
              semester: { isDeleted: false },
            },
          },
        },
        include: {
          responses: {
            where: {
              isDeleted: false,
            },
            select: { responseValue: true },
          },
          category: true,
          faculty: true,
          subject: true,
        },
      });

      const significantLowRatedQuestions: HighImpactFeedbackAreaOutput[] = [];

      for (const question of questionsWithResponses) {
        const numericResponses = question.responses
          .map((r) => parseFloat(String(r.responseValue)))
          .filter((value) => !isNaN(value));

        const lowRatedResponses = numericResponses.filter(
          (val) => val < LOW_RATING_THRESHOLD
        );

        if (lowRatedResponses.length >= SIGNIFICANT_COUNT) {
          const averageRating =
            numericResponses.length > 0
              ? numericResponses.reduce((acc, r) => acc + r, 0) /
              numericResponses.length
              : 0;

          significantLowRatedQuestions.push({
            question: question.text,
            category: question.category?.categoryName || 'N/A',
            faculty: question.faculty?.name || 'N/A',
            subject: question.subject?.name || 'N/A',
            lowRatingCount: lowRatedResponses.length,
            averageRating: Number(averageRating.toFixed(2)),
          });
        }
      }

      if (!significantLowRatedQuestions.length) {
        throw new AppError('No significant low-rated areas found.', 404);
      }

      return significantLowRatedQuestions;
    } catch (error: any) {
      console.error(
        'Error in AnalyticsService.getHighImpactFeedbackAreas:',
        error
      );
      throw error;
    }
  }

  // Analyzes performance trends across semesters for subjects.
  public async getSemesterTrendAnalysis(
    subjectId?: string,
    academicYearId?: string
  ): Promise<SemesterTrendAnalysisOutput[]> {
    try {
      const whereClause: Prisma.FeedbackSnapshotWhereInput = {
        isDeleted: false,
        formDeleted: false,
        ...(subjectId && { subjectId }),
        ...(academicYearId && { academicYearId }),
      };

      const snapshots = await prisma.feedbackSnapshot.findMany({
        where: whereClause,
        select: {
          semesterNumber: true,
          subjectName: true,
          responseValue: true,
          academicYearString: true,
        },
        orderBy: [
          { academicYearString: 'asc' },
          { semesterNumber: 'asc' },
          { subjectName: 'asc' },
        ],
      });

      if (!snapshots.length) {
        throw new AppError(
          'No trend data available for the given criteria.',
          404
        );
      }

      const groupedData = this.groupBy(
        snapshots,
        (snapshot) => `${snapshot.semesterNumber}|${snapshot.subjectName}`
      );

      const trends: SemesterTrendAnalysisOutput[] = Object.entries(
        groupedData
      ).map(([key, snapshots]) => {
        const [semesterNumber, subjectName] = key.split('|');

        const numericResponses = snapshots
          .map((snapshot) =>
            this.parseResponseValueToScore(snapshot.responseValue)
          )
          .filter((score): score is number => score !== null);

        const avgRating =
          numericResponses.length > 0
            ? numericResponses.reduce((acc, score) => acc + score, 0) /
            numericResponses.length
            : 0;

        return {
          semester: parseInt(semesterNumber),
          subject: subjectName,
          averageRating: Number(avgRating.toFixed(2)),
          responseCount: snapshots.length,
        };
      });

      return trends.sort((a, b) => {
        if (a.semester !== b.semester) {
          return a.semester - b.semester;
        }
        return a.subject.localeCompare(b.subject);
      });
    } catch (error: any) {
      console.error(
        'Error in AnalyticsService.getSemesterTrendAnalysis:',
        error
      );
      throw error;
    }
  }

  // Retrieves annual performance trends based on aggregated feedback analytics.
  public async getAnnualPerformanceTrend(): Promise<
    AnnualPerformanceTrendOutput[]
  > {
    try {
      const annualTrends = await prisma.feedbackAnalytics.groupBy({
        by: ['calculatedAt'],
        where: { isDeleted: false },
        _avg: {
          averageRating: true,
          completionRate: true,
        },
        orderBy: {
          calculatedAt: 'asc',
        },
      });

      if (!annualTrends.length) {
        throw new AppError('No annual performance data available.', 404);
      }

      const formattedTrends: AnnualPerformanceTrendOutput[] = annualTrends.map(
        (trend) => ({
          year: new Date(trend.calculatedAt).getFullYear(),
          averageRating: Number(trend._avg.averageRating?.toFixed(2) ?? 0),
          completionRate: Number(trend._avg.completionRate?.toFixed(2) ?? 0),
        })
      );

      return formattedTrends;
    } catch (error: any) {
      console.error(
        'Error in AnalyticsService.getAnnualPerformanceTrend:',
        error
      );
      console.error('Full error details:', JSON.stringify(error, null, 2));

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(
          `Database error during annual trend analysis: ${error.message} (Code: ${error.code})`,
          500
        );
      }
      throw new AppError('Error analyzing annual performance trends.', 500);
    }
  }

  // Compares average ratings across different divisions and batches for a given semester.
  public async getDivisionBatchComparisons(
    semesterId: string
  ): Promise<DivisionBatchComparisonOutput[]> {
    try {
      const forms = await prisma.feedbackForm.findMany({
        where: {
          isDeleted: false,
          subjectAllocation: {
            isDeleted: false,
            semesterId,
            semester: { isDeleted: false },
          },
          division: { isDeleted: false },
        },
        include: {
          division: { select: { divisionName: true } },
          questions: {
            where: { isDeleted: false },
            include: {
              responses: {
                where: { isDeleted: false },
                select: {
                  responseValue: true,
                  student: { select: { batch: true, isDeleted: true } },
                },
              },
            },
          },
        },
      });

      if (!forms.length) {
        throw new AppError(
          'No comparison data available for the given semester.',
          404
        );
      }

      const comparisonData: DivisionBatchComparisonOutput[] = [];

      for (const form of forms) {
        const division = await prisma.division.findUnique({
          where: { id: form.divisionId },
          select: { divisionName: true },
        });

        if (!division) continue;

        const responses = await prisma.studentResponse.findMany({
          where: {
            feedbackFormId: form.id,
            isDeleted: false,
          },
          select: {
            responseValue: true,
            student: {
              select: {
                batch: true,
                isDeleted: true,
              },
            },
          },
        });

        const activeResponses = responses.filter(
          (r) => r.student && !r.student.isDeleted
        );

        const batchGroups: Record<string, typeof activeResponses> = {};
        for (const response of activeResponses) {
          const batch = response.student?.batch || 'Unknown';
          if (!batchGroups[batch]) {
            batchGroups[batch] = [];
          }
          batchGroups[batch].push(response);
        }

        Object.entries(batchGroups).forEach(([batch, batchResponses]) => {
          const numericBatchResponses = batchResponses
            .map((r) => parseFloat(String(r.responseValue)))
            .filter((value) => !isNaN(value));

          const avgRating =
            numericBatchResponses.length > 0
              ? numericBatchResponses.reduce((sum, r) => sum + r, 0) /
              numericBatchResponses.length
              : 0;

          comparisonData.push({
            division: division.divisionName,
            batch,
            averageRating: Number(avgRating.toFixed(2)),
            responseCount: batchResponses.length,
          });
        });
      }

      return comparisonData;
    } catch (error: any) {
      console.error(
        'Error in AnalyticsService.getDivisionBatchComparisons:',
        error
      );
      throw error;
    }
  }

  // Compares average ratings between different lecture types (e.g., LECTURE, LAB) for a given semester.
  public async getLabLectureComparison(
    semesterId: string
  ): Promise<LabLectureComparisonOutput[]> {
    try {
      const forms = await prisma.feedbackForm.findMany({
        where: {
          isDeleted: false,
          subjectAllocation: {
            isDeleted: false,
            semesterId,
            semester: { isDeleted: false },
          },
        },
        select: {
          id: true,
          subjectAllocationId: true,
        },
      });

      if (!forms.length) {
        throw new AppError(
          'No comparison data available for the given semester.',
          404
        );
      }

      const lectureTypeData: Record<
        string,
        { responses: any[]; forms: any[] }
      > = {};

      for (const form of forms) {
        const allocation = await prisma.subjectAllocation.findUnique({
          where: { id: form.subjectAllocationId },
          select: { lectureType: true },
        });

        const lectureType = allocation?.lectureType || 'LECTURE';

        if (!lectureTypeData[lectureType]) {
          lectureTypeData[lectureType] = { responses: [], forms: [] };
        }

        lectureTypeData[lectureType].forms.push(form);

        const responses = await prisma.studentResponse.findMany({
          where: {
            feedbackFormId: form.id,
            isDeleted: false,
          },
          select: { responseValue: true },
        });

        lectureTypeData[lectureType].responses.push(...responses);
      }

      const comparison: LabLectureComparisonOutput[] = Object.entries(
        lectureTypeData
      ).map(([lectureType, data]) => {
        const numericResponses = data.responses
          .map((r) => parseFloat(String(r.responseValue)))
          .filter((value) => !isNaN(value));

        const avgRating =
          numericResponses.length > 0
            ? numericResponses.reduce((sum, r) => sum + r, 0) /
            numericResponses.length
            : 0;

        return {
          lectureType: lectureType as LectureType,
          averageRating: Number(avgRating.toFixed(2)),
          responseCount: data.responses.length,
          formCount: data.forms.length,
        };
      });

      return comparison;
    } catch (error: any) {
      console.error(
        'Error in AnalyticsService.getLabLectureComparison:',
        error
      );
      throw error;
    }
  }

  // Retrieves performance data for a single faculty member across semesters for a given academic year.
  public async getFacultyPerformanceYearData(
    academicYearId: string,
    facultyId: string
  ): Promise<FacultyPerformanceYearDataOutput> {
    try {
      const feedbackSnapshots = await prisma.feedbackSnapshot.findMany({
        where: {
          facultyId: facultyId,
          academicYearId: academicYearId,
          questionType: 'rating',
          formDeleted: false,
          isDeleted: false,
        },
        select: {
          id: true,
          semesterNumber: true,
          responseValue: true,
          facultyName: true,
          academicYearString: true,
        },
        orderBy: {
          semesterNumber: 'asc',
        },
      });

      if (feedbackSnapshots.length === 0) {
        const faculty = await prisma.faculty.findUnique({
          where: { id: facultyId, isDeleted: false },
          select: { name: true },
        });
        const academicYear = await prisma.academicYear.findUnique({
          where: { id: academicYearId, isDeleted: false },
          select: { yearString: true },
        });

        const defaultFacultyName = faculty?.name || 'Unknown Faculty';
        const defaultAcademicYear =
          academicYear?.yearString || 'Unknown Academic Year';

        const result: FacultyPerformanceYearDataOutput = {
          Faculty_name: defaultFacultyName,
          academic_year: defaultAcademicYear,
          total_average: null,
        };
        for (let i = 1; i <= 8; i++) {
          result[`semester ${i}`] = null;
        }
        return result;
      }

      const facultyName = feedbackSnapshots[0].facultyName;
      const academicYear = feedbackSnapshots[0].academicYearString;

      const semesterScores: { [key: number]: { sum: number; count: number } } =
        {};
      let totalSum = 0;
      let totalCount = 0;
      const maxSemesterNumber = 8;

      for (const snapshot of feedbackSnapshots) {
        const semester = snapshot.semesterNumber;
        const score = this.parseResponseValueToScore(snapshot.responseValue);

        if (typeof score === 'number' && !isNaN(score)) {
          if (!semesterScores[semester]) {
            semesterScores[semester] = { sum: 0, count: 0 };
          }
          semesterScores[semester].sum += score;
          semesterScores[semester].count += 1;

          totalSum += score;
          totalCount += 1;
        } else {
          console.warn(
            `Skipping snapshot ID: ${snapshot.id} due to non-numerical or unparsable score. Raw value:`,
            snapshot.responseValue
          );
        }
      }

      const result: FacultyPerformanceYearDataOutput = {
        Faculty_name: facultyName,
        academic_year: academicYear,
        total_average: null,
      };

      for (let i = 1; i <= maxSemesterNumber; i++) {
        if (semesterScores[i] && semesterScores[i].count > 0) {
          result[`semester ${i}`] = parseFloat(
            (semesterScores[i].sum / semesterScores[i].count).toFixed(2)
          );
        } else {
          result[`semester ${i}`] = null;
        }
      }

      result.total_average =
        totalCount > 0 ? parseFloat((totalSum / totalCount).toFixed(2)) : null;

      return result;
    } catch (error: any) {
      console.error(
        'Error in AnalyticsService.getFacultyPerformanceYearData:',
        error
      );
      throw error;
    }
  }

  // Retrieves performance data for all faculty members for a given academic year.
  public async getAllFacultyPerformanceData(
    academicYearId: string
  ): Promise<AllFacultyPerformanceDataOutput> {
    try {
      const feedbackSnapshots = await prisma.feedbackSnapshot.findMany({
        where: {
          academicYearId: academicYearId,
          questionType: 'rating',
          formDeleted: false,
          isDeleted: false,
        },
        select: {
          id: true,
          facultyId: true,
          facultyName: true,
          semesterNumber: true,
          responseValue: true,
          academicYearString: true,
        },
        orderBy: [{ facultyId: 'asc' }, { semesterNumber: 'asc' }],
      });

      if (feedbackSnapshots.length === 0) {
        const academicYearRecord = await prisma.academicYear.findUnique({
          where: { id: academicYearId, isDeleted: false },
          select: { yearString: true },
        });
        const defaultAcademicYear =
          academicYearRecord?.yearString || 'Unknown Academic Year';

        return {
          academic_year: defaultAcademicYear,
          faculties: [],
        };
      }

      interface FacultyAggregatedData {
        facultyId: string;
        Faculty_name: string;
        academic_year: string;
        semesters: { [key: number]: { sum: number; count: number } };
        totalSum: number;
        totalCount: number;
      }

      const aggregatedData: { [facultyId: string]: FacultyAggregatedData } = {};
      const maxSemesterNumber = 8;

      for (const snapshot of feedbackSnapshots) {
        const facultyId = snapshot.facultyId;
        const semester = snapshot.semesterNumber;
        const score = this.parseResponseValueToScore(snapshot.responseValue);

        if (!aggregatedData[facultyId]) {
          aggregatedData[facultyId] = {
            facultyId: facultyId,
            Faculty_name: snapshot.facultyName,
            academic_year: snapshot.academicYearString,
            semesters: {},
            totalSum: 0,
            totalCount: 0,
          };
        }

        if (typeof score === 'number' && !isNaN(score)) {
          if (!aggregatedData[facultyId].semesters[semester]) {
            aggregatedData[facultyId].semesters[semester] = {
              sum: 0,
              count: 0,
            };
          }
          aggregatedData[facultyId].semesters[semester].sum += score;
          aggregatedData[facultyId].semesters[semester].count += 1;

          aggregatedData[facultyId].totalSum += score;
          aggregatedData[facultyId].totalCount += 1;
        } else {
          console.warn(
            `Skipping score for snapshot ${snapshot.id} due to invalid value:`,
            snapshot.responseValue
          );
        }
      }

      const finalResultFaculties: Array<
        FacultyPerformanceYearDataOutput & { facultyId: string }
      > = [];

      for (const facultyId in aggregatedData) {
        const facultyData = aggregatedData[facultyId];
        const facultyOutput: FacultyPerformanceYearDataOutput & {
          facultyId: string;
        } = {
          facultyId: facultyData.facultyId,
          Faculty_name: facultyData.Faculty_name,
          academic_year: facultyData.academic_year,
          total_average: null,
          total_responses: facultyData.totalCount, // Add total responses count
        };

        for (let i = 1; i <= maxSemesterNumber; i++) {
          if (facultyData.semesters[i] && facultyData.semesters[i].count > 0) {
            facultyOutput[`semester ${i}`] = parseFloat(
              (
                facultyData.semesters[i].sum / facultyData.semesters[i].count
              ).toFixed(2)
            );
          } else {
            facultyOutput[`semester ${i}`] = null;
          }
        }

        facultyOutput.total_average =
          facultyData.totalCount > 0
            ? parseFloat(
              (facultyData.totalSum / facultyData.totalCount).toFixed(2)
            )
            : null;

        finalResultFaculties.push(facultyOutput);
      }

      return {
        academic_year: feedbackSnapshots[0].academicYearString,
        faculties: finalResultFaculties,
      };
    } catch (error: any) {
      console.error(
        'Error in AnalyticsService.getAllFacultyPerformanceData:',
        error
      );
      throw error;
    }
  }

  // Retrieves the total number of student responses.
  public async getTotalResponses(): Promise<number> {
    try {
      const totalResponses = await prisma.studentResponse.count({
        where: {
          isDeleted: false,
        },
      });
      return totalResponses;
    } catch (error: any) {
      console.error('Error in AnalyticsService.getTotalResponses:', error);
      throw new AppError('Failed to retrieve total responses count.', 500);
    }
  }

  // Retrieves semesters and their divisions, including response counts for each division.
  public async getSemesterDivisionsWithResponseCounts(): Promise<
    SemesterDivisionResponseOutput[]
  > {
    try {
      const semesters = await prisma.semester.findMany({
        where: {
          isDeleted: false,
          academicYear: { isDeleted: false },
        },
        select: {
          id: true,
          semesterNumber: true,
          academicYearId: true,
        },
        orderBy: {
          semesterNumber: 'asc',
        },
      });

      const formattedResponse: SemesterDivisionResponseOutput[] = [];

      for (const semester of semesters) {
        const academicYear = await prisma.academicYear.findUnique({
          where: { id: semester.academicYearId },
          select: {
            id: true,
            yearString: true,
          },
        });

        if (!academicYear) continue;

        const divisions = await prisma.division.findMany({
          where: {
            isDeleted: false,
            semesterId: semester.id,
          },
          select: {
            id: true,
            divisionName: true,
            studentCount: true,
          },
        });

        const divisionsWithResponses: SemesterDivisionDetails[] = [];

        for (const division of divisions) {
          const responseCount = await prisma.studentResponse.count({
            where: {
              isDeleted: false,
              feedbackForm: {
                isDeleted: false,
                division: {
                  id: division.id,
                  isDeleted: false,
                },
              },
            },
          });

          if (responseCount > 0) {
            divisionsWithResponses.push({
              divisionId: division.id,
              divisionName: division.divisionName,
              studentCount: division.studentCount,
              responseCount,
            });
          }
        }

        if (divisionsWithResponses.length > 0) {
          formattedResponse.push({
            semesterId: semester.id,
            semesterNumber: semester.semesterNumber,
            academicYear: academicYear,
            divisions: divisionsWithResponses,
          });
        }
      }

      return formattedResponse;
    } catch (error: any) {
      console.error(
        'Error in AnalyticsService.getSemesterDivisionsWithResponseCounts:',
        error
      );
      throw new AppError('Error fetching semester divisions data.', 500);
    }
  }

  // Gets the filter dictionary with Academic Years -> Departments -> Subjects hierarchy.
  public async getFilterDictionary(): Promise<FilterDictionaryOutput> {
    try {
      const academicYears = await prisma.academicYear.findMany({
        where: {
          isDeleted: false,
        },
        select: {
          id: true,
          yearString: true,
        },
        orderBy: {
          yearString: 'desc',
        },
      });

      const filterData: FilterDictionaryOutput = {
        academicYears: [],
        lectureTypes: [
          { value: LectureType.LECTURE, label: 'Lecture' },
          { value: LectureType.LAB, label: 'Laboratory' },
        ],
      };

      for (const year of academicYears) {
        const departments = await prisma.department.findMany({
          where: {
            isDeleted: false,
            semesters: {
              some: {
                academicYearId: year.id,
                isDeleted: false,
              },
            },
          },
          select: {
            id: true,
            name: true,
            abbreviation: true,
          },
          orderBy: {
            name: 'asc',
          },
        });

        const departmentsWithSubjectsAndSemesters = [];

        for (const dept of departments) {
          const subjects = await prisma.subject.findMany({
            where: {
              isDeleted: false,
              semester: {
                academicYearId: year.id,
                departmentId: dept.id,
                isDeleted: false,
              },
            },
            select: {
              id: true,
              name: true,
              subjectCode: true,
              type: true,
            },
            orderBy: {
              subjectCode: 'asc',
            },
          });

          const semesters = await prisma.semester.findMany({
            where: {
              academicYearId: year.id,
              departmentId: dept.id,
              isDeleted: false,
            },
            select: {
              id: true,
              semesterNumber: true,
              divisions: {
                where: {
                  isDeleted: false,
                },
                select: {
                  id: true,
                  divisionName: true,
                },
                orderBy: {
                  divisionName: 'asc',
                },
              },
            },
            orderBy: {
              semesterNumber: 'asc',
            },
          });

          departmentsWithSubjectsAndSemesters.push({
            ...dept,
            subjects: subjects.map((subject) => ({
              id: subject.id,
              name: subject.name,
              code: subject.subjectCode,
              type: subject.type.toString(),
            })),
            semesters: semesters.map((semester) => ({
              id: semester.id,
              semesterNumber: semester.semesterNumber,
              divisions: semester.divisions,
            })),
          });
        }

        filterData.academicYears.push({
          ...year,
          departments: departmentsWithSubjectsAndSemesters,
        });
      }

      return filterData;
    } catch (error: any) {
      console.error('Error in AnalyticsService.getFilterDictionary:', error);
      throw new AppError('Failed to retrieve filter dictionary.', 500);
    }
  }

  // Gets complete analytics data based on filters.
  // public async getCompleteAnalyticsData(
  //   academicYearId?: string,
  //   departmentId?: string,
  //   subjectId?: string,
  //   semesterId?: string,
  //   divisionId?: string,
  //   lectureType?: LectureType,
  //   includeDeleted = false
  // ): Promise<CompleteAnalyticsDataOutput> {
  //   try {
  //     const semesterWhereClause: Prisma.SemesterWhereInput = {
  //       isDeleted: includeDeleted ? undefined : false,
  //     };

  //     if (!includeDeleted) {
  //       semesterWhereClause.department = {
  //         isDeleted: false,
  //       };
  //     }

  //     if (academicYearId) {
  //       semesterWhereClause.academicYearId = academicYearId;
  //     }

  //     if (departmentId) {
  //       semesterWhereClause.departmentId = departmentId;
  //     }

  //     if (semesterId) {
  //       semesterWhereClause.id = semesterId;
  //     }

  //     const semesters = await prisma.semester.findMany({
  //       where: semesterWhereClause,
  //       include: {
  //         academicYear: true,
  //         department: true,
  //         allocations: {
  //           where: {
  //             isDeleted: false,
  //           },
  //           select: {
  //             feedbackForms: {
  //               where: {
  //                 isDeleted: false,
  //               },
  //               select: {
  //                 responses: {
  //                   where: {
  //                     isDeleted: false,
  //                   },
  //                   select: {
  //                     id: true,
  //                   },
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //       orderBy: [
  //         { academicYear: { yearString: 'desc' } },
  //         { semesterNumber: 'asc' },
  //       ],
  //     });

  //     const formattedSemesters = semesters.map((semester) => {
  //       const responseCount = semester.allocations.reduce(
  //         (total, allocation) => {
  //           return (
  //             total +
  //             allocation.feedbackForms.reduce((formTotal, form) => {
  //               return formTotal + form.responses.length;
  //             }, 0)
  //           );
  //         },
  //         0
  //       );

  //       return {
  //         id: semester.id,
  //         semesterNumber: semester.semesterNumber,
  //         departmentId: semester.departmentId,
  //         academicYearId: semester.academicYearId,
  //         startDate: semester.startDate?.toISOString() || null,
  //         endDate: semester.endDate?.toISOString() || null,
  //         semesterType: semester.semesterType.toString(),
  //         department: semester.department || {
  //           id: semester.departmentId,
  //           name: 'Unknown Department',
  //           abbreviation: 'UNK',
  //           isDeleted: false,
  //           createdAt: new Date(),
  //           updatedAt: new Date(),
  //         },
  //         academicYear: semester.academicYear,
  //         responseCount,
  //       };
  //     });

  //     const snapshotWhereClause: Prisma.FeedbackSnapshotWhereInput = {
  //       isDeleted: includeDeleted ? undefined : false,
  //       formIsDeleted: includeDeleted ? undefined : false,
  //     };

  //     if (academicYearId) {
  //       snapshotWhereClause.academicYearId = academicYearId;
  //     }

  //     if (departmentId) {
  //       snapshotWhereClause.departmentId = departmentId;
  //     }

  //     if (subjectId) {
  //       snapshotWhereClause.subjectId = subjectId;
  //     }

  //     if (semesterId) {
  //       snapshotWhereClause.semesterId = semesterId;
  //     }

  //     if (divisionId) {
  //       snapshotWhereClause.divisionId = divisionId;
  //     }

  //     if (semesterId) {
  //       snapshotWhereClause.semesterId = semesterId;
  //     }

  //     if (divisionId) {
  //       snapshotWhereClause.divisionId = divisionId;
  //     }

  //     let feedbackSnapshots = await prisma.feedbackSnapshot.findMany({
  //       where: snapshotWhereClause,
  //       select: {
  //         id: true,
  //         academicYearId: true,
  //         academicYearString: true,
  //         departmentId: true,
  //         departmentName: true,
  //         departmentAbbreviation: true,
  //         semesterId: true,
  //         semesterNumber: true,
  //         divisionId: true,
  //         divisionName: true,
  //         subjectId: true,
  //         subjectName: true,
  //         subjectAbbreviation: true,
  //         subjectCode: true,
  //         facultyId: true,
  //         facultyName: true,
  //         facultyAbbreviation: true,
  //         studentId: true,
  //         studentEnrollmentNumber: true,
  //         formId: true,
  //         formStatus: true,
  //         questionId: true,
  //         questionType: true,
  //         questionCategoryId: true,
  //         questionCategoryName: true,
  //         questionBatch: true,
  //         responseValue: true,
  //         batch: true,
  //         submittedAt: true,
  //         createdAt: true,
  //       },
  //       orderBy: [{ semesterNumber: 'asc' }, { subjectName: 'asc' }],
  //     });

  //     if (lectureType) {
  //       feedbackSnapshots = feedbackSnapshots.filter((snapshot) => {
  //         let snapshotLectureType: LectureType;
  //         if (
  //           snapshot.questionCategoryName
  //             ?.toLowerCase()
  //             .includes('laboratory') ||
  //           snapshot.questionCategoryName?.toLowerCase().includes('lab')
  //         ) {
  //           snapshotLectureType = LectureType.LAB;
  //         } else if (
  //           snapshot.questionBatch &&
  //           snapshot.questionBatch.toLowerCase() !== 'none'
  //         ) {
  //           snapshotLectureType = LectureType.LAB;
  //         } else {
  //           snapshotLectureType = LectureType.LECTURE;
  //         }

  //         return snapshotLectureType === lectureType;
  //       });
  //     }

  //     const groupedSnapshots = this.groupBy(feedbackSnapshots, (snapshot) => {
  //       let lectureType: LectureType;
  //       if (
  //         snapshot.questionCategoryName?.toLowerCase().includes('laboratory') ||
  //         snapshot.questionCategoryName?.toLowerCase().includes('lab')
  //       ) {
  //         lectureType = LectureType.LAB;
  //       } else {
  //         lectureType = LectureType.LECTURE;
  //       }

  //       return `${snapshot.subjectName}|${lectureType}|${snapshot.semesterNumber}`;
  //     });

  //     const subjectRatings = Object.entries(groupedSnapshots).map(
  //       ([key, snapshots]) => {
  //         const [subjectName, lectureType, semesterNumberStr] = key.split('|');
  //         const semesterNumber = parseInt(semesterNumberStr);

  //         const numericResponses = snapshots
  //           .map((snapshot) =>
  //             this.parseResponseValueToScore(snapshot.responseValue)
  //           )
  //           .filter((score): score is number => score !== null);

  //         const avgRating =
  //           numericResponses.length > 0
  //             ? numericResponses.reduce((acc, score) => acc + score, 0) /
  //               numericResponses.length
  //             : 0;

  //         const firstSnapshot = snapshots[0];

  //         return {
  //           subjectId: firstSnapshot.subjectId,
  //           subjectName: subjectName,
  //           subjectAbbreviation: firstSnapshot.subjectAbbreviation,
  //           lectureType: lectureType as LectureType,
  //           averageRating: Number(avgRating.toFixed(2)),
  //           responseCount: snapshots.length,
  //           semesterNumber: semesterNumber,
  //           academicYearId: firstSnapshot.academicYearId,
  //           facultyId: firstSnapshot.facultyId,
  //           facultyName: firstSnapshot.facultyName,
  //         };
  //       }
  //     );

  //     const semesterTrendsGrouped = this.groupBy(
  //       feedbackSnapshots,
  //       (snapshot) => `${snapshot.subjectName}|${snapshot.semesterNumber}`
  //     );

  //     const semesterTrends = Object.entries(semesterTrendsGrouped).map(
  //       ([key, snapshots]) => {
  //         const [subjectName, semesterNumberStr] = key.split('|');
  //         const semesterNumber = parseInt(semesterNumberStr);

  //         const numericResponses = snapshots
  //           .map((snapshot) =>
  //             this.parseResponseValueToScore(snapshot.responseValue)
  //           )
  //           .filter((score): score is number => score !== null);

  //         const avgRating =
  //           numericResponses.length > 0
  //             ? numericResponses.reduce((acc, score) => acc + score, 0) /
  //               numericResponses.length
  //             : 0;

  //         const firstSnapshot = snapshots[0];

  //         return {
  //           subject: subjectName,
  //           semester: semesterNumber,
  //           averageRating: Number(avgRating.toFixed(2)),
  //           responseCount: snapshots.length,
  //           academicYearId: firstSnapshot.academicYearId,
  //           academicYear: firstSnapshot.academicYearString,
  //         };
  //       }
  //     );

  //     return {
  //       semesters: formattedSemesters,
  //       subjectRatings,
  //       semesterTrends,
  //       feedbackSnapshots: feedbackSnapshots.map((snapshot) => ({
  //         id: snapshot.id,
  //         academicYearId: snapshot.academicYearId,
  //         academicYearString: snapshot.academicYearString,
  //         departmentId: snapshot.departmentId,
  //         departmentName: snapshot.departmentName,
  //         departmentAbbreviation: snapshot.departmentAbbreviation,
  //         semesterId: snapshot.semesterId,
  //         semesterNumber: snapshot.semesterNumber,
  //         divisionId: snapshot.divisionId,
  //         divisionName: snapshot.divisionName,
  //         subjectId: snapshot.subjectId,
  //         subjectName: snapshot.subjectName,
  //         subjectAbbreviation: snapshot.subjectAbbreviation,
  //         subjectCode: snapshot.subjectCode,
  //         facultyId: snapshot.facultyId,
  //         facultyName: snapshot.facultyName,
  //         facultyAbbreviation: snapshot.facultyAbbreviation,
  //         studentId: snapshot.studentId || null,
  //         studentEnrollmentNumber: snapshot.studentEnrollmentNumber,
  //         formId: snapshot.formId,
  //         formStatus: snapshot.formStatus,
  //         questionId: snapshot.questionId,
  //         questionType: snapshot.questionType,
  //         questionCategoryId: snapshot.questionCategoryId,
  //         questionCategoryName: snapshot.questionCategoryName,
  //         questionBatch: snapshot.questionBatch,
  //         responseValue: snapshot.responseValue,
  //         batch: snapshot.batch,
  //         submittedAt: snapshot.submittedAt.toISOString(),
  //         createdAt: snapshot.createdAt.toISOString(),
  //       })),
  //     };
  //   } catch (error: any) {
  //     console.error(
  //       'Error in AnalyticsService.getCompleteAnalyticsData:',
  //       error
  //     );
  //     throw new AppError('Failed to retrieve complete analytics data.', 500);
  //   }
  // }
  public async getCompleteAnalyticsData(
    academicYearId?: string,
    departmentId?: string,
    subjectId?: string,
    semesterId?: string,
    divisionId?: string,
    lectureType?: LectureType,
    includeDeleted = false
  ): Promise<CompleteAnalyticsDataOutput> {
    try {
      const semesterWhereClause: Prisma.SemesterWhereInput = {
        isDeleted: includeDeleted ? undefined : false,
      };

      if (!includeDeleted) {
        semesterWhereClause.department = {
          isDeleted: false,
        };
      }

      if (academicYearId) {
        semesterWhereClause.academicYearId = academicYearId;
      }

      if (departmentId) {
        semesterWhereClause.departmentId = departmentId;
      }

      if (semesterId) {
        semesterWhereClause.id = semesterId;
      }

      const semesters = await prisma.semester.findMany({
        where: semesterWhereClause,
        include: {
          academicYear: true,
          department: true,
          allocations: {
            where: {
              isDeleted: false,
            },
            select: {
              feedbackForms: {
                where: {
                  isDeleted: false,
                },
                select: {
                  responses: {
                    where: {
                      isDeleted: false,
                    },
                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          { academicYear: { yearString: 'desc' } },
          { semesterNumber: 'asc' },
        ],
      });

      const formattedSemesters = semesters.map((semester) => {
        const responseCount = semester.allocations.reduce(
          (total, allocation) => {
            return (
              total +
              allocation.feedbackForms.reduce((formTotal, form) => {
                return formTotal + form.responses.length;
              }, 0)
            );
          },
          0
        );

        return {
          id: semester.id,
          semesterNumber: semester.semesterNumber,
          departmentId: semester.departmentId,
          academicYearId: semester.academicYearId,
          startDate: semester.startDate?.toISOString() || null,
          endDate: semester.endDate?.toISOString() || null,
          semesterType: semester.semesterType.toString(),
          department: semester.department || {
            id: semester.departmentId,
            name: 'Unknown Department',
            abbreviation: 'UNK',
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          academicYear: semester.academicYear,
          responseCount,
        };
      });

      const snapshotWhereClause: Prisma.FeedbackSnapshotWhereInput = {
        // Main snapshot deletion filter
        isDeleted: includeDeleted ? undefined : false,
      };

      // If not including deleted, filter out all entities that are marked as deleted
      if (!includeDeleted) {
        snapshotWhereClause.AND = [
          { academicYearIsDeleted: false },
          { departmentIsDeleted: false },
          { semesterIsDeleted: false },
          { divisionIsDeleted: false },
          { subjectIsDeleted: false },
          { formIsDeleted: false },
          { questionIsDeleted: false },
          { formDeleted: false }, // This seems to be a duplicate of formIsDeleted, but including both for safety
        ];
      }

      // Apply additional filters
      if (academicYearId) {
        snapshotWhereClause.academicYearId = academicYearId;
      }

      if (departmentId) {
        snapshotWhereClause.departmentId = departmentId;
      }

      if (subjectId) {
        snapshotWhereClause.subjectId = subjectId;
      }

      if (semesterId) {
        snapshotWhereClause.semesterId = semesterId;
      }

      if (divisionId) {
        snapshotWhereClause.divisionId = divisionId;
      }

      let feedbackSnapshots = await prisma.feedbackSnapshot.findMany({
        where: snapshotWhereClause,
        select: {
          id: true,
          academicYearId: true,
          academicYearString: true,
          departmentId: true,
          departmentName: true,
          departmentAbbreviation: true,
          semesterId: true,
          semesterNumber: true,
          divisionId: true,
          divisionName: true,
          subjectId: true,
          subjectName: true,
          subjectAbbreviation: true,
          subjectCode: true,
          facultyId: true,
          facultyName: true,
          facultyAbbreviation: true,
          studentId: true,
          studentEnrollmentNumber: true,
          formId: true,
          formStatus: true,
          questionId: true,
          questionType: true,
          questionCategoryId: true,
          questionCategoryName: true,
          questionBatch: true,
          responseValue: true,
          batch: true,
          submittedAt: true,
          createdAt: true,
        },
        orderBy: [{ semesterNumber: 'asc' }, { subjectName: 'asc' }],
      });

      if (lectureType) {
        feedbackSnapshots = feedbackSnapshots.filter((snapshot) => {
          let snapshotLectureType: LectureType;
          if (
            snapshot.questionCategoryName
              ?.toLowerCase()
              .includes('laboratory') ||
            snapshot.questionCategoryName?.toLowerCase().includes('lab')
          ) {
            snapshotLectureType = LectureType.LAB;
          } else if (
            snapshot.questionBatch &&
            snapshot.questionBatch.toLowerCase() !== 'none'
          ) {
            snapshotLectureType = LectureType.LAB;
          } else {
            snapshotLectureType = LectureType.LECTURE;
          }

          return snapshotLectureType === lectureType;
        });
      }

      const groupedSnapshots = this.groupBy(feedbackSnapshots, (snapshot) => {
        let lectureType: LectureType;
        if (
          snapshot.questionCategoryName?.toLowerCase().includes('laboratory') ||
          snapshot.questionCategoryName?.toLowerCase().includes('lab')
        ) {
          lectureType = LectureType.LAB;
        } else {
          lectureType = LectureType.LECTURE;
        }

        return `${snapshot.subjectName}|${lectureType}|${snapshot.semesterNumber}`;
      });

      const subjectRatings = Object.entries(groupedSnapshots).map(
        ([key, snapshots]) => {
          const [subjectName, lectureType, semesterNumberStr] = key.split('|');
          const semesterNumber = parseInt(semesterNumberStr);

          const numericResponses = snapshots
            .map((snapshot) =>
              this.parseResponseValueToScore(snapshot.responseValue)
            )
            .filter((score): score is number => score !== null);

          const avgRating =
            numericResponses.length > 0
              ? numericResponses.reduce((acc, score) => acc + score, 0) /
              numericResponses.length
              : 0;

          const firstSnapshot = snapshots[0];

          return {
            subjectId: firstSnapshot.subjectId,
            subjectName: subjectName,
            subjectAbbreviation: firstSnapshot.subjectAbbreviation,
            lectureType: lectureType as LectureType,
            averageRating: Number(avgRating.toFixed(2)),
            responseCount: snapshots.length,
            semesterNumber: semesterNumber,
            academicYearId: firstSnapshot.academicYearId,
            facultyId: firstSnapshot.facultyId,
            facultyName: firstSnapshot.facultyName,
          };
        }
      );

      const semesterTrendsGrouped = this.groupBy(
        feedbackSnapshots,
        (snapshot) => `${snapshot.subjectName}|${snapshot.semesterNumber}`
      );

      const semesterTrends = Object.entries(semesterTrendsGrouped).map(
        ([key, snapshots]) => {
          const [subjectName, semesterNumberStr] = key.split('|');
          const semesterNumber = parseInt(semesterNumberStr);

          const numericResponses = snapshots
            .map((snapshot) =>
              this.parseResponseValueToScore(snapshot.responseValue)
            )
            .filter((score): score is number => score !== null);

          const avgRating =
            numericResponses.length > 0
              ? numericResponses.reduce((acc, score) => acc + score, 0) /
              numericResponses.length
              : 0;

          const firstSnapshot = snapshots[0];

          return {
            subject: subjectName,
            semester: semesterNumber,
            averageRating: Number(avgRating.toFixed(2)),
            responseCount: snapshots.length,
            academicYearId: firstSnapshot.academicYearId,
            academicYear: firstSnapshot.academicYearString,
          };
        }
      );

      return {
        semesters: formattedSemesters,
        subjectRatings,
        semesterTrends,
        feedbackSnapshots: feedbackSnapshots.map((snapshot) => ({
          id: snapshot.id,
          academicYearId: snapshot.academicYearId,
          academicYearString: snapshot.academicYearString,
          departmentId: snapshot.departmentId,
          departmentName: snapshot.departmentName,
          departmentAbbreviation: snapshot.departmentAbbreviation,
          semesterId: snapshot.semesterId,
          semesterNumber: snapshot.semesterNumber,
          divisionId: snapshot.divisionId,
          divisionName: snapshot.divisionName,
          subjectId: snapshot.subjectId,
          subjectName: snapshot.subjectName,
          subjectAbbreviation: snapshot.subjectAbbreviation,
          subjectCode: snapshot.subjectCode,
          facultyId: snapshot.facultyId,
          facultyName: snapshot.facultyName,
          facultyAbbreviation: snapshot.facultyAbbreviation,
          studentId: snapshot.studentId || null,
          studentEnrollmentNumber: snapshot.studentEnrollmentNumber,
          formId: snapshot.formId,
          formStatus: snapshot.formStatus,
          questionId: snapshot.questionId,
          questionType: snapshot.questionType,
          questionCategoryId: snapshot.questionCategoryId,
          questionCategoryName: snapshot.questionCategoryName,
          questionBatch: snapshot.questionBatch,
          responseValue: snapshot.responseValue,
          batch: snapshot.batch,
          submittedAt: snapshot.submittedAt.toISOString(),
          createdAt: snapshot.createdAt.toISOString(),
        })),
      };
    } catch (error: any) {
      console.error(
        'Error in AnalyticsService.getCompleteAnalyticsData:',
        error
      );
      throw new AppError('Failed to retrieve complete analytics data.', 500);
    }
  }

  // ==================== OPTIMIZED ANALYTICS ENDPOINT ====================
  // Returns pre-aggregated data instead of raw snapshots

  public async getOptimizedAnalyticsData(
    academicYearId?: string,
    departmentId?: string,
    subjectId?: string,
    semesterId?: string,
    divisionId?: string,
    lectureType?: 'LECTURE' | 'LAB',
    includeDeleted: boolean = false
  ): Promise<OptimizedAnalyticsResponse> {
    try {
      const conditions: Prisma.Sql[] = [];

      if (!includeDeleted) {
        conditions.push(Prisma.sql`is_deleted = false`);
        conditions.push(Prisma.sql`academic_year_is_deleted = false`);
        conditions.push(Prisma.sql`department_is_deleted = false`);
        conditions.push(Prisma.sql`semester_is_deleted = false`);
        conditions.push(Prisma.sql`division_is_deleted = false`);
        conditions.push(Prisma.sql`subject_is_deleted = false`);
        conditions.push(Prisma.sql`form_is_deleted = false`);
        conditions.push(Prisma.sql`question_is_deleted = false`);
        conditions.push(Prisma.sql`form_deleted = false`);
      } else {
        conditions.push(Prisma.sql`1=1`);
      }

      if (academicYearId) conditions.push(Prisma.sql`academic_year_id = ${academicYearId}`);
      if (departmentId) conditions.push(Prisma.sql`department_id = ${departmentId}`);
      if (subjectId) conditions.push(Prisma.sql`subject_id = ${subjectId}`);
      if (semesterId) conditions.push(Prisma.sql`semester_id = ${semesterId}`);
      if (divisionId) conditions.push(Prisma.sql`division_id = ${divisionId}`);

      const labCondition = Prisma.sql`question_category_name ILIKE '%laboratory%' OR question_category_name ILIKE '%lab%' OR (question_batch IS NOT NULL AND question_batch NOT ILIKE 'none')`;

      if (lectureType === 'LAB') {
        conditions.push(Prisma.sql`(${labCondition})`);
      } else if (lectureType === 'LECTURE') {
        conditions.push(Prisma.sql`NOT (${labCondition})`);
      }

      const whereSql = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
      const scoreExpr = Prisma.sql`CAST(COALESCE(NULLIF(response_value->>'score', ''), NULLIF(response_value#>>'{}', '')) AS NUMERIC)`;

      // 1. Overall Stats
      const overallQuery = prisma.$queryRaw<any[]>`
          SELECT
              COUNT(DISTINCT subject_id) as "uniqueSubjects",
              COUNT(DISTINCT faculty_id) as "uniqueFaculties",
              COUNT(DISTINCT student_id) as "uniqueStudents",
              COUNT(DISTINCT division_id) as "uniqueDivisions",
              COUNT(*) as "totalResponses",
              AVG(${scoreExpr}) as "averageRating"
          FROM feedback_snapshots
          ${whereSql}
          AND ${scoreExpr} > 0
      `;

      // 2. Subject Ratings
      const subjectQuery = prisma.$queryRaw<any[]>`
          SELECT
              subject_id as "subjectId",
              MAX(subject_name) as "subjectName",
              MAX(subject_abbreviation) as "subjectAbbreviation",
              MAX(subject_code) as "subjectCode",
              AVG(${scoreExpr}) as "overallRating",
              COUNT(*) as "totalResponses",
              COUNT(DISTINCT faculty_id) as "facultyCount",
              COUNT(DISTINCT division_id) as "divisionCount",
              AVG(CASE WHEN ${labCondition} THEN ${scoreExpr} ELSE NULL END) as "labRating",
              SUM(CASE WHEN ${labCondition} THEN 1 ELSE 0 END) as "labResponses",
              AVG(CASE WHEN NOT (${labCondition}) THEN ${scoreExpr} ELSE NULL END) as "lectureRating",
              SUM(CASE WHEN NOT (${labCondition}) THEN 1 ELSE 0 END) as "lectureResponses"
          FROM feedback_snapshots
          ${whereSql} AND ${scoreExpr} > 0
          GROUP BY subject_id
          ORDER BY "overallRating" DESC
      `;

      // 3. Faculty Performance
      const facultyQuery = prisma.$queryRaw<any[]>`
          SELECT
              faculty_id as "facultyId",
              MAX(faculty_name) as "facultyName",
              MAX(faculty_abbreviation) as "facultyAbbreviation",
              AVG(${scoreExpr}) as "averageRating",
              COUNT(*) as "totalResponses",
              COUNT(DISTINCT subject_id) as "subjectCount",
              COUNT(DISTINCT division_id) as "divisionCount"
          FROM feedback_snapshots
          ${whereSql} AND ${scoreExpr} > 0
          GROUP BY faculty_id
          ORDER BY "averageRating" DESC
      `;

      // 4. Division Performance
      const divisionQuery = prisma.$queryRaw<any[]>`
          SELECT
              division_id as "divisionId",
              MAX(division_name) as "divisionName",
              MAX(semester_number) as "semesterNumber",
              MAX(department_name) as "departmentName",
              AVG(${scoreExpr}) as "averageRating",
              COUNT(*) as "totalResponses",
              COUNT(DISTINCT faculty_id) as "facultyCount",
              COUNT(DISTINCT subject_id) as "subjectCount"
          FROM feedback_snapshots
          ${whereSql} AND ${scoreExpr} > 0
          GROUP BY division_id
          ORDER BY "averageRating" DESC
      `;

      // 5. Subject Faculty Performance
      const subjectFacultyQuery = prisma.$queryRaw<any[]>`
          SELECT
              subject_id as "subjectId",
              MAX(subject_name) as "subjectName",
              MAX(subject_abbreviation) as "subjectAbbreviation",
              faculty_id as "facultyId",
              MAX(faculty_name) as "facultyName",
              AVG(${scoreExpr}) as "rating",
              COUNT(*) as "responses"
          FROM feedback_snapshots
          ${whereSql} AND ${scoreExpr} > 0
          GROUP BY subject_id, faculty_id
          ORDER BY "rating" DESC
      `;

      // 6. Batch Comparisons
      const batchQuery = prisma.$queryRaw<any[]>`
          SELECT
              MAX(department_id) as "departmentId",
              MAX(department_name) as "departmentName",
              division_id as "divisionId",
              MAX(division_name) as "divisionName",
              question_batch as "batch",
              AVG(${scoreExpr}) as "averageRating",
              COUNT(*) as "totalResponses"
          FROM feedback_snapshots
          ${whereSql} AND ${scoreExpr} > 0 AND question_batch IS NOT NULL AND question_batch NOT ILIKE 'none' AND question_batch != ''
          GROUP BY division_id, question_batch
          ORDER BY "divisionName" ASC, "batch" ASC
      `;

      // 7. Academic Year Trends
      const academicYearQuery = prisma.$queryRaw<any[]>`
          SELECT
              academic_year_id as "academicYearId",
              MAX(academic_year_string) as "academicYearString",
              AVG(${scoreExpr}) as "averageRating",
              COUNT(*) as "totalResponses",
              COUNT(DISTINCT department_id) as "departmentCount",
              COUNT(DISTINCT division_id) as "divisionCount"
          FROM feedback_snapshots
          ${whereSql} AND ${scoreExpr} > 0
          GROUP BY academic_year_id
          ORDER BY "academicYearString" ASC
      `;

      // 8. Semester Trends
      const semesterQuery = prisma.$queryRaw<any[]>`
          SELECT
              semester_number as "semesterNumber",
              academic_year_id as "academicYearId",
              MAX(academic_year_string) as "academicYearString",
              AVG(${scoreExpr}) as "averageRating",
              COUNT(*) as "responseCount"
          FROM feedback_snapshots
          ${whereSql} AND ${scoreExpr} > 0
          GROUP BY semester_number, academic_year_id
          ORDER BY "semesterNumber" ASC, "academicYearString" ASC
      `;

      // 9. Department Trends
      const deptQuery = prisma.$queryRaw<any[]>`
          SELECT
              department_id as "departmentId",
              MAX(department_name) as "departmentName",
              academic_year_id as "academicYearId",
              MAX(academic_year_string) as "academicYearString",
              AVG(${scoreExpr}) as "averageRating",
              COUNT(*) as "responseCount"
          FROM feedback_snapshots
          ${whereSql} AND ${scoreExpr} > 0
          GROUP BY department_id, academic_year_id
          ORDER BY "departmentName" ASC, "academicYearString" ASC
      `;

      // 10. Academic Year Division Trends
      const ayDivisionQuery = prisma.$queryRaw<any[]>`
          SELECT
              academic_year_id as "academicYearId",
              MAX(academic_year_string) as "academicYearString",
              division_id as "divisionId",
              MAX(division_name) as "divisionName",
              AVG(${scoreExpr}) as "averageRating",
              COUNT(*) as "responseCount"
          FROM feedback_snapshots
          ${whereSql} AND ${scoreExpr} > 0
          GROUP BY academic_year_id, division_id
          ORDER BY "academicYearString" ASC, "divisionName" ASC
      `;

      const [
        overallRes, subjectRes, facultyRes, divisionRes, subjectFacultyRes,
        batchRes, academicYearRes, semesterRes, deptRes, ayDivisionRes
      ] = await Promise.all([
        overallQuery, subjectQuery, facultyQuery, divisionQuery, subjectFacultyQuery,
        batchQuery, academicYearQuery, semesterQuery, deptQuery, ayDivisionQuery
      ]);

      // --- Formatting Results ---

      const overallStats = overallRes[0] ? {
        totalResponses: Number(overallRes[0].totalResponses || 0),
        averageRating: Number(Number(overallRes[0].averageRating || 0).toFixed(2)),
        uniqueSubjects: Number(overallRes[0].uniqueSubjects || 0),
        uniqueFaculties: Number(overallRes[0].uniqueFaculties || 0),
        uniqueStudents: Number(overallRes[0].uniqueStudents || 0),
        uniqueDivisions: Number(overallRes[0].uniqueDivisions || 0),
      } : {
        totalResponses: 0, averageRating: 0, uniqueSubjects: 0,
        uniqueFaculties: 0, uniqueStudents: 0, uniqueDivisions: 0
      };

      const subjectRatings = subjectRes.map((r: any) => ({
        subjectId: r.subjectId,
        subjectName: r.subjectName,
        subjectAbbreviation: r.subjectAbbreviation,
        subjectCode: r.subjectCode,
        lectureRating: r.lectureRating ? Number(Number(r.lectureRating).toFixed(2)) : null,
        labRating: r.labRating ? Number(Number(r.labRating).toFixed(2)) : null,
        overallRating: Number(Number(r.overallRating).toFixed(2)),
        lectureResponses: Number(r.lectureResponses || 0),
        labResponses: Number(r.labResponses || 0),
        totalResponses: Number(r.totalResponses || 0),
        facultyCount: Number(r.facultyCount || 0),
        divisionCount: Number(r.divisionCount || 0)
      }));

      const facultyPerformance = facultyRes.map((r: any, index: number) => ({
        facultyId: r.facultyId,
        facultyName: r.facultyName,
        facultyAbbreviation: r.facultyAbbreviation,
        designation: r.designation || 'N/A', // Assuming designation comes if available
        averageRating: Number(Number(r.averageRating).toFixed(2)),
        totalResponses: Number(r.totalResponses || 0),
        rank: index + 1,
        subjectCount: Number(r.subjectCount || 0),
        divisionCount: Number(r.divisionCount || 0)
      }));

      const divisionPerformance = divisionRes.map((r: any) => ({
        divisionId: r.divisionId,
        divisionName: r.divisionName,
        departmentName: r.departmentName,
        semesterNumber: Number(r.semesterNumber || 0),
        averageRating: Number(Number(r.averageRating).toFixed(2)),
        totalResponses: Number(r.totalResponses || 0),
        facultyCount: Number(r.facultyCount || 0),
        subjectCount: Number(r.subjectCount || 0)
      })).sort((a, b) => a.divisionName.localeCompare(b.divisionName));

      // Subject Faculty nested mapping
      const subjectFacultyMap = new Map<string, any>();
      subjectFacultyRes.forEach((r: any) => {
        if (!subjectFacultyMap.has(r.subjectId)) {
          // Find overall rating + responses from subjectRes
          const subjData = subjectRatings.find((s: any) => s.subjectId === r.subjectId);
          subjectFacultyMap.set(r.subjectId, {
            subjectName: r.subjectName,
            subjectAbbreviation: r.subjectAbbreviation,
            overallSubjectAverage: subjData?.overallRating || null,
            overallSubjectResponses: subjData?.totalResponses || 0,
            facultyData: []
          });
        }
        subjectFacultyMap.get(r.subjectId).facultyData.push({
          facultyId: r.facultyId,
          facultyName: r.facultyName,
          averageRating: Number(Number(r.rating).toFixed(2)),
          responseCount: Number(r.responses || 0)
        });
      });
      const subjectFacultyPerformance = Array.from(subjectFacultyMap.values())
        .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

      // Batch Comparison
      const batchComparisons = batchRes.map((r: any) => ({
        departmentId: r.departmentId,
        departmentName: r.departmentName,
        divisionId: r.divisionId,
        divisionName: r.divisionName,
        batch: r.batch,
        averageRating: Number(Number(r.averageRating).toFixed(2)),
        totalResponses: Number(r.totalResponses || 0),
        engagementScore: Math.min(10, Math.round(Number(r.totalResponses || 0) / 5))
      }));

      // Academic Year Trends
      const academicYearTrends = academicYearRes.map((r: any) => ({
        academicYearId: r.academicYearId,
        academicYearString: r.academicYearString,
        averageRating: Number(Number(r.averageRating).toFixed(2)),
        totalResponses: Number(r.totalResponses || 0),
        departmentCount: Number(r.departmentCount || 0),
        divisionCount: Number(r.divisionCount || 0)
      }));

      // Semester Trends (Nested)
      const semesterMap = new Map<number, any>();
      semesterRes.forEach((r: any) => {
        const sem = Number(r.semesterNumber || 0);
        if (!semesterMap.has(sem)) {
          semesterMap.set(sem, { semesterNumber: sem, academicYearData: [] });
        }
        semesterMap.get(sem).academicYearData.push({
          academicYearId: r.academicYearId,
          academicYearString: r.academicYearString,
          averageRating: Number(Number(r.averageRating).toFixed(2)),
          responseCount: Number(r.responseCount || 0)
        });
      });
      const semesterTrends = Array.from(semesterMap.values())
        .map(s => {
          s.academicYearData.sort((a: any, b: any) => a.academicYearString.localeCompare(b.academicYearString));
          return s;
        })
        .sort((a, b) => a.semesterNumber - b.semesterNumber);

      // Department Trends (Nested)
      const deptMap = new Map<string, any>();
      deptRes.forEach((r: any) => {
        if (!deptMap.has(r.academicYearString)) {
          deptMap.set(r.academicYearString, {
            academicYearString: r.academicYearString,
            departmentData: []
          });
        }
        deptMap.get(r.academicYearString).departmentData.push({
          departmentId: r.departmentId,
          departmentName: r.departmentName,
          averageRating: Number(Number(r.averageRating).toFixed(2)),
          responseCount: Number(r.responseCount || 0)
        });
      });
      const departmentTrends = Array.from(deptMap.values())
        .map(d => {
          d.departmentData.sort((a: any, b: any) => a.departmentName.localeCompare(b.departmentName));
          return d;
        })
        .sort((a, b) => a.academicYearString.localeCompare(b.academicYearString));

      // Academic Year Division Trends (Nested)
      const ayDivMap = new Map<string, any>();
      ayDivisionRes.forEach((r: any) => {
        if (!ayDivMap.has(r.academicYearString)) {
          ayDivMap.set(r.academicYearString, {
            academicYearString: r.academicYearString,
            divisionData: []
          });
        }
        ayDivMap.get(r.academicYearString).divisionData.push({
          divisionName: r.divisionName,
          averageRating: Number(Number(r.averageRating).toFixed(2)),
          responseCount: Number(r.responseCount || 0)
        });
      });
      const academicYearDivisionTrends = Array.from(ayDivMap.values())
        .map(d => {
          d.divisionData.sort((a: any, b: any) => a.divisionName.localeCompare(b.divisionName));
          return d;
        })
        .sort((a, b) => a.academicYearString.localeCompare(b.academicYearString));

      return {
        overallStats,
        subjectRatings,
        facultyPerformance,
        divisionPerformance,
        subjectFacultyPerformance,
        batchComparisons,
        academicYearTrends,
        semesterTrends,
        departmentTrends,
        academicYearDivisionTrends,
        filters: {
          academicYearId,
          departmentId,
          semesterId,
          divisionId,
          subjectId,
          lectureType,
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('Error in AnalyticsService.getOptimizedAnalyticsData:', error);
      throw new AppError('Failed to retrieve optimized analytics data.', 500);
    }
  }

  // ==================== DETAILED DRILL-DOWN ENDPOINTS ====================

  public async getSubjectDetailedAnalytics(
    subjectId: string,
    academicYearId?: string,
    semesterId?: string,
    departmentId?: string
  ): Promise<SubjectDetailedAnalytics> {
    try {
      // Build where conditions for FeedbackSnapshot table
      const whereClause: Prisma.FeedbackSnapshotWhereInput = {
        subjectId,
        isDeleted: false,
        subjectIsDeleted: false,
        formIsDeleted: false,
        questionIsDeleted: false,
        semesterIsDeleted: false,
        divisionIsDeleted: false,
        departmentIsDeleted: false,
        academicYearIsDeleted: false,
      };

      if (academicYearId) {
        whereClause.academicYearId = academicYearId;
      }
      if (semesterId) {
        whereClause.semesterId = semesterId;
      }
      if (departmentId) {
        whereClause.departmentId = departmentId;
      }

      // Fetch subject data from FeedbackSnapshot (same source as getCompleteAnalyticsData)
      const snapshots = await prisma.feedbackSnapshot.findMany({
        where: whereClause,
        select: {
          subjectId: true,
          subjectName: true,
          subjectAbbreviation: true,
          subjectCode: true,
          facultyId: true,
          facultyName: true,
          facultyAbbreviation: true,
          divisionId: true,
          divisionName: true,
          questionCategoryId: true,
          questionCategoryName: true,
          questionBatch: true,
          responseValue: true,
        },
      });

      console.log(`[getSubjectDetailedAnalytics] FeedbackSnapshot query returned ${snapshots.length} results for subjectId: ${subjectId}, academicYearId: ${academicYearId}, semesterId: ${semesterId}, departmentId: ${departmentId}`);

      if (snapshots.length === 0) {
        // Check if the subject exists at all
        const subjectExists = await prisma.subject.findUnique({
          where: { id: subjectId },
          select: { id: true, name: true, isDeleted: true },
        });

        if (!subjectExists) {
          throw new AppError(`Subject with ID ${subjectId} does not exist.`, 404);
        }
        if (subjectExists.isDeleted) {
          throw new AppError(`Subject "${subjectExists.name}" has been deleted.`, 404);
        }
        throw new AppError(`Subject "${subjectExists.name}" has no feedback data matching the selected filters.`, 404);
      }

      const firstSnapshot = snapshots[0];

      // Derive lectureType from questionCategoryName or questionBatch
      const deriveLectureType = (snapshot: typeof snapshots[0]): 'LECTURE' | 'LAB' => {
        if (
          snapshot.questionCategoryName?.toLowerCase().includes('laboratory') ||
          snapshot.questionCategoryName?.toLowerCase().includes('lab')
        ) {
          return 'LAB';
        } else if (
          snapshot.questionBatch &&
          snapshot.questionBatch.toLowerCase() !== 'none'
        ) {
          return 'LAB';
        }
        return 'LECTURE';
      };

      // Calculate overall and lecture/lab ratings
      const lectureScores: number[] = [];
      const labScores: number[] = [];

      snapshots.forEach(s => {
        const score = this.parseResponseValueToScore(s.responseValue);
        const lectureType = deriveLectureType(s);
        if (score !== null && score > 0) {
          if (lectureType === 'LECTURE') {
            lectureScores.push(score);
          } else {
            labScores.push(score);
          }
        }
      });

      const allScores = [...lectureScores, ...labScores];

      // Faculty breakdown
      const facultyMap = new Map<string, {
        facultyId: string;
        facultyName: string;
        facultyAbbreviation: string;
        lectureType: 'LECTURE' | 'LAB';
        scores: number[];
        divisions: Set<string>;
      }>();

      snapshots.forEach(s => {
        const score = this.parseResponseValueToScore(s.responseValue);
        if (score === null || score <= 0) return;

        const lectureType = deriveLectureType(s);
        const key = `${s.facultyId}-${lectureType}`;
        if (!facultyMap.has(key)) {
          facultyMap.set(key, {
            facultyId: s.facultyId,
            facultyName: s.facultyName,
            facultyAbbreviation: s.facultyAbbreviation,
            lectureType: lectureType,
            scores: [],
            divisions: new Set(),
          });
        }
        const faculty = facultyMap.get(key)!;
        faculty.scores.push(score);
        faculty.divisions.add(s.divisionName);
      });

      const facultyBreakdown = Array.from(facultyMap.values()).map(f => ({
        facultyId: f.facultyId,
        facultyName: f.facultyName,
        facultyAbbreviation: f.facultyAbbreviation,
        lectureType: f.lectureType,
        rating: Number((f.scores.reduce((a, b) => a + b, 0) / f.scores.length).toFixed(2)),
        responses: f.scores.length,
        divisions: Array.from(f.divisions),
      }));

      // Division breakdown
      const divisionMap = new Map<string, {
        divisionId: string;
        divisionName: string;
        lectureScores: number[];
        labScores: number[];
      }>();

      snapshots.forEach(s => {
        const score = this.parseResponseValueToScore(s.responseValue);
        if (score === null || score <= 0) return;

        const lectureType = deriveLectureType(s);
        if (!divisionMap.has(s.divisionId)) {
          divisionMap.set(s.divisionId, {
            divisionId: s.divisionId,
            divisionName: s.divisionName,
            lectureScores: [],
            labScores: [],
          });
        }
        const division = divisionMap.get(s.divisionId)!;
        if (lectureType === 'LECTURE') {
          division.lectureScores.push(score);
        } else {
          division.labScores.push(score);
        }
      });

      const divisionBreakdown = Array.from(divisionMap.values()).map(d => {
        const allDivScores = [...d.lectureScores, ...d.labScores];
        return {
          divisionId: d.divisionId,
          divisionName: d.divisionName,
          lectureRating: d.lectureScores.length > 0
            ? Number((d.lectureScores.reduce((a, b) => a + b, 0) / d.lectureScores.length).toFixed(2))
            : null,
          labRating: d.labScores.length > 0
            ? Number((d.labScores.reduce((a, b) => a + b, 0) / d.labScores.length).toFixed(2))
            : null,
          totalRating: allDivScores.length > 0
            ? Number((allDivScores.reduce((a, b) => a + b, 0) / allDivScores.length).toFixed(2))
            : 0,
          responses: allDivScores.length,
        };
      });

      // Question category breakdown
      const categoryMap = new Map<string, {
        categoryId: string;
        categoryName: string;
        scores: number[];
      }>();

      snapshots.forEach(s => {
        const score = this.parseResponseValueToScore(s.responseValue);
        if (score === null || score <= 0 || !s.questionCategoryId) return;

        if (!categoryMap.has(s.questionCategoryId)) {
          categoryMap.set(s.questionCategoryId, {
            categoryId: s.questionCategoryId,
            categoryName: s.questionCategoryName,
            scores: [],
          });
        }
        categoryMap.get(s.questionCategoryId)!.scores.push(score);
      });

      const questionBreakdown = Array.from(categoryMap.values()).map(c => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        avgRating: Number((c.scores.reduce((a, b) => a + b, 0) / c.scores.length).toFixed(2)),
        questionCount: c.scores.length,
      }));

      return {
        subject: {
          id: firstSnapshot.subjectId,
          name: firstSnapshot.subjectName,
          abbreviation: firstSnapshot.subjectAbbreviation,
          code: firstSnapshot.subjectCode,
        },
        overallRating: allScores.length > 0
          ? Number((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2))
          : 0,
        lectureRating: lectureScores.length > 0
          ? Number((lectureScores.reduce((a, b) => a + b, 0) / lectureScores.length).toFixed(2))
          : null,
        labRating: labScores.length > 0
          ? Number((labScores.reduce((a, b) => a + b, 0) / labScores.length).toFixed(2))
          : null,
        totalResponses: allScores.length,
        lectureResponses: lectureScores.length,
        labResponses: labScores.length,
        facultyBreakdown,
        divisionBreakdown,
        questionBreakdown,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      console.error('Error in AnalyticsService.getSubjectDetailedAnalytics:', error);
      throw new AppError('Failed to retrieve subject detailed analytics.', 500);
    }
  }

  public async getFacultyDetailedAnalytics(
    facultyId: string,
    academicYearId?: string
  ): Promise<FacultyDetailedAnalytics> {
    try {
      // Build where conditions for FeedbackSnapshot table
      const whereClause: Prisma.FeedbackSnapshotWhereInput = {
        facultyId,
        isDeleted: false,
        formIsDeleted: false,
        questionIsDeleted: false,
        semesterIsDeleted: false,
        divisionIsDeleted: false,
        subjectIsDeleted: false,
        academicYearIsDeleted: false,
      };

      if (academicYearId) {
        whereClause.academicYearId = academicYearId;
      }

      // Fetch faculty data from FeedbackSnapshot (same source as getCompleteAnalyticsData)
      const snapshots = await prisma.feedbackSnapshot.findMany({
        where: whereClause,
        select: {
          facultyId: true,
          facultyName: true,
          facultyAbbreviation: true,
          subjectId: true,
          subjectName: true,
          subjectAbbreviation: true,
          divisionId: true,
          divisionName: true,
          semesterNumber: true,
          academicYearId: true,
          academicYearString: true,
          questionCategoryId: true,
          questionCategoryName: true,
          questionBatch: true,
          responseValue: true,
        },
      });

      console.log(`[getFacultyDetailedAnalytics] FeedbackSnapshot query returned ${snapshots.length} results for facultyId: ${facultyId}, academicYearId: ${academicYearId}`);

      if (snapshots.length === 0) {
        // Check if the faculty exists at all
        const facultyExists = await prisma.faculty.findUnique({
          where: { id: facultyId },
          select: { id: true, name: true, isDeleted: true },
        });

        if (!facultyExists) {
          throw new AppError(`Faculty with ID ${facultyId} does not exist.`, 404);
        }
        if (facultyExists.isDeleted) {
          throw new AppError(`Faculty "${facultyExists.name}" has been deleted.`, 404);
        }
        throw new AppError(`Faculty "${facultyExists.name}" has no feedback data matching the selected filters.`, 404);
      }

      // Get faculty designation from the faculty table
      const faculty = await prisma.faculty.findUnique({
        where: { id: facultyId },
        select: { designation: true },
      });

      const firstSnapshot = snapshots[0];

      // Derive lectureType from questionCategoryName or questionBatch
      const deriveLectureType = (snapshot: typeof snapshots[0]): 'LECTURE' | 'LAB' => {
        if (
          snapshot.questionCategoryName?.toLowerCase().includes('laboratory') ||
          snapshot.questionCategoryName?.toLowerCase().includes('lab')
        ) {
          return 'LAB';
        } else if (
          snapshot.questionBatch &&
          snapshot.questionBatch.toLowerCase() !== 'none'
        ) {
          return 'LAB';
        }
        return 'LECTURE';
      };

      const allScores = snapshots
        .map(s => this.parseResponseValueToScore(s.responseValue))
        .filter((score): score is number => score !== null && score > 0);

      // Get faculty rank using FeedbackSnapshot
      const allFacultySnapshots = await prisma.feedbackSnapshot.findMany({
        where: {
          isDeleted: false,
          formIsDeleted: false,
          academicYearIsDeleted: false,
          ...(academicYearId && { academicYearId }),
        },
        select: {
          facultyId: true,
          facultyName: true,
          responseValue: true,
        },
      });

      const facultyScoreMap = new Map<string, { name: string; scores: number[] }>();
      allFacultySnapshots.forEach(s => {
        const score = this.parseResponseValueToScore(s.responseValue);
        if (score === null || score <= 0) return;
        if (!facultyScoreMap.has(s.facultyId)) {
          facultyScoreMap.set(s.facultyId, { name: s.facultyName, scores: [] });
        }
        facultyScoreMap.get(s.facultyId)!.scores.push(score);
      });

      const rankedFaculty = Array.from(facultyScoreMap.entries())
        .map(([id, data]) => ({
          facultyId: id,
          avgRating: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        }))
        .sort((a, b) => b.avgRating - a.avgRating);

      const rank = rankedFaculty.findIndex(f => f.facultyId === facultyId) + 1;
      const totalFaculty = rankedFaculty.length;

      // Subject breakdown
      const subjectMap = new Map<string, {
        subjectId: string;
        subjectName: string;
        subjectAbbreviation: string;
        lectureType: 'LECTURE' | 'LAB';
        scores: number[];
        semester: number;
        academicYear: string;
      }>();

      snapshots.forEach(s => {
        const score = this.parseResponseValueToScore(s.responseValue);
        if (score === null || score <= 0) return;

        const lectureType = deriveLectureType(s);
        const key = `${s.subjectId}-${lectureType}`;
        if (!subjectMap.has(key)) {
          subjectMap.set(key, {
            subjectId: s.subjectId,
            subjectName: s.subjectName,
            subjectAbbreviation: s.subjectAbbreviation,
            lectureType,
            scores: [],
            semester: s.semesterNumber,
            academicYear: s.academicYearString,
          });
        }
        subjectMap.get(key)!.scores.push(score);
      });

      const subjectBreakdown = Array.from(subjectMap.values()).map(s => ({
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        subjectAbbreviation: s.subjectAbbreviation,
        lectureType: s.lectureType,
        rating: Number((s.scores.reduce((a, b) => a + b, 0) / s.scores.length).toFixed(2)),
        responses: s.scores.length,
        semester: s.semester,
        academicYear: s.academicYear,
      }));

      // Division breakdown
      const divisionMap = new Map<string, {
        divisionId: string;
        divisionName: string;
        subjectName: string;
        lectureType: 'LECTURE' | 'LAB';
        scores: number[];
      }>();

      snapshots.forEach(s => {
        const score = this.parseResponseValueToScore(s.responseValue);
        if (score === null || score <= 0) return;

        const lectureType = deriveLectureType(s);
        const key = `${s.divisionId}-${s.subjectId}-${lectureType}`;
        if (!divisionMap.has(key)) {
          divisionMap.set(key, {
            divisionId: s.divisionId,
            divisionName: s.divisionName,
            subjectName: s.subjectName,
            lectureType,
            scores: [],
          });
        }
        divisionMap.get(key)!.scores.push(score);
      });

      const divisionBreakdown = Array.from(divisionMap.values()).map(d => ({
        divisionId: d.divisionId,
        divisionName: d.divisionName,
        subjectName: d.subjectName,
        lectureType: d.lectureType,
        rating: Number((d.scores.reduce((a, b) => a + b, 0) / d.scores.length).toFixed(2)),
        responses: d.scores.length,
      }));

      // Question category breakdown
      const categoryMap = new Map<string, {
        category: string;
        scores: number[];
      }>();

      snapshots.forEach(s => {
        const score = this.parseResponseValueToScore(s.responseValue);
        if (score === null || score <= 0 || !s.questionCategoryName) return;

        if (!categoryMap.has(s.questionCategoryName)) {
          categoryMap.set(s.questionCategoryName, {
            category: s.questionCategoryName,
            scores: [],
          });
        }
        categoryMap.get(s.questionCategoryName)!.scores.push(score);
      });

      const questionCategoryBreakdown = Array.from(categoryMap.values()).map(c => ({
        category: c.category,
        avgRating: Number((c.scores.reduce((a, b) => a + b, 0) / c.scores.length).toFixed(2)),
        questionCount: c.scores.length,
      }));

      // Trend data across academic years
      const trendMap = new Map<string, {
        academicYearId: string;
        academicYear: string;
        semester: number;
        scores: number[];
      }>();

      snapshots.forEach(s => {
        const score = this.parseResponseValueToScore(s.responseValue);
        if (score === null || score <= 0) return;

        const key = `${s.academicYearId}-${s.semesterNumber}`;
        if (!trendMap.has(key)) {
          trendMap.set(key, {
            academicYearId: s.academicYearId,
            academicYear: s.academicYearString,
            semester: s.semesterNumber,
            scores: [],
          });
        }
        trendMap.get(key)!.scores.push(score);
      });

      const trendData = Array.from(trendMap.values())
        .map(t => ({
          academicYearId: t.academicYearId,
          academicYear: t.academicYear,
          semester: t.semester,
          rating: Number((t.scores.reduce((a, b) => a + b, 0) / t.scores.length).toFixed(2)),
          responses: t.scores.length,
        }))
        .sort((a, b) => a.academicYear.localeCompare(b.academicYear) || a.semester - b.semester);

      return {
        faculty: {
          id: firstSnapshot.facultyId,
          name: firstSnapshot.facultyName,
          abbreviation: firstSnapshot.facultyAbbreviation,
          designation: faculty?.designation || '',
        },
        overallRating: allScores.length > 0
          ? Number((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2))
          : 0,
        totalResponses: allScores.length,
        rank,
        totalFaculty,
        subjectBreakdown,
        divisionBreakdown,
        questionCategoryBreakdown,
        trendData,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      console.error('Error in AnalyticsService.getFacultyDetailedAnalytics:', error);
      throw new AppError('Failed to retrieve faculty detailed analytics.', 500);
    }
  }

  // Helper to get all faculty snapshots for ranking
  private async getAllFacultySnapshots(academicYearId?: string): Promise<any[]> {
    const whereConditions: Prisma.Sql[] = [
      Prisma.sql`sr.is_deleted = false`,
      Prisma.sql`ff.is_deleted = false`,
      Prisma.sql`sa.is_deleted = false`,
      Prisma.sql`fac.is_deleted = false`,
    ];

    if (academicYearId) {
      whereConditions.push(Prisma.sql`ay.id = ${academicYearId}`);
    }

    const whereClause = Prisma.sql`WHERE ${Prisma.join(whereConditions, ' AND ')}`;

    return prisma.$queryRaw<any[]>`
      SELECT
        fac.id AS "facultyId",
        fac.name AS "facultyName",
        COALESCE(fac.abbreviation, '') AS "facultyAbbreviation",
        fac.designation AS "facultyDesignation",
        sr.response_value AS "responseValue"
      FROM student_responses sr
      INNER JOIN feedback_forms ff ON sr.feedback_form_id = ff.id
      INNER JOIN subject_allocations sa ON ff.subject_allocation_id = sa.id
      INNER JOIN faculties fac ON sa.faculty_id = fac.id
      INNER JOIN semesters sem ON sa.semester_id = sem.id
      INNER JOIN academic_years ay ON sem.academic_year_id = ay.id
      ${whereClause}
    `;
  }

  public async getDivisionDetailedAnalytics(
    divisionId: string,
    academicYearId?: string
  ): Promise<DivisionDetailedAnalytics> {
    try {
      // Build where conditions for FeedbackSnapshot table
      const whereClause: Prisma.FeedbackSnapshotWhereInput = {
        divisionId,
        isDeleted: false,
        formIsDeleted: false,
        questionIsDeleted: false,
        semesterIsDeleted: false,
        divisionIsDeleted: false,
        subjectIsDeleted: false,
        departmentIsDeleted: false,
        academicYearIsDeleted: false,
      };

      if (academicYearId) {
        whereClause.academicYearId = academicYearId;
      }

      // Fetch division data from FeedbackSnapshot (same source as getCompleteAnalyticsData)
      const snapshots = await prisma.feedbackSnapshot.findMany({
        where: whereClause,
        select: {
          divisionId: true,
          divisionName: true,
          departmentName: true,
          semesterNumber: true,
          facultyId: true,
          facultyName: true,
          facultyAbbreviation: true,
          subjectId: true,
          subjectName: true,
          subjectAbbreviation: true,
          academicYearId: true,
          academicYearString: true,
          questionCategoryName: true,
          questionBatch: true,
          responseValue: true,
        },
      });

      console.log(`[getDivisionDetailedAnalytics] FeedbackSnapshot query returned ${snapshots.length} results for divisionId: ${divisionId}, academicYearId: ${academicYearId}`);

      if (snapshots.length === 0) {
        // Check if the division exists at all
        const divisionExists = await prisma.division.findUnique({
          where: { id: divisionId },
          select: { id: true, divisionName: true, isDeleted: true },
        });

        if (!divisionExists) {
          throw new AppError(`Division with ID ${divisionId} does not exist.`, 404);
        }
        if (divisionExists.isDeleted) {
          throw new AppError(`Division "${divisionExists.divisionName}" has been deleted.`, 404);
        }
        throw new AppError(`Division "${divisionExists.divisionName}" has no feedback data matching the selected filters.`, 404);
      }

      const firstSnapshot = snapshots[0];

      // Derive lectureType from questionCategoryName or questionBatch
      const deriveLectureType = (snapshot: typeof snapshots[0]): 'LECTURE' | 'LAB' => {
        if (
          snapshot.questionCategoryName?.toLowerCase().includes('laboratory') ||
          snapshot.questionCategoryName?.toLowerCase().includes('lab')
        ) {
          return 'LAB';
        } else if (
          snapshot.questionBatch &&
          snapshot.questionBatch.toLowerCase() !== 'none'
        ) {
          return 'LAB';
        }
        return 'LECTURE';
      };

      const allScores = snapshots
        .map(s => this.parseResponseValueToScore(s.responseValue))
        .filter((score): score is number => score !== null && score > 0);

      // Faculty breakdown
      const facultyMap = new Map<string, {
        facultyId: string;
        facultyName: string;
        facultyAbbreviation: string;
        subjectName: string;
        lectureType: 'LECTURE' | 'LAB';
        scores: number[];
      }>();

      snapshots.forEach(s => {
        const score = this.parseResponseValueToScore(s.responseValue);
        if (score === null || score <= 0) return;

        const lectureType = deriveLectureType(s);
        const key = `${s.facultyId}-${s.subjectId}-${lectureType}`;
        if (!facultyMap.has(key)) {
          facultyMap.set(key, {
            facultyId: s.facultyId,
            facultyName: s.facultyName,
            facultyAbbreviation: s.facultyAbbreviation,
            subjectName: s.subjectName,
            lectureType,
            scores: [],
          });
        }
        facultyMap.get(key)!.scores.push(score);
      });

      const facultyBreakdown = Array.from(facultyMap.values()).map(f => ({
        facultyId: f.facultyId,
        facultyName: f.facultyName,
        facultyAbbreviation: f.facultyAbbreviation,
        subjectName: f.subjectName,
        lectureType: f.lectureType,
        rating: Number((f.scores.reduce((a, b) => a + b, 0) / f.scores.length).toFixed(2)),
        responses: f.scores.length,
      }));

      // Subject breakdown
      const subjectMap = new Map<string, {
        subjectId: string;
        subjectName: string;
        subjectAbbreviation: string;
        lectureScores: number[];
        labScores: number[];
      }>();

      snapshots.forEach(s => {
        const score = this.parseResponseValueToScore(s.responseValue);
        if (score === null || score <= 0) return;

        const lectureType = deriveLectureType(s);
        if (!subjectMap.has(s.subjectId)) {
          subjectMap.set(s.subjectId, {
            subjectId: s.subjectId,
            subjectName: s.subjectName,
            subjectAbbreviation: s.subjectAbbreviation,
            lectureScores: [],
            labScores: [],
          });
        }
        const subject = subjectMap.get(s.subjectId)!;
        if (lectureType === 'LECTURE') {
          subject.lectureScores.push(score);
        } else {
          subject.labScores.push(score);
        }
      });

      const subjectBreakdown = Array.from(subjectMap.values()).map(s => {
        const allSubjectScores = [...s.lectureScores, ...s.labScores];
        return {
          subjectId: s.subjectId,
          subjectName: s.subjectName,
          subjectAbbreviation: s.subjectAbbreviation,
          lectureRating: s.lectureScores.length > 0
            ? Number((s.lectureScores.reduce((a, b) => a + b, 0) / s.lectureScores.length).toFixed(2))
            : null,
          labRating: s.labScores.length > 0
            ? Number((s.labScores.reduce((a, b) => a + b, 0) / s.labScores.length).toFixed(2))
            : null,
          totalRating: allSubjectScores.length > 0
            ? Number((allSubjectScores.reduce((a, b) => a + b, 0) / allSubjectScores.length).toFixed(2))
            : 0,
          responses: allSubjectScores.length,
        };
      });

      // Academic year comparison
      const yearMap = new Map<string, {
        academicYearId: string;
        academicYearString: string;
        scores: number[];
      }>();

      snapshots.forEach(s => {
        const score = this.parseResponseValueToScore(s.responseValue);
        if (score === null || score <= 0) return;

        if (!yearMap.has(s.academicYearId)) {
          yearMap.set(s.academicYearId, {
            academicYearId: s.academicYearId,
            academicYearString: s.academicYearString,
            scores: [],
          });
        }
        yearMap.get(s.academicYearId)!.scores.push(score);
      });

      const academicYearComparison = Array.from(yearMap.values())
        .map(y => ({
          academicYearId: y.academicYearId,
          academicYearString: y.academicYearString,
          rating: Number((y.scores.reduce((a, b) => a + b, 0) / y.scores.length).toFixed(2)),
          responses: y.scores.length,
        }))
        .sort((a, b) => a.academicYearString.localeCompare(b.academicYearString));

      return {
        division: {
          id: firstSnapshot.divisionId,
          name: firstSnapshot.divisionName,
          departmentName: firstSnapshot.departmentName,
          semesterNumber: firstSnapshot.semesterNumber,
        },
        overallRating: allScores.length > 0
          ? Number((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2))
          : 0,
        totalResponses: allScores.length,
        facultyBreakdown,
        subjectBreakdown,
        academicYearComparison,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      console.error('Error in AnalyticsService.getDivisionDetailedAnalytics:', error);
      throw new AppError('Failed to retrieve division detailed analytics.', 500);
    }
  }
}

export const analyticsService = new AnalyticsService();
