import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { FileText, Download, User, Phone as PhoneIcon, Building, Calendar, MessageSquare, RefreshCw, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { getCampaignList, getTranscripts, getTranscriptDetail, exportTranscripts, exportTranscriptsJson } from '../api';

interface Transcript {
  id: string; campaignId: string; date: string; name: string; company: string;
  phone: string; email: string; sentiment: string; sentimentScore: string;
  interest: string; meetingScheduled: boolean; meetingTitle: string; meetingDate: string;
  notes: string; problems: string; neededFeatures: string; timeOfDemo: string;
  currentStatus: string; roomName: string;
  conversation?: { speaker: string; text: string; timestamp?: string }[];
}

export function Transcripts() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeCampaignId, setActiveCampaignId] = useState("");

  const loadTranscripts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { campaigns } = await getCampaignList();
      const all: Transcript[] = [];
      const seen = new Set<string>();

      for (const c of campaigns) {
        try {
          const { transcripts: list } = await getTranscripts(c.campaign_id);
          for (const t of list) {
            const key = t.room_name || t.transcript_id;
            if (seen.has(key)) continue;
            seen.add(key);

            // Extract company from multiple sources
            let company = t.company || '';
            if (!company || company === '—') {
              const raw = typeof t.source_raw === 'string' ? JSON.parse(t.source_raw || '{}') : (t.source_raw || {});
              company = raw.company || raw.Company || '—';
            }

            all.push({
              id: t.transcript_id, campaignId: c.campaign_id,
              date: t.created_at ? new Date(t.created_at).toLocaleDateString() : '—',
              name: t.candidate_name || '—', company,
              phone: t.phone_number || '', email: t.email || '',
              sentiment: t.sentiment || '—',
              sentimentScore: t.sentiment_score || '',
              interest: t.interest || '—',
              meetingScheduled: !!t.meeting_scheduled,
              meetingTitle: t.meeting_title || '', meetingDate: t.meeting_date || '',
              notes: t.notes || '—', problems: t.problems || '',
              neededFeatures: t.needed_features || '', timeOfDemo: t.time_of_demo || '',
              currentStatus: t.current_status || 'completed', roomName: t.room_name || '',
            });
          }
          if (!activeCampaignId && list.length > 0) setActiveCampaignId(c.campaign_id);
        } catch {}
      }
      setTranscripts(all);
    } catch (e: any) { console.error('[Transcripts]', e); setError(e.message || 'Failed to load transcripts'); }
    setLoading(false);
  }, []);

  useEffect(() => { loadTranscripts(); }, [loadTranscripts]);

  // Auto-refresh if any call is still "calling"
  const hasCallingTranscripts = transcripts.some(t => t.currentStatus === 'calling');
  useEffect(() => {
    if (!hasCallingTranscripts) return;
    const t = setInterval(loadTranscripts, 15000);
    return () => clearInterval(t);
  }, [hasCallingTranscripts, loadTranscripts]);

  const handleRowClick = async (transcript: Transcript) => {
    setDetailLoading(true);
    setIsDialogOpen(true);
    setSelectedTranscript(transcript);
    try {
      const { transcript: detail } = await getTranscriptDetail(transcript.id);
      const tJson = detail.transcript_json;
      let parsed: any = {};
      if (typeof tJson === 'string') { try { parsed = JSON.parse(tJson); } catch { parsed = {}; } }
      else parsed = tJson || {};

      const entries = parsed.entries || detail.entries || detail.transcript || [];
      const conversation = Array.isArray(entries) ? entries.map((e: any) => ({
        speaker: e.speaker || e.role || 'unknown',
        text: e.text || e.content || '',
        timestamp: e.timestamp || '',
      })) : [];

      // Company fallback from detail
      let company = detail.company || transcript.company;
      if (!company || company === '—') {
        const raw = typeof detail.source_raw === 'string' ? JSON.parse(detail.source_raw || '{}') : (detail.source_raw || {});
        company = raw.company || raw.Company || '—';
      }

      setSelectedTranscript({
        ...transcript, company,
        sentiment: detail.sentiment || transcript.sentiment,
        sentimentScore: detail.sentiment_score || transcript.sentimentScore,
        interest: detail.interest || transcript.interest,
        notes: detail.notes || transcript.notes,
        problems: detail.problems || transcript.problems,
        neededFeatures: detail.needed_features || transcript.neededFeatures,
        conversation,
      });
    } catch { /* keep original */ }
    setDetailLoading(false);
  };

  // ── Client-side exports ──
  const handleExportCSV = () => {
    if (transcripts.length === 0) return;
    const headers = ["Date","Name","Company","Phone","Email","Sentiment","Sentiment Score","Interest","Meeting","Notes","Status"];
    const rows = transcripts.map(t => [t.date, t.name, t.company, t.phone, t.email, t.sentiment, t.sentimentScore, t.interest, t.meetingScheduled ? "Yes" : "No", t.notes.replace(/"/g, '""'), t.currentStatus]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    downloadBlob(csv, "text/csv", "transcripts.csv");
  };

  const handleExportSingleJson = () => {
    if (!selectedTranscript) return;
    const json = JSON.stringify(selectedTranscript, null, 2);
    downloadBlob(json, "application/json", `transcript_${selectedTranscript.name.replace(/\s+/g, '_')}.json`);
  };

  const handleExportSingleCSV = () => {
    if (!selectedTranscript) return;
    const t = selectedTranscript;
    const lines = [`"Speaker","Text","Timestamp"`];
    (t.conversation || []).forEach(c => lines.push(`"${c.speaker}","${c.text.replace(/"/g, '""')}","${c.timestamp || ''}"`));
    downloadBlob(lines.join("\n"), "text/csv", `transcript_${t.name.replace(/\s+/g, '_')}.csv`);
  };

  const downloadBlob = (content: string, type: string, filename: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const getSentimentColor = (s: string) => {
    const sl = s.toLowerCase();
    if (sl.includes('positive') || sl.includes('interested')) return 'bg-green-100 text-green-700';
    if (sl.includes('negative') || sl.includes('skeptical')) return 'bg-red-100 text-red-700';
    if (sl.includes('neutral')) return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };
  const getInterestColor = (i: string) => {
    const il = i.toLowerCase();
    if (il.includes('high') || il.includes('very')) return 'bg-emerald-100 text-emerald-700';
    if (il.includes('medium')) return 'bg-cyan-100 text-cyan-700';
    if (il.includes('low') || il.includes('not')) return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><FileText className="size-5 text-indigo-600" />Call Transcripts ({transcripts.length})</CardTitle>
              <CardDescription>Click any row to view full transcript with sentiment analysis.</CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="gap-2" onClick={loadTranscripts} disabled={loading}>
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => { if (activeCampaignId) exportTranscripts(activeCampaignId); }}>
                <Download className="size-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => { if (activeCampaignId) exportTranscriptsJson(activeCampaignId); }}>
                <Download className="size-4" /> JSON
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV} disabled={transcripts.length === 0}>
                <Download className="size-4" /> CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? <div className="text-center py-12 text-red-500">{error} <button onClick={loadTranscripts} className="ml-2 underline text-blue-600">Retry</button></div> :
          loading ? <div className="text-center py-12 text-gray-500">Loading transcripts...</div> : (
          <div className="rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-gray-50">
                <TableHead>DATE</TableHead><TableHead>NAME</TableHead><TableHead>COMPANY</TableHead><TableHead>PHONE</TableHead><TableHead>SENTIMENT</TableHead><TableHead>INTEREST</TableHead><TableHead>MEETING</TableHead><TableHead className="max-w-xs">NOTES</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {transcripts.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-gray-500">No transcripts. Make some calls first.</TableCell></TableRow>
                ) : transcripts.map(t => (
                  <TableRow key={t.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleRowClick(t)}>
                    <TableCell className="font-medium whitespace-nowrap">{t.date}</TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.company}</TableCell>
                    <TableCell className="whitespace-nowrap">{t.phone}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getSentimentColor(t.sentiment)}>{t.sentiment}</Badge>
                      {t.sentimentScore && <span className="ml-1 text-xs text-gray-400">{t.sentimentScore}</span>}
                    </TableCell>
                    <TableCell><Badge variant="secondary" className={getInterestColor(t.interest)}>{t.interest}</Badge></TableCell>
                    <TableCell className={t.meetingScheduled ? "text-green-600 font-medium" : "text-gray-400"}>{t.meetingScheduled ? "Yes" : "No"}</TableCell>
                    <TableCell className="max-w-xs truncate text-gray-600">{t.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Call Transcript Details</DialogTitle>
            <DialogDescription>Full conversation, sentiment analysis, and export options</DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-12 gap-3 text-gray-500">
              <Loader2 className="size-6 animate-spin" /> Loading transcript and sentiment analysis...
            </div>
          ) : selectedTranscript && (
            <div className="space-y-6">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2"><User className="size-4 text-indigo-600" /><div><div className="text-xs text-gray-500">Name</div><div className="font-medium">{selectedTranscript.name}</div></div></div>
                <div className="flex items-center gap-2"><Building className="size-4 text-indigo-600" /><div><div className="text-xs text-gray-500">Company</div><div className="font-medium">{selectedTranscript.company}</div></div></div>
                <div className="flex items-center gap-2"><PhoneIcon className="size-4 text-indigo-600" /><div><div className="text-xs text-gray-500">Phone</div><div className="font-medium">{selectedTranscript.phone}</div></div></div>
                <div className="flex items-center gap-2"><Calendar className="size-4 text-indigo-600" /><div><div className="text-xs text-gray-500">Date</div><div className="font-medium">{selectedTranscript.date}</div></div></div>
              </div>

              {/* Summary */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-xs font-medium text-blue-900 mb-1">Call Summary</div>
                <div className="text-sm text-blue-800">{selectedTranscript.notes}</div>
              </div>

              {/* Analysis badges with sentiment score */}
              <div className="flex flex-wrap gap-4">
                <div>
                  <span className="text-xs text-gray-500 mr-2">Sentiment:</span>
                  <Badge variant="secondary" className={getSentimentColor(selectedTranscript.sentiment)}>{selectedTranscript.sentiment}</Badge>
                  {selectedTranscript.sentimentScore && <span className="ml-2 text-xs text-gray-500">Score: {selectedTranscript.sentimentScore}</span>}
                </div>
                <div><span className="text-xs text-gray-500 mr-2">Interest:</span><Badge variant="secondary" className={getInterestColor(selectedTranscript.interest)}>{selectedTranscript.interest}</Badge></div>
                <div><span className="text-xs text-gray-500 mr-2">Meeting:</span><span className={`text-sm font-medium ${selectedTranscript.meetingScheduled ? 'text-green-600' : 'text-gray-400'}`}>{selectedTranscript.meetingScheduled ? `Yes${selectedTranscript.meetingDate ? ` (${selectedTranscript.meetingDate})` : ''}` : 'No'}</span></div>
              </div>

              {/* Pain points */}
              {(selectedTranscript.problems || selectedTranscript.neededFeatures || selectedTranscript.timeOfDemo) && (
                <div className="grid grid-cols-1 gap-2 p-4 bg-gray-50 rounded-lg text-sm">
                  {selectedTranscript.problems && selectedTranscript.problems !== 'not mentioned' && <div><span className="font-medium text-gray-700">Pain Points:</span> {selectedTranscript.problems}</div>}
                  {selectedTranscript.neededFeatures && selectedTranscript.neededFeatures !== 'not mentioned' && <div><span className="font-medium text-gray-700">Needs:</span> {selectedTranscript.neededFeatures}</div>}
                  {selectedTranscript.timeOfDemo && selectedTranscript.timeOfDemo !== 'not mentioned' && <div><span className="font-medium text-gray-700">Demo/Meeting:</span> {selectedTranscript.timeOfDemo}</div>}
                </div>
              )}

              {/* Conversation */}
              {selectedTranscript.conversation && selectedTranscript.conversation.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2"><MessageSquare className="size-5 text-indigo-600" />Conversation</h3>
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                    {selectedTranscript.conversation.map((msg, idx) => {
                      const isAgent = msg.speaker === 'agent' || msg.speaker === 'assistant';
                      return (
                        <div key={idx} className={`flex gap-3 ${isAgent ? '' : 'justify-end'}`}>
                          {isAgent && <div className="flex-shrink-0"><div className="size-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-medium">AI</div></div>}
                          <div className={`max-w-[80%] ${isAgent ? '' : 'ml-auto'}`}>
                            <div className={`p-3 rounded-lg text-sm ${isAgent ? 'bg-indigo-100 text-indigo-900 rounded-tl-none' : 'bg-green-100 text-green-900 rounded-tr-none'}`}>
                              <div className={`text-xs font-medium mb-1 ${isAgent ? 'text-indigo-600' : 'text-green-600'}`}>
                                {isAgent ? 'Agent' : 'Client'} {msg.timestamp && <span className="text-gray-400 ml-2">{msg.timestamp}</span>}
                              </div>
                              {msg.text}
                            </div>
                          </div>
                          {!isAgent && <div className="flex-shrink-0"><div className="size-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs"><User className="size-4" /></div></div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Export single transcript */}
              <DialogFooter className="flex gap-2 justify-start">
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExportSingleJson}><Download className="size-4" />Export JSON</Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExportSingleCSV}><Download className="size-4" />Export CSV</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
