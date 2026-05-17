import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useUser, SignIn, SignUp } from '@clerk/clerk-react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import POS from './pages/POS';

function App() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="flex h-screen items-center justify-center"><span className="loading loading-spinner loading-lg text-primary"></span></div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sign-in/*" element={<div className="flex h-screen items-center justify-center bg-base-200"><SignIn routing="path" path="/sign-in" /></div>} />
        <Route path="/sign-up/*" element={<div className="flex h-screen items-center justify-center bg-base-200"><SignUp routing="path" path="/sign-up" /></div>} />
        
        {/* Protected Routes */}
        {isSignedIn ? (
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="pos" element={<POS />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        ) : (
          <Route path="*" element={<Navigate to="/sign-in" replace />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
