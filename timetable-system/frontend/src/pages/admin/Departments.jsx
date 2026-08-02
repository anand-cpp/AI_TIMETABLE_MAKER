import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import DepartmentList from '../../components/departments/DepartmentList';
import DepartmentForm from '../../components/departments/DepartmentForm';
import departmentService from '../../services/departmentService';
import { Plus, Building2 } from 'lucide-react';

const Departments = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await departmentService.getAll();
      setDepartments(res.data.departments || []);
    } catch {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleOpenCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (dept) => {
    setEditTarget(dept);
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
        await departmentService.update(editTarget._id, data);
        toast.success('Department updated successfully');
      } else {
        await departmentService.create(data);
        toast.success('Department created successfully');
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
      await departmentService.delete(deleteTarget._id);
      toast.success('Department deleted successfully');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete department');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Manage college departments and their details"
        action={
          <Button
            onClick={handleOpenCreate}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Department
          </Button>
        }
      />

      <div className="space-y-4">
        <DepartmentList
          departments={departments}
          loading={loading}
          onEdit={handleOpenEdit}
          onDelete={setDeleteTarget}
        />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={formOpen}
        onClose={handleCloseForm}
        title={editTarget ? 'Edit Department' : 'Add Department'}
        size="md"
      >
        <DepartmentForm
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
        title="Delete Department"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone. Classes and teachers assigned to this department must be removed first.`}
        confirmText="Delete Department"
        variant="danger"
      />
    </div>
  );
};

export default Departments;