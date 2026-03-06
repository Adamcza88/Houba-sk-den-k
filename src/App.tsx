import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { AddSighting } from './pages/AddSighting';
import { ImportSighting } from './pages/ImportSighting';
import { SightingDetail } from './pages/SightingDetail';
import { Settings } from './pages/Settings';
import { SpeciesDictionary } from './pages/SpeciesDictionary';
import { Export } from './pages/Export';
import { Trash } from './pages/Trash';
import { Toaster } from 'react-hot-toast';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Home />} />
        <Route path="add" element={<AddSighting />} />
        <Route path="import" element={<ImportSighting />} />
        <Route path="sighting/:id" element={<SightingDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route path="species" element={<SpeciesDictionary />} />
        <Route path="export" element={<Export />} />
        <Route path="trash" element={<Trash />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="bottom-center" />
      </BrowserRouter>
    </AuthProvider>
  );
}
