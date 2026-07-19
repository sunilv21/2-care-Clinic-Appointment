import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Calendar, FileUp, Plus, ChevronLeft, ChevronRight, Link as LinkIcon, Trash2, User, Phone as PhoneIcon, Mail, Clock, MessageSquare } from "lucide-react";
import { getMeetings, deleteMeeting, scheduleManualMeeting, uploadMeetingJson, rescheduleMeeting } from "../api";
import { showSidebarNotification } from "../utils/notifications";

interface Meeting {
  id: string;
  date: string;
  time: string;
  title: string;
  candidate: string;
  email: string;
  phone: string;
  duration: string;
  teamsLink: string;
  status: 'scheduled' | 'rescheduled' | 'completed' | 'cancelled';
  meetingDetails: string;
  notes?: string;
  conversation?: { agent: string[]; client: string[] };
}

export function Meetings() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({ meetingId: "", date: "", time: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', date: '', time: '', meetingDetails: '',
  });

  const loadMeetings = async () => {
    setLoading(true);
    setError(null);
    try {
      const { meetings: list } = await getMeetings();
      setMeetings(list.map((m: any) => ({
        id: m.meeting_id,
        date: m.meeting_date || '',
        time: m.meeting_time || '',
        title: m.title || '',
        candidate: m.candidate_name || '',
        email: m.candidate_email || '',
        phone: m.phone_number || '',
        duration: m.duration_minutes ? `${m.duration_minutes} min` : '30 min',
        teamsLink: m.teams_meeting_link || '',
        status: (m.status || 'scheduled') as any,
        meetingDetails: m.description || '',
        notes: m.participants || '',
      })));
    } catch (e: any) { console.error('[Meetings]', e); setError(e.message || 'Failed to load meetings'); }
    setLoading(false);
  };

  useEffect(() => { loadMeetings(); }, []);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayNames = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

  const previousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const handleScheduleMeeting = () => setIsScheduleDialogOpen(true);

  const handleSubmitMeeting = async () => {
    if (!formData.date || !formData.time || !formData.phone) return;
    try {
      await scheduleManualMeeting({
        candidate_name: formData.name,
        phone_number: formData.phone,
        email: formData.email,
        date: formData.date,
        time: formData.time,
        details: formData.meetingDetails,
      });
      setIsScheduleDialogOpen(false);
      setFormData({ name: '', phone: '', email: '', date: '', time: '', meetingDetails: '' });
      await loadMeetings();
      showSidebarNotification({ message: "✅ Meeting scheduled!", type: "success" });
    } catch (e: any) { showSidebarNotification({ message: "Schedule failed: " + e.message, type: "error" }); }
  };

  const handleRowClick = (meeting: Meeting) => { setSelectedMeeting(meeting); setIsDetailDialogOpen(true); };

  const handleDeleteMeeting = async (meetingId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try { await deleteMeeting(meetingId); setMeetings(meetings.filter(m => m.id !== meetingId)); showSidebarNotification({ message: "🗑️ Meeting deleted", type: "info" }); } catch (err: any) { showSidebarNotification({ message: "Delete failed: " + err.message, type: "error" }); }
  };

  const openReschedule = (meeting: Meeting, e: React.MouseEvent) => {
    e.stopPropagation();
    setRescheduleData({ meetingId: meeting.id, date: meeting.date || "", time: meeting.time || "" });
    setIsRescheduleOpen(true);
  };

  const handleReschedule = async () => {
    if (!rescheduleData.date || !rescheduleData.time) return;
    try {
      const res = await rescheduleMeeting(rescheduleData.meetingId, rescheduleData.date, rescheduleData.time);
      setIsRescheduleOpen(false);
      loadMeetings();
      // Show appropriate message based on email result
      if (res.email_sent) {
        showSidebarNotification({ message: "✅ Meeting rescheduled. Email sent.", type: "success" });
      } else if (res.email_error) {
        showSidebarNotification({ message: "⚠️ Rescheduled. Email failed.", type: "error" });
      } else if (!res.datetime_changed) {
        showSidebarNotification({ message: "Meeting updated (no change).", type: "info" });
      } else {
        showSidebarNotification({ message: "✅ Meeting rescheduled.", type: "success" });
      }
    } catch (err: any) {
      showSidebarNotification({ message: "Reschedule failed: " + err.message, type: "error" });
    }
  };

  const handleUploadJson = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    showSidebarNotification({ message: "Analyzing transcript...", type: "info" });
    try {
      const res = await uploadMeetingJson(file);
      showSidebarNotification({ message: res.message || res.status || "Done", type: res.status === "meeting_scheduled" ? "success" : "info" });
      await loadMeetings();
    } catch (e: any) { showSidebarNotification({ message: "Upload error: " + e.message, type: "error" }); }
  };

  const getStatusColor = (status: string) => {
    switch (status) { case 'scheduled': return 'bg-green-100 text-green-700'; case 'rescheduled': return 'bg-yellow-100 text-yellow-700'; case 'completed': return 'bg-blue-100 text-blue-700'; case 'cancelled': return 'bg-red-100 text-red-700'; default: return 'bg-gray-100 text-gray-700'; }
  };

  const meetingDates = new Set(meetings.map(m => m.date));
  const renderCalendarDays = () => {
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(<div key={`empty-${i}`} className="p-4" />);
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
      const hasMeeting = meetingDates.has(dateStr);
      days.push(
        <div key={day} className={`p-4 text-center border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors relative ${isToday ? "bg-blue-50 border-blue-400 font-semibold text-blue-600" : "text-gray-700"}`}>
          {day}
          {hasMeeting && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1.5 bg-green-500 rounded-full" />}
        </div>
      );
    }
    return days;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="size-5 text-blue-600" />Meeting Calendar</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <Button variant="outline" size="sm" onClick={previousMonth}><ChevronLeft className="size-4" /></Button>
            <h3 className="text-lg font-semibold">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
            <Button variant="outline" size="sm" onClick={nextMonth}><ChevronRight className="size-4" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-0 border border-gray-200 rounded-lg overflow-hidden">
            {dayNames.map(day => <div key={day} className="bg-gray-50 p-3 text-center text-sm font-semibold text-gray-600 border-b border-gray-200">{day}</div>)}
            {renderCalendarDays()}
          </div>
        </CardContent>
      </Card>

      {/* Right Sidebar */}
      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200">
          <CardHeader><CardTitle className="text-lg">Meeting Stats</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <div><div className="text-3xl font-bold text-gray-900">{meetings.length}</div><div className="text-sm text-gray-600">Total Meetings</div></div>
            <div><div className="text-3xl font-bold text-gray-900">{meetings.filter(m => m.status === 'scheduled' || m.status === 'rescheduled').length}</div><div className="text-sm text-gray-600">Upcoming</div></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileUp className="size-5 text-indigo-600" />Upload Transcript JSON</CardTitle><CardDescription className="text-xs">Upload a call transcript JSON to extract & schedule meetings.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
              <Input type="file" accept=".json" ref={fileRef} />
              <Button className="gap-2" onClick={handleUploadJson}>Analyze</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus className="size-5 text-orange-600" />Schedule Meeting Manually</CardTitle></CardHeader>
          <CardContent><Button variant="outline" className="w-full gap-2" onClick={handleScheduleMeeting}><Plus className="size-4" />Schedule Meeting</Button></CardContent>
        </Card>
      </div>

      {/* Scheduled Meetings Table */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle className="flex items-center gap-2"><Calendar className="size-5 text-gray-600" />Scheduled Meetings</CardTitle><CardDescription>Meetings auto-detected from call transcripts. Click any row for details.</CardDescription></div>
            <Button variant="outline" size="sm" onClick={loadMeetings}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? <div className="text-center py-12 text-red-500">{error} <button onClick={loadMeetings} className="ml-2 underline text-blue-600">Retry</button></div> :
          loading ? <div className="text-center py-12 text-gray-500">Loading meetings...</div> : meetings.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No meetings scheduled yet.</div>
          ) : (
            <>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <Table>
                  <TableHeader><TableRow className="bg-gray-50">
                    <TableHead>DATE</TableHead><TableHead>TIME</TableHead><TableHead>TITLE</TableHead><TableHead>CANDIDATE</TableHead><TableHead>EMAIL</TableHead><TableHead>PHONE</TableHead><TableHead>DURATION</TableHead><TableHead>TEAMS LINK</TableHead><TableHead>STATUS</TableHead><TableHead>ACTION</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {meetings.map(meeting => (
                      <TableRow key={meeting.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleRowClick(meeting)}>
                        <TableCell className="font-medium">{meeting.date ? new Date(meeting.date).toLocaleDateString() : '—'}</TableCell>
                        <TableCell>{meeting.time}</TableCell>
                        <TableCell className="max-w-xs truncate">{meeting.title}</TableCell>
                        <TableCell className="font-medium">{meeting.candidate}</TableCell>
                        <TableCell className="text-gray-600">{meeting.email || '—'}</TableCell>
                        <TableCell className="text-gray-600">{meeting.phone || '—'}</TableCell>
                        <TableCell>{meeting.duration}</TableCell>
                        <TableCell>
                          {meeting.teamsLink ? (
                            <Button variant="ghost" size="sm" className="gap-2 text-blue-600 hover:text-blue-700" onClick={e => { e.stopPropagation(); window.open(meeting.teamsLink, '_blank'); }}>
                              <LinkIcon className="size-4" />Join
                            </Button>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </TableCell>
                        <TableCell><Badge variant="secondary" className={getStatusColor(meeting.status)}>{meeting.status}</Badge></TableCell>
                        <TableCell className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={e => openReschedule(meeting, e)} className="hover:bg-blue-50 hover:text-blue-600" title="Reschedule"><Calendar className="size-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={e => handleDeleteMeeting(meeting.id, e)} className="hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 className="size-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 text-sm text-gray-600">Showing {meetings.length} meetings. Click a row for details.</div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Schedule Meeting Dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="size-5 text-orange-600" />Schedule Meeting Manually</DialogTitle><DialogDescription>Fill in the details to schedule a new meeting</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label htmlFor="name" className="text-sm font-medium text-gray-700">NAME</Label><Input id="name" placeholder="Candidate name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="mt-2" /></div>
            <div><Label htmlFor="phone" className="text-sm font-medium text-gray-700">PHONE NUMBER</Label><Input id="phone" placeholder="+91xxxxxxxxxx" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="mt-2" /></div>
            <div><Label htmlFor="email" className="text-sm font-medium text-gray-700">EMAIL</Label><Input id="email" type="email" placeholder="candidate@email.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="mt-2" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label htmlFor="date" className="text-sm font-medium text-gray-700">DATE</Label><Input id="date" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="mt-2" /></div>
              <div><Label htmlFor="time" className="text-sm font-medium text-gray-700">TIME</Label><Input id="time" type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="mt-2" /></div>
            </div>
            <div><Label htmlFor="details" className="text-sm font-medium text-gray-700">MEETING DETAILS</Label><Textarea id="details" placeholder="Meeting topic / details" value={formData.meetingDetails} onChange={e => setFormData({...formData, meetingDetails: e.target.value})} className="mt-2 min-h-[80px]" /></div>
          </div>
          <DialogFooter><Button onClick={handleSubmitMeeting} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">Schedule Meeting</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><PhoneIcon className="size-5 text-indigo-600" />{selectedMeeting?.candidate} — {selectedMeeting?.title}</DialogTitle></DialogHeader>
          {selectedMeeting && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2"><User className="size-4 text-indigo-600" /><div><div className="text-xs text-gray-500">Candidate</div><div className="font-medium">{selectedMeeting.candidate}</div></div></div>
                <div className="flex items-center gap-2"><Mail className="size-4 text-indigo-600" /><div><div className="text-xs text-gray-500">Email</div><div className="font-medium">{selectedMeeting.email || '—'}</div></div></div>
                <div className="flex items-center gap-2"><PhoneIcon className="size-4 text-indigo-600" /><div><div className="text-xs text-gray-500">Phone</div><div className="font-medium">{selectedMeeting.phone || '—'}</div></div></div>
                <div className="flex items-center gap-2"><Calendar className="size-4 text-indigo-600" /><div><div className="text-xs text-gray-500">Date & Time</div><div className="font-medium">{selectedMeeting.date ? new Date(selectedMeeting.date).toLocaleDateString() : '—'} at {selectedMeeting.time}</div></div></div>
                <div className="flex items-center gap-2"><Clock className="size-4 text-indigo-600" /><div><div className="text-xs text-gray-500">Duration</div><div className="font-medium">{selectedMeeting.duration}</div></div></div>
                <div className="flex items-center gap-2"><LinkIcon className="size-4 text-indigo-600" /><div><div className="text-xs text-gray-500">Teams Link</div>{selectedMeeting.teamsLink ? <a href={selectedMeeting.teamsLink} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">Join Meeting</a> : <span className="text-sm text-gray-400">Not configured</span>}</div></div>
              </div>
              <div><h3 className="font-semibold text-sm text-gray-700 mb-2">Meeting Details</h3><div className="p-4 bg-blue-50 rounded-lg border border-blue-200"><p className="text-sm text-gray-800">{selectedMeeting.meetingDetails || '—'}</p></div></div>
              {selectedMeeting.notes && <div><h3 className="font-semibold text-sm text-gray-700 mb-2">NOTES / SUMMARY</h3><div className="p-4 bg-gray-50 rounded-lg border border-gray-200"><p className="text-sm text-gray-800">{selectedMeeting.notes}</p></div></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={isRescheduleOpen} onOpenChange={setIsRescheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Meeting</DialogTitle>
            <DialogDescription>Choose a new date and time for this meeting.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">New Date</label>
              <Input type="date" value={rescheduleData.date} onChange={e => setRescheduleData(d => ({ ...d, date: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">New Time</label>
              <Input type="time" value={rescheduleData.time} onChange={e => setRescheduleData(d => ({ ...d, time: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRescheduleOpen(false)}>Cancel</Button>
            <Button onClick={handleReschedule} disabled={!rescheduleData.date || !rescheduleData.time}>Reschedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
