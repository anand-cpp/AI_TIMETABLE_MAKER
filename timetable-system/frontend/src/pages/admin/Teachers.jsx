import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Breadcrumb from '../../components/ui/Breadcrumb';
import TeacherList from '../../components/teachers/TeacherList';
import TeacherForm from '../../components/teachers/TeacherForm';
import TeacherPersonalTimetableModal from '../../components/teachers/TeacherPersonalTimetableModal';
import teacherService from '../../services/teacherService';
import { Plus, Users, Copy, Check, Eye, EyeOff, Search } from 'lucide-react';

const Teachers = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [credModalOpen, setCredModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState('');

  // Personal Timetable Modal State
  const [personalTimetableTarget, setPersonalTimetableTarget] = useState(null);

  const navigate = useNavigate();

  const load = async () => {
    try {
      setLoading(true);
      // Fetch comprehensive faculty workload overview
      const res = await teacherService.getWorkloadOverview();
      setTeachers(res.data?.faculty || []);
    } catch {
      // Fallback to basic getAll
      try {
        const fallbackRes = await teacherService.getAll();
        setTeachers(fallbackRes.data?.teachers || []);
      } catch (err) {
        toast.error('Failed to load faculty records');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return teachers;
    const q = searchQuery.toLowerCase();
    return teachers.filter((t) => {
      const matchName = t.name?.toLowerCase().includes(q);
      const matchDept = t.department?.toLowerCase().includes(q) || t.departmentCode?.toLowerCase().includes(q);
      const matchSub = (t.assignedSubjects || []).some(
        s => (s.code && s.code.toLowerCase().includes(q)) || (s.name && s.name.toLowerCase().includes(q))
      );
      return matchName || matchDept || matchSub;
    });
  }, [teachers, searchQuery]);

  const handleViewProfile = (teacher) => {
    navigate(`/admin/teachers/${teacher._id}/profile`);
  };

  const handleViewPersonalTimetable = (teacher) => {
    setPersonalTimetableTarget(teacher);
  };

  const handleOpenCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (teacher) => {
    setEditTarget(teacher);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditTarget(null);
  };

  const handleSubmit = async (data) => {
    try {
      setFormLoading(true);
      if (editTarget) {
        await teacherService.update(editTarget._id, data);
        toast.success('Teacher updated successfully');
        handleCloseForm();
        load();
      } else {
        const res = await teacherService.create(data);
        handleCloseForm();
        load();
        if (res.data.credentials) {
          setCredentials({
            name: res.data.teacher.name,
            username: res.data.credentials.username,
            password: res.data.credentials.password,
          });
          setCredModalOpen(true);
          setShowPassword(false);
          setCopied('');
        }
        toast.success('Teacher created successfully');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setFormLoading(false);
    }
  };

  const handleShowCredentials = (teacher) => {
    setCredentials({
      name: teacher.name,
      username: teacher.username,
      password: null,
    });
    setCredModalOpen(true);
    setShowPassword(false);
  };

  const handleDelete = async () => {
    try {
      setDeleteLoading(true);
      const res = await teacherService.delete(deleteTarget._id);
      const warning = res.data?.warning;
      if (warning) {
        toast.success(`Teacher deleted. ⚠️ ${warning}`);
      } else {
        toast.success('Teacher deleted successfully');
      }
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete teacher');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Setup', to: '/admin/departments' }, { label: 'Teachers' }]} />

      <PageHeader
        title="Faculty Management & Workload Overview"
        description="Search faculty profiles, inspect scheduled teaching hours, and view individual personal timetables."
        action={
          <Button
            onClick={handleOpenCreate}
            leftIcon={<Plus className="w-4 h-4" strokeWidth={1.5} />}
          >
            Add Teacher
          </Button>
        }
      />

      {/* Overview Table Card */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-0 overflow-hidden shadow-xs">
        {/* Table Top Controls & Search */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.5} />
            <span className="text-xs font-sans font-medium text-[var(--text-primary)]">
              {teachers.length} Faculty Member{teachers.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[var(--text-muted)] text-xs">·</span>
            <span className="text-xs font-sans text-emerald-500 font-medium">
              {teachers.filter((t) => t.isActive).length} active
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Filter by name, dept, subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
        </div>

        <TeacherList
          teachers={filteredTeachers}
          loading={loading}
          onEdit={handleOpenEdit}
          onDelete={setDeleteTarget}
          onShowCredentials={handleShowCredentials}
          onViewProfile={handleViewProfile}
          onViewPersonalTimetable={handleViewPersonalTimetable}
        />
      </div>

      {/* Individual Teacher Personal Timetable Modal */}
      <TeacherPersonalTimetableModal
        isOpen={!!personalTimetableTarget}
        onClose={() => setPersonalTimetableTarget(null)}
        teacherId={personalTimetableTarget?._id}
        teacherName={personalTimetableTarget?.name}
      />

      {/* Create/Edit Modal */}
      <Modal
        isOpen={formOpen}
        onClose={handleCloseForm}
        title={editTarget ? 'Edit Teacher' : 'Add Teacher'}
        size="lg"
      >
        <TeacherForm
          onSubmit={handleSubmit}
          onCancel={handleCloseForm}
          loading={formLoading}
          initialData={editTarget}
        />
      </Modal>

      {/* Credentials Modal */}
      <Modal
        isOpen={credModalOpen}
        onClose={() => setCredModalOpen(false)}
        title="Teacher Login Credentials"
        size="sm"
      >
        <div className="space-y-4 font-sans">
          <div className="p-3 bg-[var(--accent-soft)] border border-[var(--border)] rounded-sm">
            <p className="text-xs text-[var(--text-secondary)]">
              <strong className="text-[var(--text-primary)]">Important:</strong> Share these credentials with the teacher.
              {credentials?.password
                ? ' The password is only shown once — save it now.'
                : ' Password was set during creation.'}
            </p>
          </div>

          {credentials && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono uppercase text-[var(--text-label)] block mb-1">
                  Faculty Name
                </label>
                <div className="p-2.5 rounded-sm bg-[var(--bg-surface-alt)] border border-[var(--border)] text-xs font-medium text-[var(--text-primary)]">
                  {credentials.name}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-[var(--text-label)] block mb-1">
                  Username
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2.5 rounded-sm bg-[var(--bg-surface-alt)] border border-[var(--border)] text-xs font-mono text-[var(--text-primary)]">
                    {credentials.username}
                  </div>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleCopy(credentials.username, 'username')}
                    leftIcon={copied === 'username' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copied === 'username' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              {credentials.password && (
                <div>
                  <label className="text-[11px] font-mono uppercase text-[var(--text-label)] block mb-1">
                    Password
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-2.5 rounded-sm bg-[var(--bg-surface-alt)] border border-[var(--border)] text-xs font-mono text-[var(--text-primary)]">
                      {showPassword ? credentials.password : '••••••••••••'}
                    </div>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => handleCopy(credentials.password, 'password')}
                      leftIcon={copied === 'password' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    >
                      {copied === 'password' ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={() => setCredModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Teacher"
        message={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        confirmLabel="Delete"
        isDestructive
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default Teachers;
