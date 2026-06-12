import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import PWAInstallBanner from './components/PWAInstallBanner';
import { Toaster } from 'react-hot-toast';

// Eager load critical routes
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Hub from './pages/Hub';

// Lazy load the rest
const MatchCenter = lazy(() => import('./pages/MatchCenter'));
const MatchPage = lazy(() => import('./pages/MatchPage'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Analysis = lazy(() => import('./pages/Analysis'));
const Admin = lazy(() => import('./pages/Admin'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const CampaignPage = lazy(() => import('./pages/CampaignPage'));
const CampaignBuilderRoute = lazy(() => import('./pages/CampaignBuilder'));
const CampaignBuilderNewRoute = lazy(() => import('./pages/CampaignBuilder').then(module => ({ default: module.CampaignBuilderNewRoute })));
const CampaignBuilderEditRoute = lazy(() => import('./pages/CampaignBuilder').then(module => ({ default: module.CampaignBuilderEditRoute })));
const Leagues = lazy(() => import('./pages/Leagues'));
const LeagueDetails = lazy(() => import('./pages/LeagueDetails'));
const LeagueAdmin = lazy(() => import('./pages/LeagueAdmin'));
const Activity = lazy(() => import('./pages/Activity'));
const More = lazy(() => import('./pages/More'));

function App() {
  return (
    <BrowserRouter>
      <PWAInstallBanner />
      <Toaster
        position="top-center"
        containerStyle={{
          top: 'max(env(safe-area-inset-top), 16px)'
        }}
        toastOptions={{
          style: {
            background: '#0B0E1A',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: 'Outfit, sans-serif',
            fontSize: '12px',
            letterSpacing: '0.05em',
            borderRadius: '0px',
          },
          success: {
            duration: 4000,
            iconTheme: {
              primary: '#F4C430', // IPL Gold
              secondary: '#0B0E1A',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#E84040', // IPL Live Red
              secondary: '#fff',
            },
          },
        }}
      />
      <Suspense fallback={
        <div className="flex h-screen w-full items-center justify-center bg-[#0B0E1A]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgba(255,255,255,0.1)] border-t-[#F4C430]" />
        </div>
      }>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected Routes Wrapper (mocked for now) */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Hub />} />
            <Route path="matchcenter" element={<MatchCenter />} />
            <Route path="match/:id" element={<MatchPage />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="analysis" element={<Analysis />} />
            <Route path="admin" element={<Admin />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/:id" element={<CampaignPage />} />
            <Route path="admin/campaigns" element={<CampaignBuilderRoute />} />
            <Route path="admin/campaigns/new" element={<CampaignBuilderNewRoute />} />
            <Route path="admin/campaigns/:id/edit" element={<CampaignBuilderEditRoute />} />
            <Route path="leagues" element={<Leagues />} />
            <Route path="leagues/:id" element={<LeagueDetails />} />
            <Route path="leagues/:id/admin" element={<LeagueAdmin />} />
            <Route path="activity" element={<Activity />} />
            <Route path="more" element={<More />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
