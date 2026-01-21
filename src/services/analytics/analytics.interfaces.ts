/**
 * @file src/services/analytics/analytics.interfaces.ts
 * @description TypeScript interfaces for analytics responses.
 * Separates interface definitions for cleaner code organization.
 */

// ==================== AGGREGATED DATA TYPES ====================
// These are returned by the optimized getCompleteAnalyticsData endpoint

export interface OverallStats {
  totalResponses: number;
  averageRating: number;
  uniqueSubjects: number;
  uniqueFaculties: number;
  uniqueStudents: number;
  uniqueDivisions: number;
}

export interface SubjectRatingAggregated {
  subjectId: string;
  subjectName: string;
  subjectAbbreviation: string;
  subjectCode: string;
  lectureRating: number | null;
  labRating: number | null;
  overallRating: number;
  lectureResponses: number;
  labResponses: number;
  totalResponses: number;
  facultyCount: number;
  divisionCount: number;
}

export interface FacultyPerformanceAggregated {
  facultyId: string;
  facultyName: string;
  facultyAbbreviation: string;
  designation: string;
  averageRating: number;
  totalResponses: number;
  rank: number;
  subjectCount: number;
  divisionCount: number;
}

export interface DivisionPerformanceAggregated {
  divisionId: string;
  divisionName: string;
  departmentName: string;
  semesterNumber: number;
  averageRating: number;
  totalResponses: number;
  facultyCount: number;
  subjectCount: number;
}

export interface AcademicYearTrendAggregated {
  academicYearId: string;
  academicYearString: string;
  averageRating: number;
  totalResponses: number;
  departmentCount: number;
  divisionCount: number;
}

export interface SemesterTrendAggregated {
  semesterNumber: number;
  academicYearData: Array<{
    academicYearId: string;
    academicYearString: string;
    averageRating: number;
    responseCount: number;
  }>;
}

export interface DepartmentTrendAggregated {
  academicYearString: string;
  departmentData: Array<{
    departmentId: string;
    departmentName: string;
    averageRating: number;
    responseCount: number;
  }>;
}

// ==================== OPTIMIZED RESPONSE TYPE ====================
// This replaces the old response that included raw feedbackSnapshots

export interface OptimizedAnalyticsResponse {
  // Summary statistics
  overallStats: OverallStats;

  // Pre-aggregated chart data (no client-side processing needed)
  subjectRatings: SubjectRatingAggregated[];
  facultyPerformance: FacultyPerformanceAggregated[];
  divisionPerformance: DivisionPerformanceAggregated[];

  // Trend data
  academicYearTrends: AcademicYearTrendAggregated[];
  semesterTrends: SemesterTrendAggregated[];
  departmentTrends: DepartmentTrendAggregated[];

  // Metadata
  filters: {
    academicYearId?: string;
    departmentId?: string;
    semesterId?: string;
    divisionId?: string;
    subjectId?: string;
    lectureType?: string;
  };
  generatedAt: string;
}

// ==================== DETAILED DRILL-DOWN TYPES ====================
// For the new detailed endpoints

export interface SubjectDetailedAnalytics {
  subject: {
    id: string;
    name: string;
    abbreviation: string;
    code: string;
  };
  overallRating: number;
  lectureRating: number | null;
  labRating: number | null;
  totalResponses: number;
  lectureResponses: number;
  labResponses: number;

  // Faculty teaching this subject
  facultyBreakdown: Array<{
    facultyId: string;
    facultyName: string;
    facultyAbbreviation: string;
    lectureType: 'LECTURE' | 'LAB';
    rating: number;
    responses: number;
    divisions: string[];
  }>;

  // Division-wise breakdown
  divisionBreakdown: Array<{
    divisionId: string;
    divisionName: string;
    lectureRating: number | null;
    labRating: number | null;
    totalRating: number;
    responses: number;
  }>;

  // Question category breakdown (if questions exist)
  questionBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    avgRating: number;
    questionCount: number;
  }>;
}

export interface FacultyDetailedAnalytics {
  faculty: {
    id: string;
    name: string;
    abbreviation: string;
    designation: string;
  };
  overallRating: number;
  totalResponses: number;
  rank: number;
  totalFaculty: number;

  // Subjects taught by this faculty
  subjectBreakdown: Array<{
    subjectId: string;
    subjectName: string;
    subjectAbbreviation: string;
    lectureType: 'LECTURE' | 'LAB';
    rating: number;
    responses: number;
    semester: number;
    academicYear: string;
  }>;

  // Division-wise breakdown
  divisionBreakdown: Array<{
    divisionId: string;
    divisionName: string;
    subjectName: string;
    lectureType: 'LECTURE' | 'LAB';
    rating: number;
    responses: number;
  }>;

  // Question category breakdown
  questionCategoryBreakdown: Array<{
    category: string;
    avgRating: number;
    questionCount: number;
  }>;

  // Historical trend across academic years
  trendData: Array<{
    academicYearId: string;
    academicYear: string;
    semester: number;
    rating: number;
    responses: number;
  }>;
}

export interface DivisionDetailedAnalytics {
  division: {
    id: string;
    name: string;
    departmentName: string;
    semesterNumber: number;
  };
  overallRating: number;
  totalResponses: number;

  // Faculty teaching in this division
  facultyBreakdown: Array<{
    facultyId: string;
    facultyName: string;
    facultyAbbreviation: string;
    subjectName: string;
    lectureType: 'LECTURE' | 'LAB';
    rating: number;
    responses: number;
  }>;

  // Subject-wise breakdown
  subjectBreakdown: Array<{
    subjectId: string;
    subjectName: string;
    subjectAbbreviation: string;
    lectureRating: number | null;
    labRating: number | null;
    totalRating: number;
    responses: number;
  }>;

  // Academic year comparison
  academicYearComparison: Array<{
    academicYearId: string;
    academicYearString: string;
    rating: number;
    responses: number;
  }>;
}

export interface AcademicYearDetailedAnalytics {
  academicYear: {
    id: string;
    yearString: string;
  };
  overallRating: number;
  totalResponses: number;

  // Department breakdown
  departmentBreakdown: Array<{
    departmentId: string;
    departmentName: string;
    rating: number;
    responses: number;
    topFaculty: {
      name: string;
      rating: number;
    } | null;
  }>;

  // Semester breakdown
  semesterBreakdown: Array<{
    semesterNumber: number;
    rating: number;
    responses: number;
    bestSubject: {
      name: string;
      rating: number;
    } | null;
  }>;

  // Division breakdown
  divisionBreakdown: Array<{
    divisionId: string;
    divisionName: string;
    departmentName: string;
    rating: number;
    responses: number;
  }>;
}
