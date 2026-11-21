import VisitingOffice from './visiting-office';
import CanvasRoute from '../canvas-route';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Daftar — Visiting office', description: 'Your authorized company workspace, shared team, notes, and task proposals.' };
export default function VisitPage() { return <CanvasRoute surface="visit"><VisitingOffice /></CanvasRoute>; }
