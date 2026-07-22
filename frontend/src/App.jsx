import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import PublicLayout from './components/PublicLayout';
import DashboardLayout from './components/DashboardLayout';
import AdminLayout from './components/AdminLayout';
import Home from './pages/Home';
import { Login, Register } from './pages/Auth';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import MaterialsPage from './pages/Materials';
import Practice, { PracticeAttempt } from './pages/Practice';
import MockTests from './pages/MockTests';
import { CbtInstructions, CbtExam, CbtResult } from './pages/Cbt';
import AiTutor from './pages/AITutor.jsx';
import AiGenerator from './pages/AiGenerator.jsx';
import { AiTutorRoute, AiGeneratorRoute } from './components/AiRouteRedirect';
import { About, Contact } from './pages/AboutContact';
import {
  DashboardHome,
  DashboardCourses,
  DashboardBookmarks,
  DashboardContinue,
  DashboardPractice,
  DashboardMocks,
  DashboardLive,
  DashboardResults,
  DashboardCertificates,
  DashboardProfile,
} from './pages/Dashboard';
import {
  AdminHome,
  AdminStudents,
  AdminCourses,
  AdminMaterials,
  AdminQuestions,
  AdminAiGenerator,
  AdminExams,
  AdminResults,
  AdminAnalytics,
  AdminSettings,
} from './pages/Admin';
import AdminNotebook from './pages/AdminNotebook';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:slug" element={<CourseDetail />} />
            <Route path="/study-materials" element={<MaterialsPage />} />
            <Route path="/video-lectures" element={<MaterialsPage type="video" />} />
            <Route path="/previous-papers" element={<MaterialsPage type="previous_paper" />} />
            <Route path="/current-affairs" element={<MaterialsPage type="current_affairs" />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/practice/:id" element={<PracticeAttempt />} />
            <Route path="/mock-tests" element={<MockTests />} />
            <Route path="/ai-tutor" element={<AiTutorRoute />} />
            <Route path="/ai-generator" element={<AiGeneratorRoute />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/cbt/:id/instructions" element={<CbtInstructions />} />
            <Route path="/cbt/result/:attemptId" element={<CbtResult />} />
          </Route>

          <Route path="/cbt/:id/exam" element={<CbtExam />} />

          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="courses" element={<DashboardCourses />} />
            <Route path="bookmarks" element={<DashboardBookmarks />} />
            <Route path="continue" element={<DashboardContinue />} />
            <Route path="practice" element={<DashboardPractice />} />
            <Route path="mocks" element={<DashboardMocks />} />
            <Route path="live" element={<DashboardLive />} />
            <Route path="results" element={<DashboardResults />} />
            <Route path="certificates" element={<DashboardCertificates />} />
            <Route path="profile" element={<DashboardProfile />} />
            <Route path="ai-tutor" element={<AiTutor />} />
            <Route path="ai-generator" element={<AiGenerator />} />
          </Route>

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminHome />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="courses" element={<AdminCourses />} />
            <Route path="materials" element={<AdminMaterials />} />
            <Route path="questions" element={<AdminQuestions />} />
            <Route path="ai-generator" element={<AdminAiGenerator />} />
            <Route path="notebook" element={<AdminNotebook />} />
            <Route path="exams" element={<AdminExams />} />
            <Route path="results" element={<AdminResults />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
