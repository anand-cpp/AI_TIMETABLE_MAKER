import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
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
    <div>
      <PageHeader
        title="Subjects"
        description="Manage theory, lab, and elective subjects for all classes"
        action={
          <Button
            onClick={handleOpenCreate}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Subject
          </Button>
        }
      />

      {/* Type summary */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {[
          { label: 'Theory', count: theoryCount, color: 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
          { label: 'Lab', count: labCount, color: 'bg-purple-50/80 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
          { label: 'Elective', count: electiveCount, color: 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-2xl border p-4 ${item.color} cursor-pointer transition-all hover:scale-[1.02]`}
            onClick={() => setFilterType(filterType === item.label.toLowerCase() ? '' : item.label.toLowerCase())}
          >
            <p className="text-2xl font-black">{item.count}</p>
            <p className="text-xs font-bold uppercase tracking-wider mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="glass-panel p-0 rounded-3xl overflow-hidden shadow-xl">
        {/* Filter bar */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 flex-wrap">
          <BookOpen className="w-5 h-5 text-blue-500" />
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            {subjects.length} Subject{subjects.length !== 1 ? 's' : ''}
          </span>
          <div className="ml-auto flex gap-3">
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="text-xs font-bold border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
            >
              <option value="" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">All Classes</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                  {c.departmentId?.code} S{c.semester}{c.section}
                </option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs font-bold border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
            >
              <option value="" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">All Types</option>
              <option value="theory" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Theory</option>
              <option value="lab" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Lab</option>
              <option value="elective" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Elective</option>
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