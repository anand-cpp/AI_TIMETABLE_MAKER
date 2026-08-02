import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Select from '../../components/ui/Select';
import ClassList from '../../components/classes/ClassList';
import ClassForm from '../../components/classes/ClassForm';
import classService from '../../services/classService';
import departmentService from '../../services/departmentService';
import { Plus, GraduationCap } from 'lucide-react';

const Classes = () => {
  const [classes, setClasses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [filterDept, setFilterDept] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const params = filterDept ? { departmentId: filterDept } : {};
      const [classRes, deptRes] = await Promise.all([
        classService.getAll(params),
        departmentService.getAll(),
      ]);
      setClasses(classRes.data.classes || []);
      setDepartments(deptRes.data.departments || []);
    } catch {
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterDept]);

  const handleOpenCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (cls) => {
    setEditTarget(cls);
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
        await classService.update(editTarget._id, data);
        toast.success('Class updated successfully');
      } else {
        await classService.create(data);
        toast.success('Class created successfully');
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
      const res = await classService.delete(deleteTarget._id);
      const count = res.data?.deletedSubjectsCount || 0;
      toast.success(
        `Class deleted${count > 0 ? ` along with ${count} subject(s)` : ''}`
      );
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete class');
    } finally {
      setDeleteLoading(false);
    }
  };

  const deptOptions = departments.map((d) => ({
    value: d._id,
    label: `${d.name} (${d.code})`,
  }));

  return (
    <div>
      <PageHeader
        title="Classes"
        description="Manage class groups by department, semester and section"
        action={
          <Button
            onClick={handleOpenCreate}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Class
          </Button>
        }
      />

      <div className="glass-panel p-0 rounded-3xl overflow-hidden shadow-xl">
        {/* Filter bar */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <GraduationCap className="w-5 h-5 text-blue-500" />
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            {classes.length} Class{classes.length !== 1 ? 'es' : ''}
          </span>
          <div className="ml-auto w-60">
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full text-xs font-bold border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
            >
              <option value="" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <ClassList
          classes={classes}
          loading={loading}
          onEdit={handleOpenEdit}
          onDelete={setDeleteTarget}
        />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={formOpen}
        onClose={handleCloseForm}
        title={editTarget ? 'Edit Class' : 'Add Class'}
        size="md"
      >
        <ClassForm
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
        title="Delete Class"
        message={`Delete "${deleteTarget?.departmentId?.code} Sem ${deleteTarget?.semester} Sec ${deleteTarget?.section}"? All subjects in this class will also be deleted permanently.`}
        confirmText="Delete Class & Subjects"
        variant="danger"
      />
    </div>
  );
};

export default Classes;