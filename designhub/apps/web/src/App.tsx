import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthContext';
import { GuestOnly, RequireAuth } from '@/auth/RouteGuards';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AppHome } from '@/pages/AppHome';
import { AuthPage } from '@/pages/AuthPage';
import { Landing } from '@/pages/Landing';

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route element={<GuestOnly />}>
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route path="/app" element={<AppHome />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
