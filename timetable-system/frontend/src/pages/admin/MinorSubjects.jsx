import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  BookMarked,
  Plus,
  Trash2,
  Pencil,
  Clock,
  Check,
  RefreshCw,
  Layers,
  Sparkles,
  AlertCircle,
  Calendar,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import api from '../../services/api';
import departmentService from '../../services/departmentService';
import subjectService from '../../services/subjectService';
import teacherService from '../../services/teacherService';

const FIXED_SLOTS_REFERENCE = [
  { day: 'Monday', period: 3, label: 'Monday Period 3 (11:20 AM - 12:20 PM)' },
  { day: 'Thursday', period: 3, label: 'Thursday Period 3 (11:20 AM - 12:20 PM)' },
  { day: 'Friday', period: 4, label: 'Friday Period 4 (12:00 PM - 12:50 PM)' },
  { day: 'Friday', period: 6, label: 'Friday Period 6 (03:30 PM - 04:20 PM)' },
];

const MinorSubjects = () => {
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [workloadSummary, setWorkloadSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [solving, setSolving] = useState(false);

  // Sub-Minor Modal & Form
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [editingSubMinorIndex, setEditingSubMinorIndex] = useState(-1);
  const [subFormData, setSubFormData] = useState({
    subjectName: '',
    subjectCode: '',
    weeklyHours: 1,
    teacherIdA: '',
    teacherIdB: '',
    roomName: 'Classroom',
    description: '',
  });

  // Group Settings Modal
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupFormData, setGroupFormData] = useState({
    name: 'S4 CSE Sub-Minor Group',
    weeklyHours: 4,
    notes: '',
  });

  const [deleteTargetSubIndex, setDeleteTargetSubIndex] = useState(null);

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [groupsRes, deptsRes, subsRes, teachersRes, classesRes, summaryRes] = await Promise.all([
        api.get('/minor-groups'),
        departmentService.getAll(),
        subjectService.getAll(),
        teacherService.getAll(),
        api.get('/classes').catch(() => ({ data: { data: { classes: [] } } })),
        api.get('/minor-groups/workload-summary').catch(() => ({ data: { data: { summary: [] } } })),
      ]);

      const loadedGroups = groupsRes.data?.data?.groups || groupsRes.data?.groups || [];
      setGroups(loadedGroups);

      // Find primary active S4 group
      const s4Group = loadedGroups.find((g) => g.semester === 4 && g.isActive && !g.isArchived) || loadedGroups[0];
      setActiveGroup(s4Group || null);

      setDepartments(deptsRes.data?.departments || []);
      setSubjects(subsRes.data?.subjects || []);
      setTeachers(teachersRes.data?.teachers || []);
      setClasses(classesRes.data?.data?.classes || classesRes.data?.classes || []);
      setWorkloadSummary(summaryRes.data?.data?.summary || summaryRes.data?.summary || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load minor groups data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Derived accounting calculations
  const requiredHours = activeGroup?.weeklyHours || 4;

  // Sub-minors list extracted from classConfigs
  const classAConfig = activeGroup?.classConfigs?.find((c) => c.section === 'A' || c.className?.includes(' A')) || activeGroup?.classConfigs?.[0];
  const classBConfig = activeGroup?.classConfigs?.find((c) => c.section === 'B' || c.className?.includes(' B')) || activeGroup?.classConfigs?.[1];

  const subMinors = classAConfig?.subMinors || [];
  const configuredHours = subMinors.reduce((sum, sm) => sum + (Number(sm.weeklyHours) || 0), 0);
  const remainingHours = requiredHours - configuredHours;

  let status = 'Complete';
  let statusVariant = 'success';
  if (configuredHours < requiredHours) {
    status = 'Incomplete';
    statusVariant = 'amber';
  } else if (configuredHours > requiredHours) {
    status = 'Overconfigured';
    statusVariant = 'danger';
  }

  // Handle open modal for Add Sub-Minor
  const handleOpenAddSubMinor = () => {
    setEditingSubMinorIndex(-1);
    setSubFormData({
      subjectName: '',
      subjectCode: '',
      weeklyHours: 1,
      teacherIdA: teachers[0]?._id || '',
      teacherIdB: teachers[1]?._id || teachers[0]?._id || '',
      roomName: 'Classroom',
      description: '',
    });
    setSubModalOpen(true);
  };

  // Handle open modal for Edit Sub-Minor
  const handleOpenEditSubMinor = (index) => {
    const smA = classAConfig?.subMinors?.[index];
    const smB = classBConfig?.subMinors?.[index];
    if (!smA) return;

    setEditingSubMinorIndex(index);
    setSubFormData({
      subjectName: smA.subjectName || '',
      subjectCode: smA.subjectCode || '',
      weeklyHours: smA.weeklyHours || 1,
      teacherIdA: smA.teacherIds?.[0]?._id || smA.teacherIds?.[0] || '',
      teacherIdB: smB?.teacherIds?.[0]?._id || smB?.teacherIds?.[0] || '',
      roomName: smA.roomName || 'Classroom',
      description: smA.description || '',
    });
    setSubModalOpen(true);
  };

  // Save Sub-Minor (Add or Edit) with persistence
  const handleSaveSubMinor = async (e) => {
    e.preventDefault();
    if (!subFormData.subjectName.trim()) {
      toast.error('Please enter a subject name');
      return;
    }

    if (!activeGroup) {
      toast.error('No active minor group found');
      return;
    }

    try {
      const teacherA = teachers.find((t) => t._id === subFormData.teacherIdA);
      const teacherB = teachers.find((t) => t._id === subFormData.teacherIdB);

      const subItemA = {
        subjectName: subFormData.subjectName.trim(),
        subjectCode: subFormData.subjectCode.trim(),
        weeklyHours: Number(subFormData.weeklyHours) || 1,
        teacherIds: subFormData.teacherIdA ? [subFormData.teacherIdA] : [],
        teacherNames: teacherA ? [teacherA.name] : [],
        roomName: 'LH 201',
        description: subFormData.description || '',
      };

      const subItemB = {
        subjectName: subFormData.subjectName.trim(),
        subjectCode: subFormData.subjectCode.trim(),
        weeklyHours: Number(subFormData.weeklyHours) || 1,
        teacherIds: subFormData.teacherIdB ? [subFormData.teacherIdB] : [],
        teacherNames: teacherB ? [teacherB.name] : [],
        roomName: 'LH 202',
        description: subFormData.description || '',
      };

      // Clone classConfigs
      const updatedClassConfigs = JSON.parse(JSON.stringify(activeGroup.classConfigs || []));

      // Ensure class configs for A and B exist
      const s4a = classes.find((c) => c.name?.includes('S4 CSE A')) || { _id: classAConfig?.classId, name: 'S4 CSE A', section: 'A' };
      const s4b = classes.find((c) => c.name?.includes('S4 CSE B')) || { _id: classBConfig?.classId, name: 'S4 CSE B', section: 'B' };

      let cfgA = updatedClassConfigs.find((c) => c.section === 'A' || c.className?.includes(' A'));
      if (!cfgA) {
        cfgA = { classId: s4a._id, className: s4a.name, section: 'A', subMinors: [], allocatedSlots: [] };
        updatedClassConfigs.push(cfgA);
      }

      let cfgB = updatedClassConfigs.find((c) => c.section === 'B' || c.className?.includes(' B'));
      if (!cfgB) {
        cfgB = { classId: s4b._id, className: s4b.name, section: 'B', subMinors: [], allocatedSlots: [] };
        updatedClassConfigs.push(cfgB);
      }

      if (editingSubMinorIndex >= 0) {
        // Update existing
        cfgA.subMinors[editingSubMinorIndex] = { ...cfgA.subMinors[editingSubMinorIndex], ...subItemA };
        cfgB.subMinors[editingSubMinorIndex] = { ...cfgB.subMinors[editingSubMinorIndex], ...subItemB };
      } else {
        // Add new
        cfgA.subMinors.push(subItemA);
        cfgB.subMinors.push(subItemB);
      }

      // Persist to DB
      const res = await api.put(`/minor-groups/${activeGroup._id}`, {
        classConfigs: updatedClassConfigs,
      });

      toast.success(editingSubMinorIndex >= 0 ? 'Minor subject updated' : 'Minor subject added');
      setSubModalOpen(false);

      // Auto-trigger solve to update allocated slots
      await api.post(`/minor-groups/${activeGroup._id}/solve`).catch(() => {});

      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save minor subject');
    }
  };

  // Remove Sub-Minor with persistence
  const handleConfirmDeleteSubMinor = async () => {
    if (deleteTargetSubIndex === null || !activeGroup) return;

    try {
      const updatedClassConfigs = JSON.parse(JSON.stringify(activeGroup.classConfigs || []));
      for (const cfg of updatedClassConfigs) {
        if (cfg.subMinors && cfg.subMinors.length > deleteTargetSubIndex) {
          cfg.subMinors.splice(deleteTargetSubIndex, 1);
        }
      }

      await api.put(`/minor-groups/${activeGroup._id}`, {
        classConfigs: updatedClassConfigs,
      });

      toast.success('Minor subject removed');
      setDeleteTargetSubIndex(null);

      // Auto-solve remaining if possible
      await api.post(`/minor-groups/${activeGroup._id}/solve`).catch(() => {});

      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete minor subject');
    }
  };

  // Solve Sub-Minor Allocations across the 4 Fixed Slots
  const handleSolveAllocations = async () => {
    if (!activeGroup) return;
    try {
      setSolving(true);
      const res = await api.post(`/minor-groups/${activeGroup._id}/solve`);
      toast.success(res.data?.data?.message || 'Minor allocation solved with zero conflicts!');
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to solve minor allocation');
    } finally {
      setSolving(false);
    }
  };

  // Sync with Published Timetable
  const handleSyncToPublished = async () => {
    try {
      setSyncing(true);
      const res = await api.post('/minor-groups/sync-published');
      toast.success(`Published timetable synchronized successfully! (${res.data?.data?.updatedSlotsCount || 8} slots updated)`);
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to sync with published timetable');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minor Subjects Configuration"
        subtitle="Configure Semester 4 Minor requirement, independent faculty assignments, and locked period distribution"
        badge="KTU Autonomous"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon={<Cpu className={`w-4 h-4 ${solving ? 'animate-spin' : ''}`} />}
              onClick={handleSolveAllocations}
              disabled={solving || status !== 'Complete'}
              title={status !== 'Complete' ? 'Configure exactly 4 hours to solve allocation' : 'Run CSP Sub-Minor Solver'}
            >
              {solving ? 'Solving CSP...' : 'Solve Permutations'}
            </Button>
            <Button
              variant="outline"
              icon={<RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />}
              onClick={handleSyncToPublished}
              disabled={syncing || status !== 'Complete'}
            >
              {syncing ? 'Syncing...' : 'Sync to Published Timetable'}
            </Button>
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={handleOpenAddSubMinor}
              disabled={configuredHours >= requiredHours}
            >
              Add Minor Subject
            </Button>
          </div>
        }
      />

      {/* SEMESTER 4 MINOR REQUIREMENT & ACCOUNTING CARD */}
      <Card
        title="Semester 4 — Minor Requirement & Workload Tally"
        icon={<BookMarked className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-[var(--bg-surface-alt)] border border-[var(--border)] gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                Academic Curriculum Rule
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)] mt-0.5">
                Minor Requirement: {requiredHours} hours/week
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Reserved strictly for S4 CSE A and S4 CSE B at locked coordinates (Mon P3, Thu P3, Fri P4, Fri P6).
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-[var(--text-muted)]">Total Configured</div>
                <div className="text-2xl font-extrabold text-[var(--text-primary)]">
                  {configuredHours} / {requiredHours} hrs
                </div>
              </div>
              <Badge variant={statusVariant} size="lg">
                Status: {status}
              </Badge>
            </div>
          </div>

          {/* Validation Status Notice */}
          {status === 'Incomplete' && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                <strong>Incomplete configuration:</strong> Configured {configuredHours} of {requiredHours} required hours. Remaining: {remainingHours} hour(s). Please add another 1-hour subject to complete the requirement.
              </span>
            </div>
          )}

          {status === 'Overconfigured' && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                <strong>Configuration invalid:</strong> Configured Minor workload ({configuredHours}h) exceeds the {requiredHours}-hour academic requirement. Remove or reduce subject hours.
              </span>
            </div>
          )}

          {status === 'Complete' && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                <strong>Configuration complete:</strong> Exactly 4 hours configured across 4 sub-minor subjects. Ready for constraint-aware distribution across the 4 reserved slots.
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* CONFIGURED SUB-MINOR SUBJECTS TABLE */}
      <Card
        title="Configured Sub-Minor Subjects"
        icon={<Layers className="w-5 h-5 text-[var(--accent)]" />}
      >
        {loading ? (
          <div className="py-8 text-center text-[var(--text-muted)]">Loading sub-minor configuration...</div>
        ) : subMinors.length === 0 ? (
          <div className="py-8 text-center text-[var(--text-muted)]">
            No sub-minor subjects configured. Click "Add Minor Subject" to add Mathematics, DBMS, COA, or OS.
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="w-12 text-center">#</th>
                <th>Subject Name</th>
                <th>Code</th>
                <th>Weekly Hours</th>
                <th>S4 CSE A Faculty</th>
                <th>S4 CSE B Faculty</th>
                <th>Assigned Rooms</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subMinors.map((sm, idx) => {
                const smB = classBConfig?.subMinors?.[idx];
                const facultyAName = sm.teacherNames?.[0] || 'Unassigned';
                const facultyBName = smB?.teacherNames?.[0] || 'Unassigned';
                const isJointFaculty = sm.teacherIds?.[0] && smB?.teacherIds?.[0] && sm.teacherIds[0].toString() === smB.teacherIds[0].toString();

                return (
                  <tr key={idx}>
                    <td className="text-center font-bold text-[var(--text-muted)]">{idx + 1}</td>
                    <td className="font-bold text-[var(--text-primary)]">
                      Minor / {sm.subjectName}
                      {sm.description && (
                        <div className="text-xs font-normal text-[var(--text-muted)] mt-0.5">{sm.description}</div>
                      )}
                    </td>
                    <td>
                      <Badge variant="outline">{sm.subjectCode || 'N/A'}</Badge>
                    </td>
                    <td>
                      <Badge variant="purple">{sm.weeklyHours || 1} Hour</Badge>
                    </td>
                    <td>
                      <span className="font-medium text-[var(--text-primary)]">{facultyAName}</span>
                    </td>
                    <td>
                      <span className="font-medium text-[var(--text-primary)]">{facultyBName}</span>
                      {isJointFaculty && (
                        <span className="ml-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium">
                          (Shared Teacher)
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="text-xs text-[var(--text-muted)]">
                        Sec A: LH 201 | Sec B: LH 202
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil className="w-3.5 h-3.5" />}
                          onClick={() => handleOpenEditSubMinor(idx)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-500/10"
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                          onClick={() => setDeleteTargetSubIndex(idx)}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {/* LOCKED COORDINATE DISTRIBUTION PREVIEW */}
      <Card
        title="Locked Minor Slots & Cross-Section Distribution"
        icon={<Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
      >
        <p className="text-xs text-[var(--text-secondary)] mb-4">
          Non-negotiable fixed coordinates. The permutation solver assigns each sub-minor subject to exactly one locked period per section without teacher double-bookings.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FIXED_SLOTS_REFERENCE.map((slotRef, sIdx) => {
            const allocA = classAConfig?.allocatedSlots?.find((s) => s.day === slotRef.day && s.period === slotRef.period);
            const allocB = classBConfig?.allocatedSlots?.find((s) => s.day === slotRef.day && s.period === slotRef.period);

            return (
              <div
                key={sIdx}
                className="p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-alt)] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-purple-700 dark:text-purple-300">
                    {slotRef.day} Period {slotRef.period}
                  </span>
                  <Badge variant="outline">Locked Slot</Badge>
                </div>
                <div className="text-xs text-[var(--text-muted)]">{slotRef.label}</div>

                <div className="space-y-2 pt-2 border-t border-[var(--border)] text-xs">
                  <div className="p-2 rounded bg-[var(--bg-surface)] border border-[var(--border)]">
                    <div className="font-semibold text-[var(--text-muted)]">S4 CSE A:</div>
                    <div className="font-bold text-[var(--text-primary)]">
                      {allocA?.subjectName || 'Minor Subject'}
                    </div>
                    <div className="text-[var(--text-secondary)]">
                      {allocA?.teacherNames?.[0] || 'Faculty A'}
                    </div>
                  </div>

                  <div className="p-2 rounded bg-[var(--bg-surface)] border border-[var(--border)]">
                    <div className="font-semibold text-[var(--text-muted)]">S4 CSE B:</div>
                    <div className="font-bold text-[var(--text-primary)]">
                      {allocB?.subjectName || 'Minor Subject'}
                    </div>
                    <div className="text-[var(--text-secondary)]">
                      {allocB?.teacherNames?.[0] || 'Faculty B'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* S4 WORKLOAD ACCOUNTING CARD */}
      <Card
        title="S4 Academic Workload Audit (Capacity: 30 Periods/Week)"
        icon={<BookMarked className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workloadSummary.map((item) => (
            <div
              key={item.classId}
              className="p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-alt)] space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-base text-[var(--text-primary)]">{item.className}</span>
                <Badge variant="purple">Semester {item.semester}</Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 bg-[var(--bg-surface)] rounded border border-[var(--border)]">
                  <div className="text-[var(--text-muted)]">Core Theory</div>
                  <div className="font-bold text-sm text-[var(--text-primary)]">{item.coreHours}h</div>
                </div>
                <div className="p-2 bg-[var(--bg-surface)] rounded border border-[var(--border)]">
                  <div className="text-[var(--text-muted)]">Electives</div>
                  <div className="font-bold text-sm text-[var(--text-primary)]">{item.electiveHours}h</div>
                </div>
                <div className="p-2 bg-[var(--bg-surface)] rounded border border-[var(--border)]">
                  <div className="text-[var(--text-muted)]">Laboratories</div>
                  <div className="font-bold text-sm text-[var(--text-primary)]">{item.labHours}h</div>
                </div>
                <div className="p-2 bg-purple-500/10 rounded border border-purple-500/30">
                  <div className="text-purple-600 dark:text-purple-400 font-semibold">Minor Subjects</div>
                  <div className="font-bold text-sm text-purple-700 dark:text-purple-300">{item.minorHours}h</div>
                </div>
                <div className="p-2 bg-[var(--bg-surface)] rounded border border-[var(--border)]">
                  <div className="text-[var(--text-muted)]">Placement / Other</div>
                  <div className="font-bold text-sm text-[var(--text-primary)]">{item.placementHours}h</div>
                </div>
                <div className="p-2 bg-emerald-500/10 rounded border border-emerald-500/30">
                  <div className="text-emerald-600 dark:text-emerald-400 font-semibold">Total Legitimate</div>
                  <div className="font-bold text-sm text-emerald-700 dark:text-emerald-300">
                    {item.totalLegitimateWorkload}h / 30h
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ADD / EDIT SUB-MINOR MODAL */}
      <Modal
        open={subModalOpen}
        onClose={() => setSubModalOpen(false)}
        title={editingSubMinorIndex >= 0 ? 'Edit Minor Subject' : 'Add Minor Subject'}
        size="md"
      >
        <form onSubmit={handleSaveSubMinor} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Subject Name"
              value={subFormData.subjectName}
              onChange={(e) => setSubFormData({ ...subFormData, subjectName: e.target.value })}
              placeholder="e.g. Mathematics, DBMS, OS, COA"
              required
            />
            <Input
              label="Subject Code"
              value={subFormData.subjectCode}
              onChange={(e) => setSubFormData({ ...subFormData, subjectCode: e.target.value })}
              placeholder="e.g. GAMAT401, PCCST402"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Weekly Hours"
              type="number"
              min="1"
              max="4"
              value={subFormData.weeklyHours}
              onChange={(e) => setSubFormData({ ...subFormData, weeklyHours: Number(e.target.value) })}
              required
            />
            <Input
              label="Room"
              value={subFormData.roomName}
              onChange={(e) => setSubFormData({ ...subFormData, roomName: e.target.value })}
              placeholder="Classroom"
            />
          </div>

          <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-alt)] space-y-3">
            <div className="text-xs font-semibold text-purple-700 dark:text-purple-300">
              Independent Class Faculty Assignments
            </div>

            <Select
              label="S4 CSE A Faculty"
              value={subFormData.teacherIdA}
              onChange={(e) => setSubFormData({ ...subFormData, teacherIdA: e.target.value })}
              required
            >
              <option value="">-- Select Faculty for Section A --</option>
              {teachers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </Select>

            <Select
              label="S4 CSE B Faculty"
              value={subFormData.teacherIdB}
              onChange={(e) => setSubFormData({ ...subFormData, teacherIdB: e.target.value })}
              required
            >
              <option value="">-- Select Faculty for Section B --</option>
              {teachers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>

          <Input
            label="Description / Track Notes"
            value={subFormData.description}
            onChange={(e) => setSubFormData({ ...subFormData, description: e.target.value })}
            placeholder="e.g. Database Management Systems Minor Track"
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--border)]">
            <Button variant="outline" type="button" onClick={() => setSubModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingSubMinorIndex >= 0 ? 'Save Changes' : 'Add Subject'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE MODAL */}
      <ConfirmDialog
        open={deleteTargetSubIndex !== null}
        onClose={() => setDeleteTargetSubIndex(null)}
        onConfirm={handleConfirmDeleteSubMinor}
        title="Remove Minor Subject"
        description="Are you sure you want to remove this sub-minor subject? The total configured hours will decrease accordingly."
        confirmText="Remove"
        danger
      />
    </div>
  );
};

export default MinorSubjects;
