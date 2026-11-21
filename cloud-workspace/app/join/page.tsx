import JoinInvitation from './join-invitation';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Daftar — Review company invitation', description: 'Review the company, account, role, and expiry before accepting access.', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default function JoinPage() { return <JoinInvitation />; }
