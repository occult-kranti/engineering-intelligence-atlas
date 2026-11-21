import ApplicationDirectory from './application-directory';
import CanvasRoute from '../canvas-route';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Daftar — Application Directory',
  description: 'Your private index of companies, application links, publication history, and shared design references.',
};
export default function Applications() { return <CanvasRoute surface="applications" ownerEntry><ApplicationDirectory/></CanvasRoute>; }
