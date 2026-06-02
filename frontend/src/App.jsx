import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FlowBuilder from './pages/FlowBuilder';
import Admin from './pages/Admin';
import Leads from './pages/Leads';
import Bulk from './pages/Bulk';

function PrivateRoute({ children, adminOnly = false }) {
    const { user, loading } = useAuth();
    if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888' }}>Loading...</div>;
    if (!user) return <Navigate to="/login" replace />;
    if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
    return children;
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                    <Route path="/flows/:id" element={<PrivateRoute><FlowBuilder /></PrivateRoute>} />
                    <Route path="/leads" element={<PrivateRoute><Leads /></PrivateRoute>} />
                    <Route path="/bulk" element={<PrivateRoute><Bulk /></PrivateRoute>} />
                    <Route path="/admin" element={<PrivateRoute adminOnly><Admin /></PrivateRoute>} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
