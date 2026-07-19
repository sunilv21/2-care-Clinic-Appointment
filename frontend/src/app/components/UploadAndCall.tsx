import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Play, Square, Trash2, Upload, FileSpreadsheet, Phone, RotateCcw, ChevronDown, AlertCircle, CheckCircle2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import {
  getCampaignList, getCampaignMetrics, createCampaign, uploadExcel,
  getIngestPreview, startCalling, stopCalling, clearQueue, resetQueue,
  quickCall, deleteExcelUpload,
} from "../api";
import { showSidebarNotification } from "../utils/notifications";

export function UploadAndCall() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileInfo, setFileInfo] = useState("");
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [quickCallNumber, setQuickCallNumber] = useState("");
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>(["System initialized"]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState("");
  const [uploadMode, setUploadMode] = useState<"append" | "replace">("append");
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [excelFiles, setExcelFiles] = useState<any[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const MAX_DEBUG_LOGS = 100;
  const log = (msg: string) => {
    const ts = new Date().toLocaleTimeString();
    console.log(`[UploadAndCall] ${msg}`);
    setDebugLogs(prev => {
      const next = [...prev, `[${ts}] ${msg}`];
      return next.length > MAX_DEBUG_LOGS ? next.slice(-MAX_DEBUG_LOGS) : next;
    });
  };

  // ── Load campaigns ──
  useEffect(() => {
    (async () => {
      try {
        const data = await getCampaignList();
        const list = data.campaigns || [];
        setCampaigns(list);
        log(`Loaded ${list.length} campaigns`);
        if (list.length > 0) {
          setSelectedCampaign(list[0].campaign_id);
          log(`Auto-selected: ${list[0].name}`);
        }
      } catch (e: any) { log("Failed to load campaigns: " + e.message); }
    })();
  }, []);

  // ── Load metrics on campaign change ──
  useEffect(() => {
    if (!selectedCampaign) return;
    (async () => {
      try {
        const m = await getCampaignMetrics(selectedCampaign);
        setMetrics(m);
        setIsQueueRunning(m.call_queue?.is_running || false);
        setExcelFiles(m.excel_files || []);
        log(`Metrics: ${m.jobs?.length || 0} leads, ${(m.excel_files || []).length} files`);
        try { setPreviewRows((await getIngestPreview(selectedCampaign)).rows || []); } catch { setPreviewRows([]); }
      } catch (e: any) { log("Metrics error: " + e.message); }
    })();
  }, [selectedCampaign]);

  const handleCreateCampaign = async () => {
    const name = campaignName.trim();
    if (!name) return;
    setLoading("create");
    try {
      const res = await createCampaign(name);
      showSidebarNotification({ message: `Campaign "${name}" created!`, type: "success" });
      setCampaignName("");
      const data = await getCampaignList();
      setCampaigns(data.campaigns || []);
      setSelectedCampaign(res.campaign_id);
    } catch (e: any) { showSidebarNotification({ message: "Failed: " + e.message, type: "error" }); }
    setLoading("");
  };

  const handleUpload = async () => {
    log("Upload clicked");
    if (!selectedCampaign) { showSidebarNotification({ message: "Select a campaign first!", type: "error" }); return; }
    const file = fileRef.current?.files?.[0];
    if (!file) { showSidebarNotification({ message: 'Click "Choose File" first!', type: "error" }); return; }
    const fname = file.name.toLowerCase();
    if (!fname.endsWith(".xlsx") && !fname.endsWith(".xls")) { showSidebarNotification({ message: "Must be .xlsx or .xls", type: "error" }); return; }

    if (uploadMode === "replace" && !showReplaceConfirm) {
      setShowReplaceConfirm(true);
      showSidebarNotification({ message: "⚠️ Replace will remove queued leads. Click Upload again to confirm.", type: "info" });
      return;
    }
    setShowReplaceConfirm(false);
    setLoading("upload");
    showSidebarNotification({ message: `Uploading ${file.name} (${uploadMode})...`, type: "info" });

    try {
      const res = await uploadExcel(selectedCampaign, file, uploadMode);
      const cnt = res.jobs_inserted || res.jobs?.length || 0;
      showSidebarNotification({ message: `✅ ${cnt} leads ingested from ${file.name}`, type: "success" });
      try { setPreviewRows((await getIngestPreview(selectedCampaign)).rows || []); } catch (e: any) { log("Preview refresh failed: " + (e.message || e)); }
      try { const m = await getCampaignMetrics(selectedCampaign); setMetrics(m); setExcelFiles(m.excel_files || []); } catch (e: any) { log("Metrics refresh failed: " + (e.message || e)); }
      setFileInfo(""); if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) { showSidebarNotification({ message: "Upload failed: " + e.message, type: "error" }); }
    setLoading("");
  };

  const handleStart = async () => { if (!selectedCampaign) return; try { await startCalling(selectedCampaign); setIsQueueRunning(true); showSidebarNotification({ message: "📞 Calling started", type: "success" }); } catch (e: any) { showSidebarNotification({ message: "Start failed: " + e.message, type: "error" }); } };
  const handleStop = async () => { if (!selectedCampaign) return; try { await stopCalling(selectedCampaign); setIsQueueRunning(false); showSidebarNotification({ message: "⏹️ Calling stopped", type: "info" }); } catch (e: any) { showSidebarNotification({ message: "Stop failed: " + e.message, type: "error" }); } };
  const handleClear = async () => { if (!selectedCampaign) return; try { await clearQueue(selectedCampaign); showSidebarNotification({ message: "🗑️ Queue cleared", type: "info" }); } catch (e: any) { showSidebarNotification({ message: "Clear failed: " + e.message, type: "error" }); } };
  const handleReset = async () => { if (!selectedCampaign) return; try { await resetQueue(selectedCampaign); showSidebarNotification({ message: "🔄 Queue reset", type: "info" }); } catch (e: any) { showSidebarNotification({ message: "Reset failed: " + e.message, type: "error" }); } };
  const normalizePhone = (num: string) => {
    let p = num.trim().replace(/[\s\-()]/g, "");
    if (!p.startsWith("+")) {
      if (p.startsWith("91") && p.length >= 12) p = "+" + p;
      else p = "+91" + p.replace(/^0+/, "");
    }
    return p;
  };

  const handleQuickCall = async () => {
    if (!quickCallNumber.trim()) return;
    const normalized = normalizePhone(quickCallNumber);
    try {
      await quickCall(normalized);
      log(`Quick call: ${normalized}`);
      setQuickCallNumber("");
      showSidebarNotification({ message: `📞 Call initiated to ${normalized}`, type: "success" });
    } catch (e: any) {
      log("Quick call failed: " + e.message);
      showSidebarNotification({ message: "❌ Quick call failed: " + e.message, type: "error" });
    }
  };

  const handleDeleteExcel = async (uploadId: string, fileName: string) => {
    try {
      const res = await deleteExcelUpload(selectedCampaign, uploadId);
      setExcelFiles(prev => prev.filter(x => x.upload_id !== uploadId));
      setDeleteConfirm(null);
      const deleted = res.leads_deleted || 0;
      log(`Deleted: ${fileName} (${deleted} queued leads removed)`);
      showSidebarNotification({ message: `Deleted ${fileName} — ${deleted} queued leads removed.`, type: "success" });
      // Refresh preview and metrics to reflect removed leads
      try { setPreviewRows((await getIngestPreview(selectedCampaign)).rows || []); } catch { setPreviewRows([]); }
      try { const m = await getCampaignMetrics(selectedCampaign); setMetrics(m); setExcelFiles(m.excel_files || []); } catch {}
    } catch (e: any) { log("Delete failed: " + e.message); showSidebarNotification({ message: "Delete failed: " + e.message, type: "error" }); }
  };

  const previewCols = previewRows.length > 0 ? Object.keys(previewRows[0]).filter(k => k !== "row_num") : [];

  return (
    <div className="space-y-6">



      {/* ROW 1: Campaign Setup — 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Create Campaign + Quick Call */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><span className="text-purple-600">+</span> Create Campaign</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input placeholder="Campaign name" value={campaignName} onChange={e => setCampaignName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreateCampaign()} className="flex-1" />
              <Button onClick={handleCreateCampaign} disabled={loading === "create" || !campaignName.trim()}>
                {loading === "create" ? "..." : "Create"}
              </Button>
            </div>
            {/* Quick Call inside Create Campaign card */}
            <div className="border-t border-gray-200 pt-3">
              <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1"><Phone className="size-3" /> Quick Call</div>
              <div className="flex gap-2">
                <Input placeholder="Phone (e.g. 9876543210)" value={quickCallNumber} onChange={e => setQuickCallNumber(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleQuickCall()} className="flex-1 h-8 text-sm" />
                <Button size="sm" className="gap-1 h-8" onClick={handleQuickCall} disabled={!quickCallNumber.trim()}>
                  <Phone className="size-3" /> Call
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Excel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="size-5 text-blue-600" /> Upload Excel</CardTitle>
            <CardDescription className="text-[10px] leading-tight">
              {selectedCampaign ? "Upload .xlsx with leads columns" : "⚠️ Select a campaign first"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input type="file" accept=".xlsx,.xls" ref={fileRef}
              onChange={e => { const f = e.target.files?.[0]; setFileInfo(f ? `${f.name} (${(f.size / 1024).toFixed(1)} KB)` : ""); }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
            {fileInfo && <p className="text-xs text-gray-500">{fileInfo}</p>}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs">
                <input type="radio" name="uploadMode" checked={uploadMode === "append"} onChange={() => { setUploadMode("append"); setShowReplaceConfirm(false); }} /> Append
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="radio" name="uploadMode" checked={uploadMode === "replace"} onChange={() => { setUploadMode("replace"); setShowReplaceConfirm(false); }} />
                <span className="text-orange-600">Replace queued</span>
              </label>
            </div>
            <Button className={`w-full gap-2 ${showReplaceConfirm ? "bg-red-600 hover:bg-red-700" : ""}`} onClick={handleUpload} disabled={loading === "upload"}>
              <Upload className="size-4" /> {loading === "upload" ? "Uploading..." : showReplaceConfirm ? "Confirm Replace & Upload" : "Upload & Ingest"}
            </Button>
          </CardContent>
        </Card>

        {/* Active Campaign */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className={`size-2 rounded-full ${selectedCampaign ? "bg-green-500" : "bg-gray-400"}`} /> Active Campaign
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <Select value={selectedCampaign} onValueChange={v => { setSelectedCampaign(v); log(`Selected: ${v}`); }}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Select campaign..." /></SelectTrigger>
                <SelectContent>
                  {campaigns.length === 0
                    ? <SelectItem value="_none" disabled>No campaigns yet</SelectItem>
                    : campaigns.map(c => <SelectItem key={c.campaign_id} value={c.campaign_id}>{c.name} — {c.campaign_id.substring(0, 8)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => { if (selectedCampaign) getCampaignMetrics(selectedCampaign).then(m => { setMetrics(m); setExcelFiles(m.excel_files || []); }); }} disabled={!selectedCampaign}>Load</Button>
            </div>
            {metrics ? (
              <div className="text-sm text-gray-600">
                <strong>{metrics.campaign?.name}</strong> &bull; {metrics.jobs?.length || 0} leads
                &bull; {metrics.campaign?.created_at ? new Date(metrics.campaign.created_at).toLocaleString() : ""}
              </div>
            ) : <div className="text-sm text-gray-400">No campaign selected</div>}
          </CardContent>
        </Card>
      </div>

      {/* ROW 2: Call Queue + Uploaded Excel Files */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">

        {/* Call Queue Control */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Phone className="size-5 text-red-500" />Call Queue</CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <div className={`size-2 rounded-full ${isQueueRunning ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
              <span className="text-gray-600">{isQueueRunning ? "Running" : "Idle"}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 [&>button]:flex-1">
              <Button onClick={handleStart} disabled={isQueueRunning || !selectedCampaign} className="gap-2 bg-green-600 hover:bg-green-700 text-white"><Play className="size-4" />Start</Button>
              <Button onClick={handleStop} disabled={!isQueueRunning} className="gap-2 bg-red-600 hover:bg-red-700 text-white"><Square className="size-4" />Stop</Button>
              <Button onClick={handleClear} disabled={!selectedCampaign} className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"><Trash2 className="size-4" />Clear</Button>
              <Button onClick={handleReset} disabled={!selectedCampaign} className="gap-2 bg-yellow-500 hover:bg-yellow-600 text-white"><RotateCcw className="size-4" />Reset</Button>
            </div>
          </CardContent>
        </Card>

        {/* Uploaded Excel Files (was Quick Call) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="size-5 text-indigo-600" />Uploaded Files</CardTitle>
            <CardDescription className="text-xs">{excelFiles.length} file{excelFiles.length !== 1 ? 's' : ''} for this campaign</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedCampaign ? (
              <div className="text-sm text-gray-400 py-2">Select a campaign first.</div>
            ) : excelFiles.length === 0 ? (
              <div className="text-sm text-gray-400 py-2">No Excel files uploaded yet. Upload one above.</div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {excelFiles.map((ef: any) => (
                  <div key={ef.upload_id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 truncate flex items-center gap-1.5">
                        <FileSpreadsheet className="size-3.5 text-green-600 shrink-0" />
                        {ef.file_name}
                      </div>
                      <div className="text-gray-400 mt-0.5">
                        {ef.lead_count} leads &bull;
                        <Badge variant="secondary" className={`ml-1 text-[10px] px-1.5 py-0 ${ef.upload_mode === 'replace' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                          {ef.upload_mode}
                        </Badge>
                        <span className="ml-1">{ef.uploaded_at ? new Date(ef.uploaded_at).toLocaleDateString() : ""}</span>
                      </div>
                    </div>
                    {deleteConfirm === ef.upload_id ? (
                      <div className="flex gap-1 ml-2 shrink-0">
                        <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2" onClick={() => handleDeleteExcel(ef.upload_id, ef.file_name)}>Delete</Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-6 px-1.5 text-gray-400 hover:text-red-600 shrink-0" onClick={() => setDeleteConfirm(ef.upload_id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Excel Preview */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="size-5 text-cyan-600" />Excel Preview</CardTitle></CardHeader>
        <CardContent>
          {previewRows.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No data yet. Upload an Excel file to see preview.</div>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="bg-gray-50">
                  <TableHead>ROW</TableHead>
                  {previewCols.map(c => <TableHead key={c}>{c.toUpperCase()}</TableHead>)}
                </TableRow></TableHeader>
                <TableBody>
                  {previewRows.map((row: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.row_num || i + 1}</TableCell>
                      {previewCols.map(c => <TableCell key={c}>{typeof row[c] === "object" ? JSON.stringify(row[c]) : String(row[c] ?? "")}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debug Log */}
      <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
              <CardTitle className="flex items-center gap-2">
                <ChevronDown className={`size-5 transition-transform ${debugOpen ? "rotate-180" : ""}`} />
                Debug Log ({debugLogs.length})
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-xs max-h-60 overflow-y-auto">
                {debugLogs.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
