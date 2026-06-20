/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
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
import { ProductList } from './features/products/components/ProductList';
import { TeamRegister } from './features/auth/TeamRegister';
import { TeamDashboard } from './features/team-dashboard/TeamDashboard';
import { TeamTripDetail } from './features/team-dashboard/TeamTripDetail';

export default function App() {
  const { user, loading, isTeamMember } = useAuth();

  const isAuthRoleDetermined = user ? (isTeamMember !== null) : true;

  // Global viewport zoom reset effect when any dialog/modal closes
  useEffect(() => {
    let wasModalOpen = false;

    const checkModalState = () => {
      // Query elements representing active dialog wrappers, modals, or backdrop overlays
      const modals = document.querySelectorAll(
        '.fixed.inset-0, [class*="fixed"][class*="inset-0"], .bg-black\\/60, .bg-zinc-950\\/40, .bg-zinc-900\\/40, .bg-zinc-950\\/60, .bg-black\\/50'
      );
      const isModalOpenNow = modals.length > 0;

      // When a modal has closed (i.e. transitions from open to closed)
      if (wasModalOpen && !isModalOpenNow) {
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
          // Temporarily force scale 1.0 to clear any viewport scale or magnification induced on mobile focus
          viewportMeta.setAttribute(
            'content',
            'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
          );
          
          // Re-enable scaling shortly after so the standard user web experience remains flexible
          setTimeout(() => {
            viewportMeta.setAttribute(
              'content',
              'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes'
            );
          }, 150);
        }
      }

      wasModalOpen = isModalOpenNow;
    };

    // Use MutationObserver to watch for additions and deletions of overlays inside document.body
    const observer = new MutationObserver(() => {
      checkModalState();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Run once initially to capture initial mount state
    checkModalState();

    return () => {
      observer.disconnect();
    };
  }, []);

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
          <Route path="/products" element={<ProductList />} />
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

