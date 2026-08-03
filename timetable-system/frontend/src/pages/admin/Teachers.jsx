import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Breadcrumb from '../../components/ui/Breadcrumb';
import TeacherList from '../../components/teachers/TeacherList';
import TeacherForm from '../../components/teachers/TeacherForm';
import teacherService from '../../services/teacherService';
import { Plus, Users, Copy, Check, Eye, EyeOff } from 'lucide-react';

const Teachers = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [credModalOpen, setCredModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const res = await teacherService.getAll();
      setTeachers(res.data.teachers || []);
    } catch {
      toast.error('Failed to load teachers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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
        title="Faculty / Teachers"
        description="Add teacher accounts, set availability, and manage workload limits (Step 3 of 4 in setup)"
        action={
          <Button
            onClick={handleOpenCreate}
            leftIcon={<Plus className="w-4 h-4" strokeWidth={1.5} />}
          >
            Add Teacher
          </Button>
        }
      />

      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <Users className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.5} />
          <span className="text-xs font-sans font-medium text-[var(--text-primary)]">
            {teachers.length} Teacher{teachers.length !== 1 ? 's' : ''}
          </span>
          <span className="text-[var(--text-muted)] text-xs">·</span>
          <span className="text-xs font-sans text-[var(--text-secondary)]">
            {teachers.filter((t) => t.isActive).length} active
          </span>
        </div>
        <TeacherList
          teachers={teachers}
          loading={loading}
          onEdit={handleOpenEdit}
          onDelete={setDeleteTarget}
          onShowCredentials={handleShowCredentials}
        />
      </div>

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
                <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Teacher Name</p>
                <p className="text-sm font-serif font-normal text-[var(--text-primary)]">{credentials.name}</p>
              </div>

              <div>
                <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Username</p>
                <div className="flex items-center gap-2 p-2.5 bg-[var(--bg-surface-alt)] rounded-sm border border-[var(--border)]">
                  <code className="flex-1 text-xs font-mono text-[var(--text-primary)]">
                    {credentials.username}
                  </code>
                  <button
                    onClick={() => handleCopy(credentials.username, 'username')}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {copied === 'username'
                      ? <Check className="w-4 h-4 text-[var(--success)]" strokeWidth={1.5} />
                      : <Copy className="w-4 h-4" strokeWidth={1.5} />
                    }
                  </button>
                </div>
              </div>

              {credentials.password && (
                <div>
                  <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Password</p>
                  <div className="flex items-center gap-2 p-2.5 bg-[var(--bg-surface-alt)] rounded-sm border border-[var(--border)]">
                    <code className="flex-1 text-xs font-mono text-[var(--text-primary)]">
                      {showPassword ? credentials.password : '••••••••••'}
                    </code>
                    <button
                      onClick={() => setShowPassword((s) => !s)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      {showPassword
                        ? <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                        : <Eye className="w-4 h-4" strokeWidth={1.5} />
                      }
                    </button>
                    <button
                      onClick={() => handleCopy(credentials.password, 'password')}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      {copied === 'password'
                        ? <Check className="w-4 h-4 text-[var(--success)]" strokeWidth={1.5} />
                        : <Copy className="w-4 h-4" strokeWidth={1.5} />
                      }
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => setCredModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete Teacher"
        message={`Delete "${deleteTarget?.name}"? If this teacher is assigned to subjects, those assignments will need to be updated manually.`}
        confirmText="Delete Teacher"
        variant="danger"
      />
    </div>
  );
};

export default Teachers;