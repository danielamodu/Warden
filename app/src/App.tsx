import { Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import ConnectWallet from './pages/ConnectWallet';
import CreateEscrow from './pages/CreateEscrow';
import Dashboard from './pages/Dashboard';
import EscrowDetail from './pages/EscrowDetail';
import SubmitEvidence from './pages/SubmitEvidence';
import RulingInProgress from './pages/RulingInProgress';
import DisputeVerdict from './pages/DisputeVerdict';
import PayoutSuccess from './pages/PayoutSuccess';
import ProofTransparency from './pages/ProofTransparency';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/connect" element={<ConnectWallet />} />
      <Route path="/create" element={<CreateEscrow />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/escrow/:id" element={<EscrowDetail />} />
      <Route path="/escrow/:id/dispute/submit" element={<SubmitEvidence />} />
      <Route path="/escrow/:id/dispute/ruling" element={<RulingInProgress />} />
      <Route path="/escrow/:id/dispute/verdict" element={<DisputeVerdict />} />
      <Route path="/escrow/:id/payout" element={<PayoutSuccess />} />
      <Route path="/proof" element={<ProofTransparency />} />
    </Routes>
  );
}
