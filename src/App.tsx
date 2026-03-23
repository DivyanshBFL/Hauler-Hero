import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { UploadPage } from '@/pages/UploadPage';
import { FieldMappingPage } from '@/pages/FieldMappingPage';
import { DataPreviewPage } from '@/pages/DataPreviewPage';
import { DataCleaningPage } from '@/pages/DataCleaningPage';
import { CompletePage } from '@/pages/CompletePage';
import DataAnalyticsPage from './pages/DataAnalyticsPage';
import { Toaster } from 'sonner';

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="app-theme">
      <AuthProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/upload"
                element={
                  <ProtectedRoute>
                    <UploadPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/field-mapping"
                element={
                  <ProtectedRoute>
                    <FieldMappingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/data-preview"
                element={
                  <ProtectedRoute>
                    <DataPreviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/data-cleaning"
                element={
                  <ProtectedRoute>
                    <DataCleaningPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/data-analytics"
                element={
                  <ProtectedRoute>
                    <DataAnalyticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/complete"
                element={
                  <ProtectedRoute>
                    <CompletePage />
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<Navigate to="/login" replace />} />
            </Routes>
            <Toaster position="bottom-right" richColors closeButton />
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>

  );
}

export default App;
