import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { BarChart3, TrendingUp, Users, Phone, Calendar, RefreshCw } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { getCampaignList, getCampaignMetrics, getCallLogs, getMeetings } from '../api';

interface DashboardProps { onNavigate?: (view: string) => void; }

export function Dashboard({ onNavigate }: DashboardProps) {
  const [totalLeads, setTotalLeads] = useState(0);
  const [callsMade, setCallsMade] = useState(0);
  const [meetingsCount, setMeetingsCount] = useState(0);
  const [successRate, setSuccessRate] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Campaign stats
      const { campaigns } = await getCampaignList();
      let leads = 0, calls = 0, completed = 0;
      for (const c of campaigns) {
        try {
          const m = await getCampaignMetrics(c.campaign_id);
          const counts = m.counts || {};
          leads += (m.jobs || []).length;
          calls += (counts.completed || 0) + (counts.calling || 0) + (counts.failed || 0);
          completed += counts.completed || 0;
        } catch {}
      }
      setTotalLeads(leads);
      setCallsMade(calls);
      setSuccessRate(calls > 0 ? Math.round((completed / calls) * 100) : 0);

      // Meetings — fetch real data
      try {
        const { meetings } = await getMeetings();
        const today = new Date().toISOString().split('T')[0];
        const upcoming = meetings.filter((m: any) => {
          const s = m.status || 'scheduled';
          return (s === 'scheduled' || s === 'rescheduled') && (m.meeting_date || '') >= today;
        });
        setMeetingsCount(upcoming.length);
        setUpcomingMeetings(upcoming.slice(0, 5));
      } catch { setMeetingsCount(0); setUpcomingMeetings([]); }

      // Recent activity
      try {
        const { call_logs } = await getCallLogs(10);
        setRecentActivity(call_logs.slice(0, 5));
      } catch { setRecentActivity([]); }
    } catch (e: any) { console.error('[Dashboard]', e); setError(e.message || 'Failed to load dashboard'); }
    setLoading(false);
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(loadDashboard, 30000);
    return () => clearInterval(t);
  }, [loadDashboard]);

  const statCards = [
    { label: 'Total Leads', value: totalLeads, icon: Users, color: 'from-blue-500 to-blue-600' },
    { label: 'Calls Made', value: callsMade, icon: Phone, color: 'from-purple-500 to-purple-600' },
    { label: 'Meetings Scheduled', value: meetingsCount, icon: TrendingUp, color: 'from-green-500 to-green-600' },
    { label: 'Success Rate', value: `${successRate}%`, icon: BarChart3, color: 'from-orange-500 to-orange-600' },
  ];

  const getActivityIcon = (status: string) => {
    if (status === 'completed') return 'bg-green-100 text-green-600';
    if (status === 'failed') return 'bg-red-100 text-red-600';
    if (status === 'calling') return 'bg-blue-100 text-blue-600';
    return 'bg-gray-100 text-gray-600';
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-4">
        <p className="text-red-600">{error}</p>
        <Button variant="outline" size="sm" onClick={loadDashboard} className="gap-2"><RefreshCw className="size-4" />Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} className="overflow-hidden">
              <CardContent className="p-0">
                <div className={`bg-gradient-to-br ${stat.color} p-6 text-white`}>
                  <div className="flex items-start justify-between mb-3"><Icon className="size-8 opacity-80" /></div>
                  <div className="text-3xl font-bold mb-1">{loading ? '...' : stat.value}</div>
                  <div className="text-sm opacity-90">{stat.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Meetings Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Calendar className="size-5 text-green-600" />Upcoming Meetings ({meetingsCount})</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate?.("meetings")} className="text-blue-600">View All</Button>
          </CardHeader>
          <CardContent>
            {upcomingMeetings.length === 0 ? (
              <div className="text-center py-6 text-gray-500">No upcoming meetings.</div>
            ) : (
              <div className="space-y-3">
                {upcomingMeetings.map((m: any, idx: number) => (
                  <div key={idx} className={`flex items-center gap-4 ${idx < upcomingMeetings.length - 1 ? 'pb-3 border-b border-gray-100' : ''}`}>
                    <div className="size-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Calendar className="size-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{m.title || m.candidate_name || 'Meeting'}</p>
                      <p className="text-sm text-gray-500">{m.candidate_name} &bull; {m.meeting_date} at {m.meeting_time || 'TBD'}</p>
                    </div>
                    <Badge variant="secondary" className={m.status === 'rescheduled' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}>
                      {m.status || 'scheduled'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate?.("call-logs")} className="text-blue-600">View All</Button>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-6 text-gray-500">No recent activity.</div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((log: any, idx: number) => (
                  <div key={idx} className={`flex items-start gap-4 ${idx < recentActivity.length - 1 ? 'pb-3 border-b border-gray-100' : ''}`}>
                    <div className={`size-10 rounded-full flex items-center justify-center flex-shrink-0 ${getActivityIcon(log.call_status)}`}>
                      <Phone className="size-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">Call {log.call_status} — {log.candidate_name || log.phone_number}</p>
                      <p className="text-sm text-gray-500">{log.call_time || log.created_at}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onNavigate?.("upload")}>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Phone className="size-5 text-blue-600" />Upload & Call</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-gray-600">Upload leads and start calling campaign</p></CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onNavigate?.("leads")}>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="size-5 text-purple-600" />View Leads</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-gray-600">Manage and view all your leads</p></CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onNavigate?.("transcripts")}>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="size-5 text-green-600" />View Reports</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-gray-600">Access call transcripts and analytics</p></CardContent>
        </Card>
      </div>
    </div>
  );
}
