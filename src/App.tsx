/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './layout/MainLayout';
import { Dashboard } from './features/dashboard/Dashboard';
import { InvoicesList } from './features/invoices/InvoiceList';
import { StockScreen } from './features/stock/StockScreen';
import { InvoiceForm } from './features/invoices/InvoiceForm';
import { BulkImport } from './features/invoices/BulkImport';
import { PdfExtractorTool } from './features/tools/PdfExtractor';
import { InvoiceDetail } from './features/invoices/InvoiceDetail';
import { TruckList } from './features/trucks/TruckList';
import { RecurringList } from './features/recurring/RecurringList';
import { TripList } from './features/trips/TripList';
import { TripForm } from './features/trips/TripForm';
import { SharedChecklist } from './features/trips/SharedChecklist';
import { SettingsPage } from './features/settings/SettingsPage';
import { ExtractionReview } from './features/invoices/ExtractionReview';
import { Login } from './features/auth/Login';
import { Register } from './features/auth/Register';
import { useAuth } from './core/hooks/useAuth';
import { TeamRegister } from './features/auth/TeamRegister';
import { TeamDashboard } from './features/team-dashboard/TeamDashboard';
import { TeamTripDetail } from './features/team-dashboard/TeamTripDetail';

export default function App() {
  const { user, loading, isTeamMember } = useAuth();

  const isAuthRoleDetermined = user ? (isTeamMember !== null) : true;

  if (loading || !isAuthRoleDetermined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div>
      </div>
    );
  }

  // Ensure isTeamMember is strictly false to render Layout
  const isMainMember = user && isTeamMember === false;

  return (
    <Router>
      <Routes>
        <Route path="/shared-checklist/:tripId" element={<SharedChecklist />} />
        <Route path="/register/team" element={<TeamRegister />} />
        <Route path="/team-dashboard" element={user ? <TeamDashboard /> : <Navigate to="/login" />} />
        <Route path="/team-dashboard/trips/:tripId" element={user ? <TeamTripDetail /> : <Navigate to="/login" />} />
        <Route path="/login" element={!user ? <Login /> : (isTeamMember ? <Navigate to="/team-dashboard" /> : <Navigate to="/dashboard" />)} />
        <Route path="/register" element={!user ? <Register /> : (isTeamMember ? <Navigate to="/team-dashboard" /> : <Navigate to="/dashboard" />)} />
        
        <Route path="/" element={
          !user 
            ? <Navigate to="/login" /> 
            : (isTeamMember ? <Navigate to="/team-dashboard" /> : <Navigate to="/dashboard" />)
        } />

        <Route element={isMainMember ? <Layout /> : <Navigate to={user ? "/team-dashboard" : "/login"} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/invoices" element={<InvoicesList />} />
          <Route path="/stock" element={<StockScreen />} />
          <Route path="/invoices/new" element={<InvoiceForm />} />
          <Route path="/invoices/import" element={<BulkImport />} />
          <Route path="/tools/pdf-extractor" element={<PdfExtractorTool />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/invoices/:id/edit" element={<ExtractionReview />} />
          <Route path="/invoices/:id/review" element={<ExtractionReview />} />
          <Route path="/trucks" element={<TruckList />} />
          <Route path="/trips" element={<TripList />} />
          <Route path="/trips/new" element={<TripForm />} />
          <Route path="/trips/edit/:id" element={<TripForm />} />
          <Route path="/recurring" element={<RecurringList />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

