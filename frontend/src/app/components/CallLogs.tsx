import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ClipboardList, Trash2, RefreshCw, Download } from 'lucide-react';
import { getCallLogs, deleteCallLog } from '../api';
import { showSidebarNotification } from '../utils/notifications';

type StatusFilter = 'all' | 'completed' | 'meeting_scheduled' | 'no_conversation' | 'not_picked_up' | 'voicemail' | 'failed' | 'calling';

interface CallLog {
  id: string;
  dateTime: string;
  name: string;
  phone: string;
  status: string;
  duration: number;
  campaign: string;
}

export function CallLogs() {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');

  const loadCallLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const { call_logs } = await getCallLogs(200);
      setCallLogs(call_logs.map((l: any) => ({
        id: l.log_id,
        dateTime: l.call_time || l.created_at || '',
        name: l.candidate_name || '—',
        phone: l.phone_number || '',
        status: l.call_status || 'completed',
        duration: l.duration_seconds || 0,
        campaign: l.campaign_id || '',
      })));
    } catch (e: any) { console.error('[CallLogs]', e); setError(e.message || 'Failed to load call logs'); }
    setLoading(false);
  };

  useEffect(() => { loadCallLogs(); }, []);

  const handleDelete = async (logId: string) => {
    if (!confirm('Delete this call log?')) return;
    try {
      await deleteCallLog(logId);
      setCallLogs(callLogs.filter(l => l.id !== logId));
      showSidebarNotification({ message: "🗑️ Call log deleted", type: "info" });
    } catch (e: any) { showSidebarNotification({ message: "Delete failed: " + e.message, type: "error" }); }
  };

  const filtered = filter === 'all' ? callLogs : callLogs.filter(l => l.status === filter);

  const counts: Record<string, number> = { all: callLogs.length };
  callLogs.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1; });

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: `All (${counts.all || 0})` },
    { key: 'completed', label: `Connected (${counts.completed || 0})` },
    { key: 'meeting_scheduled', label: `Meeting (${counts.meeting_scheduled || 0})` },
    { key: 'not_picked_up', label: `Not Picked (${counts.not_picked_up || 0})` },
    { key: 'no_conversation', label: `No Conv (${counts.no_conversation || 0})` },
    { key: 'voicemail', label: `Voicemail (${counts.voicemail || 0})` },
    { key: 'failed', label: `Failed (${counts.failed || 0})` },
  ];

  const statusColors: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    meeting_scheduled: 'bg-purple-100 text-purple-700',
    connected: 'bg-green-100 text-green-700',
    calling: 'bg-blue-100 text-blue-700',
    failed: 'bg-red-100 text-red-700',
    not_picked_up: 'bg-orange-100 text-orange-700',
    no_conversation: 'bg-yellow-100 text-yellow-700',
    voicemail: 'bg-gray-100 text-gray-600',
  };

  const formatDuration = (s: number) => {
    if (!s || s <= 0) return '—';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const handleExport = () => {
    if (filtered.length === 0) return;
    const headers = ["Date/Time","Name","Phone","Status","Duration","Campaign"];
    const rows = filtered.map(l => [l.dateTime, l.name, l.phone, l.status, formatDuration(l.duration), l.campaign]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `call_logs_${filter}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: callLogs.length, color: 'from-blue-500 to-blue-600' },
          { label: 'Connected', value: counts.completed || 0, color: 'from-green-500 to-green-600' },
          { label: 'Meetings', value: counts.meeting_scheduled || 0, color: 'from-purple-500 to-purple-600' },
          { label: 'Not Picked', value: counts.not_picked_up || 0, color: 'from-orange-500 to-orange-600' },
          { label: 'Voicemail', value: counts.voicemail || 0, color: 'from-gray-400 to-gray-500' },
          { label: 'Failed', value: counts.failed || 0, color: 'from-red-500 to-red-600' },
        ].map((stat, idx) => (
          <Card key={idx} className="overflow-hidden">
            <CardContent className="p-0">
              <div className={`bg-gradient-to-br ${stat.color} p-4 text-white`}>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs opacity-90">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Call Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><ClipboardList className="size-5 text-gray-600" />Call Logs ({filtered.length})</CardTitle>
              <CardDescription>Calls are logged automatically after each completed call.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={loadCallLogs}>
                <RefreshCw className="size-4" />Refresh
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} disabled={filtered.length === 0}>
                <Download className="size-4" />Export CSV
              </Button>
            </div>
          </div>
          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2 mt-4">
            {statusFilters.map(f => (
              <Button key={f.key} variant={filter === f.key ? "default" : "outline"} size="sm"
                onClick={() => setFilter(f.key)} className="text-xs">{f.label}</Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {error ? <div className="text-center py-12 text-red-500">{error} <button onClick={loadCallLogs} className="ml-2 underline text-blue-600">Retry</button></div> :
          loading ? <div className="text-center py-12 text-gray-500">Loading call logs...</div> : (
          <div className="rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>DATE/TIME</TableHead>
                  <TableHead>NAME</TableHead>
                  <TableHead>PHONE</TableHead>
                  <TableHead>STATUS</TableHead>
                  <TableHead>DURATION</TableHead>
                  <TableHead>ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-gray-500">No call logs match the current filter.</TableCell></TableRow>
                ) : filtered.map((log) => (
                  <TableRow key={log.id} className="hover:bg-gray-50">
                    <TableCell className="text-sm">{log.dateTime ? new Date(log.dateTime).toLocaleString() : '—'}</TableCell>
                    <TableCell className="font-medium">{log.name}</TableCell>
                    <TableCell className="whitespace-nowrap">{log.phone}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[log.status] || 'bg-gray-100 text-gray-700'}>{log.status.replace(/_/g, ' ')}</Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{formatDuration(log.duration)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(log.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
