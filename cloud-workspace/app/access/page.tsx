import AccessDashboard from './access-dashboard';
import CanvasRoute from '../canvas-route';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Daftar — People & access', description: 'Manage scoped company memberships, invitations, expiry, and access history.' };
export default function AccessPage() { return <CanvasRoute surface="access" ownerEntry><AccessDashboard /></CanvasRoute>; }
