import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Breadcrumb from '../../components/ui/Breadcrumb';
import SubjectList from '../../components/subjects/SubjectList';
import SubjectForm from '../../components/subjects/SubjectForm';
import subjectService from '../../services/subjectService';
import classService from '../../services/classService';
import { Plus, BookOpen } from 'lucide-react';

const Subjects = () => {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [filterClass, setFilterClass] = useState('');
  const [filterType, setFilterType] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterClass) params.classId = filterClass;
      if (filterType) params.type = filterType;
      const [subRes, classRes] = await Promise.all([
        subjectService.getAll(params),
        classService.getAll(),
      ]);
      setSubjects(subRes.data.subjects || []);
      setClasses(classRes.data.classes || []);
    } catch {
      toast.error('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterClass, filterType]);

  const handleOpenCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (subject) => {
    setEditTarget(subject);
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
        await subjectService.update(editTarget._id, data);
        toast.success('Subject updated successfully');
      } else {
        await subjectService.create(data);
        toast.success('Subject created successfully');
      }
      handleCloseForm();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleteLoading(true);
      await subjectService.delete(deleteTarget._id);
      toast.success('Subject deleted successfully');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete subject');
    } finally {
      setDeleteLoading(false);
    }
  };

  const theoryCount = subjects.filter((s) => s.type === 'theory').length;
  const labCount = subjects.filter((s) => s.type === 'lab').length;
  const electiveCount = subjects.filter((s) => s.type === 'elective').length;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Setup', to: '/admin/departments' }, { label: 'Subjects' }]} />

      <PageHeader
        title="Subjects & Labs"
        description="Add theory, lab, and elective subjects for all classes (Step 4 of 4 in setup)"
        action={
          <Button
            onClick={handleOpenCreate}
            leftIcon={<Plus className="w-4 h-4" strokeWidth={1.5} />}
          >
            Add Subject
          </Button>
        }
      />

      {/* Type summary */}
      <div className="grid grid-cols-3 gap-4 font-sans">
        {[
          { label: 'Theory', count: theoryCount, type: 'theory' },
          { label: 'Lab', count: labCount, type: 'lab' },
          { label: 'Elective', count: electiveCount, type: 'elective' },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-4 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
            onClick={() => setFilterType(filterType === item.type ? '' : item.type)}
          >
            <p className="text-2xl font-mono font-medium text-[var(--accent)]">{item.count}</p>
            <p className="text-xs font-sans font-semibold uppercase tracking-wider text-[var(--text-secondary)] mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-[var(--bg-surface)] rounded-md border border-[var(--border)] p-0 overflow-hidden">
        {/* Filter bar */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.5} />
            <span className="text-sm font-serif font-normal text-[var(--text-primary)]">
              {subjects.length} Subject{subjects.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="ml-auto flex gap-3">
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="text-xs font-sans border border-[var(--border)] bg-transparent text-[var(--text-primary)] rounded-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)] cursor-pointer"
            >
              <option value="" className="bg-[var(--bg-surface)]">All Classes</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id} className="bg-[var(--bg-surface)]">
                  {c.departmentId?.code} S{c.semester}{c.section}
                </option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs font-sans border border-[var(--border)] bg-transparent text-[var(--text-primary)] rounded-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)] cursor-pointer"
            >
              <option value="" className="bg-[var(--bg-surface)]">All Types</option>
              <option value="theory" className="bg-[var(--bg-surface)]">Theory</option>
              <option value="lab" className="bg-[var(--bg-surface)]">Lab</option>
              <option value="elective" className="bg-[var(--bg-surface)]">Elective</option>
            </select>
          </div>
        </div>

        <SubjectList
          subjects={subjects}
          loading={loading}
          onEdit={handleOpenEdit}
          onDelete={setDeleteTarget}
        />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={formOpen}
        onClose={handleCloseForm}
        title={editTarget ? 'Edit Subject' : 'Add Subject'}
        size="lg"
      >
        <SubjectForm
          onSubmit={handleSubmit}
          onCancel={handleCloseForm}
          loading={formLoading}
          initialData={editTarget}
        />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete Subject"
        message={`Delete "${deleteTarget?.name}"? This will remove it from the class and any generated timetables.`}
        confirmText="Delete Subject"
        variant="danger"
      />
    </div>
  );
};

export default Subjects;