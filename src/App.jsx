import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleShell, { RoleRoute } from '@/components/RoleShell';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Analytics from '@/pages/Analytics';
import Orders from '@/pages/Orders';
import Agents from '@/pages/Agents';
import Packages from '@/pages/Packages';
import AgentStore from '@/pages/AgentStore';
import BulkStatus from '@/pages/BulkStatus';
import Reports from '@/pages/Reports';
import Notifications from '@/pages/Notifications';
import Storefront from '@/pages/Storefront';
import AgentDashboard from '@/pages/AgentDashboard';
import AgentOrders from '@/pages/AgentOrders';
import AgentStoreManage from '@/pages/AgentStoreManage';
import AgentPrices from '@/pages/AgentPrices';
import AgentPayouts from '@/pages/AgentPayouts';
import AgentApi from '@/pages/AgentApi';
import AgentReports from '@/pages/AgentReports';
import AgentSettings from '@/pages/AgentSettings';
import Settings from '@/pages/Settings';
import Transactions from '@/pages/Transactions';
import Support from '@/pages/Support';
import Messages from '@/pages/Messages';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      if (typeof window !== 'undefined') {
        try {
          navigateToLogin();
        } catch (redirectError) {
          console.warn('Login redirect failed', redirectError);
        }
      }
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/store/:slug" element={<Storefront />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<RoleShell />}>
          <Route path="/" element={<RoleRoute admin={<Analytics />} agent={<AgentDashboard />} />} />
          <Route path="/orders" element={<RoleRoute admin={<Orders />} agent={<AgentOrders />} />} />
          <Route path="/agents" element={<RoleRoute admin={<Agents />} agent={<Navigate to="/" replace />} />} />
          <Route path="/packages" element={<RoleRoute admin={<Packages />} agent={<Navigate to="/" replace />} />} />
          <Route path="/agent-store" element={<RoleRoute admin={<AgentStore />} agent={<Navigate to="/" replace />} />} />
          <Route path="/bulk-status" element={<RoleRoute admin={<BulkStatus />} agent={<Navigate to="/" replace />} />} />
          <Route path="/reports" element={<RoleRoute admin={<Reports />} agent={<AgentReports />} />} />
          <Route path="/transactions" element={<RoleRoute admin={<Transactions />} agent={<Navigate to="/" replace />} />} />
          <Route path="/withdrawals" element={<RoleRoute admin={<Navigate to="/transactions" replace />} agent={<Navigate to="/" replace />} />} />
          <Route path="/notifications" element={<RoleRoute admin={<Notifications />} agent={<Navigate to="/" replace />} />} />
          <Route path="/store" element={<RoleRoute admin={<Navigate to="/" replace />} agent={<AgentStoreManage />} />} />
          <Route path="/prices" element={<RoleRoute admin={<Navigate to="/" replace />} agent={<AgentPrices />} />} />
          <Route path="/payouts" element={<RoleRoute admin={<Navigate to="/" replace />} agent={<AgentPayouts />} />} />
          <Route path="/api" element={<RoleRoute admin={<Navigate to="/" replace />} agent={<AgentApi />} />} />
          <Route path="/settings" element={<RoleRoute admin={<Settings />} agent={<AgentSettings />} />} />
          <Route path="/support" element={<RoleRoute admin={<Navigate to="/" replace />} agent={<Support />} />} />
          <Route path="/messages" element={<RoleRoute admin={<Messages />} agent={<Navigate to="/" replace />} />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App