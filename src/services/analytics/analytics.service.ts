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
      // Build the filter conditions
      const whereConditions: Prisma.Sql[] = [];

      if (!includeDeleted) {
        whereConditions.push(Prisma.sql`sr.is_deleted = false`);
        whereConditions.push(Prisma.sql`ff.is_deleted = false`);
        whereConditions.push(Prisma.sql`sa.is_deleted = false`);
        whereConditions.push(Prisma.sql`sem.is_deleted = false`);
        whereConditions.push(Prisma.sql`div.is_deleted = false`);
        whereConditions.push(Prisma.sql`sub.is_deleted = false`);
        whereConditions.push(Prisma.sql`fac.is_deleted = false`);
        whereConditions.push(Prisma.sql`dept.is_deleted = false`);
        whereConditions.push(Prisma.sql`ay.is_deleted = false`);
        whereConditions.push(Prisma.sql`st.is_deleted = false`);
      }

      if (academicYearId) {
        whereConditions.push(Prisma.sql`ay.id = ${academicYearId}`);
      }
      if (departmentId) {
        whereConditions.push(Prisma.sql`dept.id = ${departmentId}`);
      }
      if (subjectId) {
        whereConditions.push(Prisma.sql`sub.id = ${subjectId}`);
      }
      if (semesterId) {
        whereConditions.push(Prisma.sql`sem.id = ${semesterId}`);
      }
      if (divisionId) {
        whereConditions.push(Prisma.sql`div.id = ${divisionId}`);
      }
      if (lectureType) {
        whereConditions.push(Prisma.sql`sa."lectureType" = ${lectureType}::"LectureType"`);
      }

      const whereClause = whereConditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(whereConditions, ' AND ')}`
        : Prisma.empty;

      // Fetch aggregated data using a single optimized query
      const feedbackSnapshots = await prisma.$queryRaw<Array<{
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
        facultyDesignation: string;
        studentId: string | null;
        studentEnrollmentNumber: string;
        formId: string;
        responseValue: any;
        batch: string;
        lectureType: LectureType;
      }>>`
        SELECT
          sr.id,
          ay.id AS "academicYearId",
          ay.year_string AS "academicYearString",
          dept.id AS "departmentId",
          dept.name AS "departmentName",
          dept.abbreviation AS "departmentAbbreviation",
          sem.id AS "semesterId",
          sem.semester_number AS "semesterNumber",
          div.id AS "divisionId",
          div.division_name AS "divisionName",
          sub.id AS "subjectId",
          sub.name AS "subjectName",
          COALESCE(sub.abbreviation, '') AS "subjectAbbreviation",
          COALESCE(sub.subject_code, '') AS "subjectCode",
          fac.id AS "facultyId",
          fac.name AS "facultyName",
          COALESCE(fac.abbreviation, '') AS "facultyAbbreviation",
          fac.designation AS "facultyDesignation",
          st.id AS "studentId",
          st.enrollment_number AS "studentEnrollmentNumber",
          ff.id AS "formId",
          sr.response_value AS "responseValue",
          st.batch,
          sa."lectureType" AS "lectureType"
        FROM student_responses sr
        INNER JOIN feedback_forms ff ON sr.feedback_form_id = ff.id
        INNER JOIN subject_allocations sa ON ff.subject_allocation_id = sa.id
        INNER JOIN semesters sem ON sa.semester_id = sem.id
        INNER JOIN divisions div ON ff.division_id = div.id
        INNER JOIN departments dept ON sem.department_id = dept.id
        INNER JOIN academic_years ay ON sem.academic_year_id = ay.id
        INNER JOIN subjects sub ON sa.subject_id = sub.id
        INNER JOIN faculties fac ON sa.faculty_id = fac.id
        INNER JOIN students st ON sr.student_id = st.id
        ${whereClause}
      `;

      // Process the data into aggregated formats
      const overallStats = this.calculateOverallStats(feedbackSnapshots);
      const subjectRatings = this.aggregateSubjectRatings(feedbackSnapshots);
      const facultyPerformance = this.aggregateFacultyPerformance(feedbackSnapshots);
      const divisionPerformance = this.aggregateDivisionPerformance(feedbackSnapshots);
      const academicYearTrends = this.aggregateAcademicYearTrends(feedbackSnapshots);
      const semesterTrends = this.aggregateSemesterTrends(feedbackSnapshots);
      const departmentTrends = this.aggregateDepartmentTrends(feedbackSnapshots);

      return {
        overallStats,
        subjectRatings,
        facultyPerformance,
        divisionPerformance,
        academicYearTrends,
        semesterTrends,
        departmentTrends,
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

  // ==================== AGGREGATION HELPER METHODS ====================

  private calculateOverallStats(snapshots: any[]): OverallStats {
    const scores = snapshots
      .map(s => this.parseResponseValueToScore(s.responseValue))
      .filter((score): score is number => score !== null && score > 0);

    const uniqueSubjects = new Set(snapshots.map(s => s.subjectId));
    const uniqueFaculties = new Set(snapshots.map(s => s.facultyId));
    const uniqueStudents = new Set(snapshots.map(s => s.studentId).filter(Boolean));
    const uniqueDivisions = new Set(snapshots.map(s => s.divisionId));

    return {
      totalResponses: scores.length,
      averageRating: scores.length > 0
        ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
        : 0,
      uniqueSubjects: uniqueSubjects.size,
      uniqueFaculties: uniqueFaculties.size,
      uniqueStudents: uniqueStudents.size,
      uniqueDivisions: uniqueDivisions.size,
    };
  }

  private aggregateSubjectRatings(snapshots: any[]): SubjectRatingAggregated[] {
    const subjectMap = new Map<string, {
      subjectId: string;
      subjectName: string;
      subjectAbbreviation: string;
      subjectCode: string;
      lectureScores: number[];
      labScores: number[];
      faculties: Set<string>;
      divisions: Set<string>;
    }>();

    snapshots.forEach(snapshot => {
      const score = this.parseResponseValueToScore(snapshot.responseValue);
      if (score === null || score <= 0) return;

      if (!subjectMap.has(snapshot.subjectId)) {
        subjectMap.set(snapshot.subjectId, {
          subjectId: snapshot.subjectId,
          subjectName: snapshot.subjectName,
          subjectAbbreviation: snapshot.subjectAbbreviation,
          subjectCode: snapshot.subjectCode,
          lectureScores: [],
          labScores: [],
          faculties: new Set(),
          divisions: new Set(),
        });
      }

      const subject = subjectMap.get(snapshot.subjectId)!;
      if (snapshot.lectureType === 'LECTURE') {
        subject.lectureScores.push(score);
      } else {
        subject.labScores.push(score);
      }
      subject.faculties.add(snapshot.facultyId);
      subject.divisions.add(snapshot.divisionId);
    });

    return Array.from(subjectMap.values())
      .map(subject => {
        const allScores = [...subject.lectureScores, ...subject.labScores];
        return {
          subjectId: subject.subjectId,
          subjectName: subject.subjectName,
          subjectAbbreviation: subject.subjectAbbreviation,
          subjectCode: subject.subjectCode,
          lectureRating: subject.lectureScores.length > 0
            ? Number((subject.lectureScores.reduce((a, b) => a + b, 0) / subject.lectureScores.length).toFixed(2))
            : null,
          labRating: subject.labScores.length > 0
            ? Number((subject.labScores.reduce((a, b) => a + b, 0) / subject.labScores.length).toFixed(2))
            : null,
          overallRating: allScores.length > 0
            ? Number((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2))
            : 0,
          lectureResponses: subject.lectureScores.length,
          labResponses: subject.labScores.length,
          totalResponses: allScores.length,
          facultyCount: subject.faculties.size,
          divisionCount: subject.divisions.size,
        };
      })
      .sort((a, b) => b.overallRating - a.overallRating);
  }

  private aggregateFacultyPerformance(snapshots: any[]): FacultyPerformanceAggregated[] {
    const facultyMap = new Map<string, {
      facultyId: string;
      facultyName: string;
      facultyAbbreviation: string;
      designation: string;
      scores: number[];
      subjects: Set<string>;
      divisions: Set<string>;
    }>();

    snapshots.forEach(snapshot => {
      const score = this.parseResponseValueToScore(snapshot.responseValue);
      if (score === null || score <= 0) return;

      if (!facultyMap.has(snapshot.facultyId)) {
        facultyMap.set(snapshot.facultyId, {
          facultyId: snapshot.facultyId,
          facultyName: snapshot.facultyName,
          facultyAbbreviation: snapshot.facultyAbbreviation,
          designation: snapshot.facultyDesignation || 'N/A',
          scores: [],
          subjects: new Set(),
          divisions: new Set(),
        });
      }

      const faculty = facultyMap.get(snapshot.facultyId)!;
      faculty.scores.push(score);
      faculty.subjects.add(snapshot.subjectId);
      faculty.divisions.add(snapshot.divisionId);
    });

    const facultyList = Array.from(facultyMap.values())
      .map(faculty => ({
        facultyId: faculty.facultyId,
        facultyName: faculty.facultyName,
        facultyAbbreviation: faculty.facultyAbbreviation,
        designation: faculty.designation,
        averageRating: faculty.scores.length > 0
          ? Number((faculty.scores.reduce((a, b) => a + b, 0) / faculty.scores.length).toFixed(2))
          : 0,
        totalResponses: faculty.scores.length,
        subjectCount: faculty.subjects.size,
        divisionCount: faculty.divisions.size,
        rank: 0, // Will be set after sorting
      }))
      .sort((a, b) => b.averageRating - a.averageRating);

    // Assign ranks
    facultyList.forEach((faculty, index) => {
      faculty.rank = index + 1;
    });

    return facultyList;
  }

  private aggregateDivisionPerformance(snapshots: any[]): DivisionPerformanceAggregated[] {
    const divisionMap = new Map<string, {
      divisionId: string;
      divisionName: string;
      departmentName: string;
      semesterNumber: number;
      scores: number[];
      faculties: Set<string>;
      subjects: Set<string>;
    }>();

    snapshots.forEach(snapshot => {
      const score = this.parseResponseValueToScore(snapshot.responseValue);
      if (score === null || score <= 0) return;

      if (!divisionMap.has(snapshot.divisionId)) {
        divisionMap.set(snapshot.divisionId, {
          divisionId: snapshot.divisionId,
          divisionName: snapshot.divisionName,
          departmentName: snapshot.departmentName,
          semesterNumber: snapshot.semesterNumber,
          scores: [],
          faculties: new Set(),
          subjects: new Set(),
        });
      }

      const division = divisionMap.get(snapshot.divisionId)!;
      division.scores.push(score);
      division.faculties.add(snapshot.facultyId);
      division.subjects.add(snapshot.subjectId);
    });

    return Array.from(divisionMap.values())
      .map(division => ({
        divisionId: division.divisionId,
        divisionName: division.divisionName,
        departmentName: division.departmentName,
        semesterNumber: division.semesterNumber,
        averageRating: division.scores.length > 0
          ? Number((division.scores.reduce((a, b) => a + b, 0) / division.scores.length).toFixed(2))
          : 0,
        totalResponses: division.scores.length,
        facultyCount: division.faculties.size,
        subjectCount: division.subjects.size,
      }))
      .sort((a, b) => a.divisionName.localeCompare(b.divisionName));
  }

  private aggregateAcademicYearTrends(snapshots: any[]): AcademicYearTrendAggregated[] {
    const yearMap = new Map<string, {
      academicYearId: string;
      academicYearString: string;
      scores: number[];
      departments: Set<string>;
      divisions: Set<string>;
    }>();

    snapshots.forEach(snapshot => {
      const score = this.parseResponseValueToScore(snapshot.responseValue);
      if (score === null || score <= 0) return;

      if (!yearMap.has(snapshot.academicYearId)) {
        yearMap.set(snapshot.academicYearId, {
          academicYearId: snapshot.academicYearId,
          academicYearString: snapshot.academicYearString,
          scores: [],
          departments: new Set(),
          divisions: new Set(),
        });
      }

      const year = yearMap.get(snapshot.academicYearId)!;
      year.scores.push(score);
      year.departments.add(snapshot.departmentId);
      year.divisions.add(snapshot.divisionId);
    });

    return Array.from(yearMap.values())
      .map(year => ({
        academicYearId: year.academicYearId,
        academicYearString: year.academicYearString,
        averageRating: year.scores.length > 0
          ? Number((year.scores.reduce((a, b) => a + b, 0) / year.scores.length).toFixed(2))
          : 0,
        totalResponses: year.scores.length,
        departmentCount: year.departments.size,
        divisionCount: year.divisions.size,
      }))
      .sort((a, b) => a.academicYearString.localeCompare(b.academicYearString));
  }

  private aggregateSemesterTrends(snapshots: any[]): SemesterTrendAggregated[] {
    const semesterMap = new Map<number, Map<string, {
      academicYearId: string;
      academicYearString: string;
      scores: number[];
    }>>();

    snapshots.forEach(snapshot => {
      const score = this.parseResponseValueToScore(snapshot.responseValue);
      if (score === null || score <= 0) return;

      if (!semesterMap.has(snapshot.semesterNumber)) {
        semesterMap.set(snapshot.semesterNumber, new Map());
      }

      const yearMap = semesterMap.get(snapshot.semesterNumber)!;
      if (!yearMap.has(snapshot.academicYearId)) {
        yearMap.set(snapshot.academicYearId, {
          academicYearId: snapshot.academicYearId,
          academicYearString: snapshot.academicYearString,
          scores: [],
        });
      }

      yearMap.get(snapshot.academicYearId)!.scores.push(score);
    });

    return Array.from(semesterMap.entries())
      .map(([semesterNumber, yearMap]) => ({
        semesterNumber,
        academicYearData: Array.from(yearMap.values())
          .map(year => ({
            academicYearId: year.academicYearId,
            academicYearString: year.academicYearString,
            averageRating: year.scores.length > 0
              ? Number((year.scores.reduce((a, b) => a + b, 0) / year.scores.length).toFixed(2))
              : 0,
            responseCount: year.scores.length,
          }))
          .sort((a, b) => a.academicYearString.localeCompare(b.academicYearString)),
      }))
      .sort((a, b) => a.semesterNumber - b.semesterNumber);
  }

  private aggregateDepartmentTrends(snapshots: any[]): DepartmentTrendAggregated[] {
    const yearDeptMap = new Map<string, Map<string, {
      departmentId: string;
      departmentName: string;
      scores: number[];
    }>>();

    snapshots.forEach(snapshot => {
      const score = this.parseResponseValueToScore(snapshot.responseValue);
      if (score === null || score <= 0) return;

      if (!yearDeptMap.has(snapshot.academicYearString)) {
        yearDeptMap.set(snapshot.academicYearString, new Map());
      }

      const deptMap = yearDeptMap.get(snapshot.academicYearString)!;
      if (!deptMap.has(snapshot.departmentId)) {
        deptMap.set(snapshot.departmentId, {
          departmentId: snapshot.departmentId,
          departmentName: snapshot.departmentName,
          scores: [],
        });
      }

      deptMap.get(snapshot.departmentId)!.scores.push(score);
    });

    return Array.from(yearDeptMap.entries())
      .map(([academicYearString, deptMap]) => ({
        academicYearString,
        departmentData: Array.from(deptMap.values())
          .map(dept => ({
            departmentId: dept.departmentId,
            departmentName: dept.departmentName,
            averageRating: dept.scores.length > 0
              ? Number((dept.scores.reduce((a, b) => a + b, 0) / dept.scores.length).toFixed(2))
              : 0,
            responseCount: dept.scores.length,
          }))
          .sort((a, b) => a.departmentName.localeCompare(b.departmentName)),
      }))
      .sort((a, b) => a.academicYearString.localeCompare(b.academicYearString));
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
