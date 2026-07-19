import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Phone, Users, RefreshCw, Download, PhoneOff } from 'lucide-react';
import { getCampaignList, getCampaignMetrics, triggerCall, retryCall, disconnectCall } from '../api';
import { showSidebarNotification } from '../utils/notifications';

type StatusFilter = 'all' | 'queued' | 'calling' | 'completed' | 'failed';

interface Lead {
  row: number; name: string; phone: string; company: string; status: string;
  callResult: string; duration: number;
  designation: string; industry: string; email: string; jobId: string;
  campaignId: string; campaignName: string; sentiment: string; lastCallTime: string;
}

export function Leads() {
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { campaigns } = await getCampaignList();
      const leads: Lead[] = [];
      for (const c of campaigns) {
        try {
          const m = await getCampaignMetrics(c.campaign_id);
          (m.jobs || []).forEach((j: any, idx: number) => {
            const src = typeof j.source_raw === 'string' ? JSON.parse(j.source_raw || '{}') : (j.source_raw || {});
            leads.push({
              row: idx + 1,
              name: j.candidate_name || `${src.first_name || ''} ${src.last_name || ''}`.trim() || '—',
              phone: j.phone_number || src.phone_number || '',
              company: j.company || src.company || src.Company || '—',
              status: j.status || 'queued',
              callResult: j.call_result || '',
              duration: j.duration_seconds || 0,
              designation: src.designation || src.Designation || src.title || '—',
              industry: src.industry || src.Industry || '—',
              email: src.email || src.Email || '',
              jobId: j.job_id,
              campaignId: c.campaign_id,
              campaignName: c.name || c.campaign_id.substring(0, 8),
              sentiment: j.sentiment || src.sentiment || '—',
              lastCallTime: j.updated_at || j.created_at || '',
            });
          });
        } catch {}
      }
      setAllLeads(leads.slice(0, 500));
    } catch (e: any) { console.error('[Leads]', e); setError(e.message || 'Failed to load leads'); }
    setLoading(false);
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const hasActiveCalls = allLeads.some(l => l.status === 'calling');
  useEffect(() => {
    if (!hasActiveCalls) return;
    const t = setInterval(loadLeads, 10000);
    return () => clearInterval(t);
  }, [hasActiveCalls, loadLeads]);

  const filtered = filter === 'all' ? allLeads : allLeads.filter(l => l.status === filter);

  const handleTriggerCall = async (lead: Lead) => {
    try {
      await triggerCall(lead.campaignId, lead.jobId);
      setAllLeads(prev => prev.map(l => l.jobId === lead.jobId ? { ...l, status: 'calling' } : l));
      showSidebarNotification({ message: '📞 Calling ' + (lead.name || lead.phone), type: 'success' });
    } catch (e: any) { showSidebarNotification({ message: "Call trigger failed: " + e.message, type: "error" }); }
  };

  const handleRetryCall = async (lead: Lead) => {
    try {
      await retryCall(lead.campaignId, lead.jobId);
      setAllLeads(prev => prev.map(l => l.jobId === lead.jobId ? { ...l, status: 'calling' } : l));
    } catch (e: any) { showSidebarNotification({ message: "Retry failed: " + e.message, type: "error" }); }
  };

  const handleDisconnectCall = async (lead: Lead) => {
    if (!confirm(`Disconnect call to ${lead.name || lead.phone}?`)) return;
    // Optimistically update UI immediately so it never stays stuck on "calling"
    setAllLeads(prev => prev.map(l => l.jobId === lead.jobId ? { ...l, status: 'completed' } : l));
    try {
      await disconnectCall(lead.campaignId, lead.jobId);
    } catch (e: any) {
      // Call may have already ended — still mark as completed, just notify user
      showSidebarNotification({ message: "Call ended (disconnect note: " + e.message + ")", type: "warning" });
    }
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ["Name","Phone","Company","Status","Call Result","Duration","Campaign","Designation","Email"];
    const rows = filtered.map(l => [l.name, l.phone, l.company, l.status, l.callResult || '—', formatDuration(l.duration), l.campaignName, l.designation, l.email]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `leads_${filter}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const statusColors: Record<string, string> = {
    completed: 'bg-green-100 text-green-700', calling: 'bg-blue-100 text-blue-700',
    failed: 'bg-red-100 text-red-700', queued: 'bg-gray-100 text-gray-700',
    no_answer: 'bg-orange-100 text-orange-700', busy: 'bg-yellow-100 text-yellow-700',
  };

  const callResultColors: Record<string, string> = {
    meeting_scheduled: 'bg-purple-100 text-purple-700',
    connected: 'bg-green-100 text-green-700',
    no_conversation: 'bg-yellow-100 text-yellow-700',
    not_picked_up: 'bg-orange-100 text-orange-700',
    voicemail: 'bg-gray-200 text-gray-600',
    completed: 'bg-green-100 text-green-700',
  };

  const formatDuration = (s: number) => {
    if (!s || s <= 0) return '—';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const counts: Record<string, number> = { all: allLeads.length, queued: 0, calling: 0, completed: 0, failed: 0 };
  allLeads.forEach(l => { if (counts[l.status] !== undefined) counts[l.status]++; });

  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'queued', label: `Queued (${counts.queued})` },
    { key: 'calling', label: `Calling (${counts.calling})` },
    { key: 'completed', label: `Completed (${counts.completed})` },
    { key: 'failed', label: `Failed (${counts.failed})` },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Users className="size-5 text-purple-600" />Leads ({filtered.length})</CardTitle>
              <CardDescription>
                {allLeads.some(l => l.status === 'calling') && <span className="text-blue-600 animate-pulse">Auto-refreshing...</span>}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={loadLeads} disabled={loading}>
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV} disabled={filtered.length === 0}>
                <Download className="size-4" /> Export CSV
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {filters.map(f => (
              <Button key={f.key} variant={filter === f.key ? "default" : "outline"} size="sm"
                onClick={() => setFilter(f.key)} className="text-xs">{f.label}</Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {error ? <div className="text-center py-12 text-red-500">{error} <button onClick={loadLeads} className="ml-2 underline text-blue-600">Retry</button></div> :
          loading && allLeads.length === 0 ? <div className="text-center py-12 text-gray-500">Loading leads...</div> : (
          <div className="rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-gray-50">
                <TableHead>#</TableHead><TableHead>NAME</TableHead><TableHead>PHONE</TableHead><TableHead>COMPANY</TableHead>
                <TableHead>STATUS</TableHead><TableHead>CALL RESULT</TableHead><TableHead>DURATION</TableHead>
                <TableHead>ACTION</TableHead><TableHead>CAMPAIGN</TableHead><TableHead>EMAIL</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-12 text-gray-500">No leads match the current filter.</TableCell></TableRow>
                ) : filtered.map((lead, idx) => (
                  <TableRow key={lead.jobId} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell className="whitespace-nowrap">{lead.phone}</TableCell>
                    <TableCell>{lead.company}</TableCell>
                    <TableCell><Badge variant="secondary" className={statusColors[lead.status] || 'bg-gray-100 text-gray-700'}>{lead.status}</Badge></TableCell>
                    <TableCell>
                      {lead.callResult ? (
                        <Badge variant="secondary" className={callResultColors[lead.callResult] || 'bg-gray-100 text-gray-600'}>
                          {lead.callResult.replace(/_/g, ' ')}
                        </Badge>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">{formatDuration(lead.duration)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {['queued', 'completed', 'failed', 'no_answer', 'busy', 'rejected'].includes(lead.status) && (
                          <Button size="sm" className="h-7 gap-1 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => lead.status === 'queued' ? handleTriggerCall(lead) : handleRetryCall(lead)}>
                            <Phone className="size-3" /> {lead.status === 'queued' ? 'Call' : 'Call Again'}
                          </Button>
                        )}
                        {lead.status === 'calling' && (
                          <>
                            <span className="text-xs text-blue-600 animate-pulse font-medium">On Call</span>
                            <Button size="sm" className="h-7 gap-1 text-xs bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDisconnectCall(lead)}>
                              <PhoneOff className="size-3" /> Disconnect
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">{lead.campaignName}</TableCell>
                    <TableCell className="text-blue-600 text-xs">{lead.email}</TableCell>
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
