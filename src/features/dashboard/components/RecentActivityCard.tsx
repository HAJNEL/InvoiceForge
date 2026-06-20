import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

interface ActivityItem {
  id: string;
  title: string;
  desc: string;
  status: string;
}

export function RecentActivityCard({ recentActivity }: { recentActivity: ActivityItem[] }) {
  return (
    <div className="saas-card p-6">
      <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-500 mb-8">Recent Activity</h3>
      {recentActivity.length === 0 ? (
        <div className="py-12 text-center">
          <div className="text-xs text-zinc-400 font-bold uppercase tracking-widest">No recent activity</div>
        </div>
      ) : (
        <div className="space-y-6">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                <Plus className="w-4 h-4 text-zinc-500" />
              </div>
              <div>
                <p className="text-sm font-medium">{activity.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{activity.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <Link to="/invoices" className="w-full inline-block mt-8 text-sm font-bold text-brand-accent hover:underline text-center">
        View all invoices
      </Link>
    </div>
  );
}
