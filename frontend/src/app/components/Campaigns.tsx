import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { FolderOpen, Trash2, PhoneCall, Users, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { deleteCampaign, getCampaignList, getCampaignMetrics } from '../api';
import { showSidebarNotification } from '../utils/notifications';

interface Campaign {
  id: string;
  name: string;
  createdDate: string;
  totalLeads: number;
  calledLeads: number;
  successfulCalls: number;
  failedCalls: number;
  status: 'active' | 'completed' | 'paused';
  agentName: string;
}

export function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function loadCampaigns() {
    setLoading(true);
    setError(null);
    try {
      const { campaigns: list } = await getCampaignList();
      const enriched: Campaign[] = [];
      for (const c of list) {
        try {
          const m = await getCampaignMetrics(c.campaign_id);
          const counts = m.counts || {};
          const jobs = m.jobs || [];
          const isRunning = m.call_queue?.is_running;
          const total = jobs.length;
          const completed = counts.completed || 0;
          const failed = counts.failed || 0;
          const calling = counts.calling || 0;
          const called = completed + failed + calling;
          enriched.push({
            id: c.campaign_id,
            name: c.name,
            createdDate: c.created_at,
            totalLeads: total,
            calledLeads: called,
            successfulCalls: completed,
            failedCalls: failed,
            status: isRunning ? 'active' : called >= total && total > 0 ? 'completed' : 'paused',
            agentName: 'AI Agent',
          });
        } catch {
          enriched.push({
            id: c.campaign_id, name: c.name, createdDate: c.created_at,
            totalLeads: 0, calledLeads: 0, successfulCalls: 0, failedCalls: 0, status: 'paused', agentName: 'AI Agent',
          });
        }
      }
      setCampaigns(enriched);
    } catch (e: any) { console.error('[Campaigns]', e); setError(e.message || 'Failed to load campaigns'); }
    setLoading(false);
  }

  const handleDelete = (campaign: Campaign) => { setSelectedCampaign(campaign); setIsDeleteDialogOpen(true); };
  const confirmDelete = async () => {
    if (!selectedCampaign) return;
    try {
      await deleteCampaign(selectedCampaign.id);
      showSidebarNotification({ message: "Campaign deleted", type: "success" });
      await loadCampaigns();
    } catch (e: any) {
      showSidebarNotification({ message: "Delete failed: " + e.message, type: "error" });
    } finally {
      setIsDeleteDialogOpen(false);
      setSelectedCampaign(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) { case 'active': return 'bg-green-100 text-green-700'; case 'completed': return 'bg-blue-100 text-blue-700'; default: return 'bg-gray-100 text-gray-700'; }
  };
  const getStatusIcon = (status: string) => {
    switch (status) { case 'active': case 'completed': return <CheckCircle2 className="size-4" />; case 'paused': return <Clock className="size-4" />; default: return <AlertCircle className="size-4" />; }
  };
  const calcRate = (a: number, b: number) => b === 0 ? '0%' : `${Math.round((a / b) * 100)}%`;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Total Campaigns</p><p className="text-3xl font-bold text-gray-900 mt-1">{campaigns.length}</p></div><div className="size-12 bg-indigo-100 rounded-lg flex items-center justify-center"><FolderOpen className="size-6 text-indigo-600" /></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Total Leads</p><p className="text-3xl font-bold text-gray-900 mt-1">{campaigns.reduce((s, c) => s + c.totalLeads, 0)}</p></div><div className="size-12 bg-blue-100 rounded-lg flex items-center justify-center"><Users className="size-6 text-blue-600" /></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Calls Made</p><p className="text-3xl font-bold text-gray-900 mt-1">{campaigns.reduce((s, c) => s + c.calledLeads, 0)}</p></div><div className="size-12 bg-green-100 rounded-lg flex items-center justify-center"><PhoneCall className="size-6 text-green-600" /></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Success Rate</p><p className="text-3xl font-bold text-gray-900 mt-1">{calcRate(campaigns.reduce((s, c) => s + c.successfulCalls, 0), campaigns.reduce((s, c) => s + c.calledLeads, 0))}</p></div><div className="size-12 bg-green-100 rounded-lg flex items-center justify-center"><CheckCircle2 className="size-6 text-green-600" /></div></div></CardContent></Card>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle className="flex items-center gap-2"><FolderOpen className="size-5 text-indigo-600" />All Campaigns</CardTitle><CardDescription>View and manage all your calling campaigns</CardDescription></div>
            <span className="text-xs text-gray-500">Create new campaigns from Upload & Call</span>
          </div>
        </CardHeader>
        <CardContent>
          {error ? <div className="text-center py-12 text-red-500">{error} <button onClick={loadCampaigns} className="ml-2 underline text-blue-600">Retry</button></div> :
          loading ? <div className="text-center py-12 text-gray-500">Loading campaigns...</div> : (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-gray-50">
                <TableHead>CAMPAIGN NAME</TableHead><TableHead>CREATED DATE</TableHead><TableHead>STATUS</TableHead><TableHead>TOTAL LEADS</TableHead><TableHead>CALLED</TableHead><TableHead>CALL RATE</TableHead><TableHead>SUCCESSFUL</TableHead><TableHead>FAILED</TableHead><TableHead>SUCCESS RATE</TableHead><TableHead>ACTIONS</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {campaigns.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-12 text-gray-500">No campaigns found. Create your first campaign to get started.</TableCell></TableRow>
                ) : campaigns.map(campaign => (
                  <TableRow key={campaign.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell className="text-gray-600">{new Date(campaign.createdDate).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant="secondary" className={`${getStatusColor(campaign.status)} gap-1`}>{getStatusIcon(campaign.status)}{campaign.status}</Badge></TableCell>
                    <TableCell className="font-medium">{campaign.totalLeads}</TableCell>
                    <TableCell className="font-medium text-blue-600">{campaign.calledLeads}</TableCell>
                    <TableCell><span className="text-sm font-medium">{calcRate(campaign.calledLeads, campaign.totalLeads)}</span></TableCell>
                    <TableCell className="text-green-600 font-medium">{campaign.successfulCalls}</TableCell>
                    <TableCell className="text-red-600 font-medium">{campaign.failedCalls}</TableCell>
                    <TableCell><span className="text-sm font-medium text-green-600">{calcRate(campaign.successfulCalls, campaign.calledLeads)}</span></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(campaign)} className="hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          )}
          <div className="mt-4 text-sm text-gray-600">Showing {campaigns.length} campaigns</div>
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Delete Campaign</DialogTitle><DialogDescription>Are you sure you want to delete this campaign? This action cannot be undone.</DialogDescription></DialogHeader>
          {selectedCampaign && <div className="py-4 px-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-sm text-red-900"><strong>Campaign:</strong> {selectedCampaign.name}</p><p className="text-sm text-red-900 mt-1"><strong>Total Leads:</strong> {selectedCampaign.totalLeads}</p></div>}
          <DialogFooter><Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button><Button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">Delete Campaign</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
