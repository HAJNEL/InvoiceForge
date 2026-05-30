/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './layout/MainLayout';
import { Dashboard } from './features/dashboard/Dashboard';
import { InvoicesList } from './features/invoices/InvoiceList';
import { InvoiceForm } from './features/invoices/InvoiceForm';
import { BulkImport } from './features/invoices/BulkImport';
import { PdfExtractorTool } from './features/tools/PdfExtractor';
import { InvoiceDetail } from './features/invoices/InvoiceDetail';
import { ClientList } from './features/clients/ClientList';
import { TruckList } from './features/trucks/TruckList';
import { ScheduleList } from './features/schedules/ScheduleList';
import { RecurringList } from './features/recurring/RecurringList';
import { TripList } from './features/trips/TripList';
import { SettingsPage } from './features/settings/SettingsPage';
import { ExtractionReview } from './features/invoices/ExtractionReview';
import { Login } from './features/auth/Login';
import { Register } from './features/auth/Register';
import { useAuth } from './core/hooks/useAuth';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" />} />
        
        <Route element={user ? <Layout /> : <Navigate to="/login" />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/invoices" element={<InvoicesList />} />
          <Route path="/invoices/new" element={<InvoiceForm />} />
          <Route path="/invoices/import" element={<BulkImport />} />
          <Route path="/tools/pdf-extractor" element={<PdfExtractorTool />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/invoices/:id/edit" element={<ExtractionReview />} />
          <Route path="/invoices/:id/review" element={<ExtractionReview />} />
          <Route path="/clients" element={<ClientList />} />
          <Route path="/trucks" element={<TruckList />} />
          <Route path="/schedules" element={<ScheduleList />} />
          <Route path="/trips" element={<TripList />} />
          <Route path="/recurring" element={<RecurringList />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Route>
      </Routes>
    </Router>
  );
}

