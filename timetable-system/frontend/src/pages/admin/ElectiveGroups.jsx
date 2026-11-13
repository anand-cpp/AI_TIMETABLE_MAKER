import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Layers, Plus, Trash2, Pencil, BookOpen, Clock, X, Check } from 'lucide-react';
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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const ElectiveGroups = () => {
  const [groups, setGroups] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal & form states
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    departmentId: '',
    semester: 4,
    sections: ['A', 'B'],
    options: [
      { subjectId: '', weeklyHours: 3, teacherIds: [] }
    ],
    fixedSlot: {
      day: '',
      period: 0,
      isMandatory: false,
    },
    isActive: true,
  });

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [groupsRes, deptsRes, subsRes, teachersRes] = await Promise.all([
        api.get('/elective-groups'),
        departmentService.getAll(),
        subjectService.getAll(),
        teacherService.getAll(),
      ]);

      setGroups(groupsRes.data.data?.groups || groupsRes.data.groups || []);
      setDepartments(deptsRes.data.departments || []);
      setSubjects(subsRes.data.subjects || []);
      setTeachers(teachersRes.data.teachers || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load elective groups data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleOpenCreate = () => {
    setEditTarget(null);
    setFormData({
      name: '',
      departmentId: departments[0]?._id || '',
      semester: 4,
      sections: ['A', 'B'],
      options: [
        { subjectId: '', weeklyHours: 3, teacherIds: [] }
      ],
      fixedSlot: {
        day: '',
        period: 0,
        isMandatory: false,
      },
      isActive: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (group) => {
    setEditTarget(group);
    setFormData({
      name: group.name || '',
      departmentId: group.departmentId?._id || group.departmentId || departments[0]?._id || '',
      semester: group.semester || 4,
      sections: group.sections && group.sections.length > 0 ? group.sections : ['A', 'B'],
      options: (group.options && group.options.length > 0)
        ? group.options.map((opt) => ({
            subjectId: opt.subjectId?._id || opt.subjectId || '',
            weeklyHours: opt.weeklyHours || 3,
            teacherIds: (opt.teacherIds || []).map((t) => t._id || t),
          }))
        : [{ subjectId: '', weeklyHours: 3, teacherIds: [] }],
      fixedSlot: {
        day: group.fixedSlot?.day || '',
        period: group.fixedSlot?.period || 0,
        isMandatory: group.fixedSlot?.isMandatory || false,
      },
      isActive: group.isActive !== undefined ? group.isActive : true,
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditTarget(null);
  };

  const handleSaveGroup = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Group name is required');
      return;
    }
    if (!formData.departmentId) {
      toast.error('Department is required');
      return;
    }

    try {
      setFormLoading(true);
      const payload = {
        name: formData.name.trim(),
        departmentId: formData.departmentId,
        semester: Number(formData.semester),
        sections: formData.sections,
        options: formData.options.filter((opt) => opt.subjectId),
        fixedSlot: {
          day: formData.fixedSlot.day,
          period: Number(formData.fixedSlot.period) || 0,
          isMandatory: !!formData.fixedSlot.isMandatory,
        },
        isActive: formData.isActive,
      };

      if (editTarget) {
        await api.put(`/elective-groups/${editTarget._id}`, payload);
        toast.success('Elective group updated successfully');
      } else {
        await api.post('/elective-groups', payload);
        toast.success('Elective group created successfully');
      }
      handleCloseModal();
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save elective group');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      await api.delete(`/elective-groups/${deleteTarget._id}`);
      toast.success('Elective group deleted');
      setDeleteTarget(null);
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete elective group');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Section toggle helper
  const toggleSection = (sec) => {
    setFormData((prev) => {
      const exists = prev.sections.includes(sec);
      return {
        ...prev,
        sections: exists ? prev.sections.filter((s) => s !== sec) : [...prev.sections, sec],
      };
    });
  };

  // Option row helpers
  const handleOptionChange = (idx, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.options];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, options: updated };
    });
  };

  const addOptionRow = () => {
    setFormData((prev) => ({
      ...prev,
      options: [...prev.options, { subjectId: '', weeklyHours: 3, teacherIds: [] }],
    }));
  };

  const removeOptionRow = (idx) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== idx),
    }));
  };

  // Filter subjects for current semester
  const availableSubjects = subjects.filter((s) => {
    if (!formData.semester) return true;
    return s.classId?.semester === Number(formData.semester) || s.semester === Number(formData.semester) || !s.classId;
  });

  const columns = [
    {
      key: 'name',
      title: 'Group Name',
      render: (val, row) => (
        <div>
          <span className="font-semibold text-sm text-[var(--text-primary)]">{val}</span>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            {row.departmentId?.name || row.departmentId?.code || 'Department'}
          </p>
        </div>
      ),
    },
    {
      key: 'semester',
      title: 'Semester',
      render: (val) => <span className="font-mono font-medium text-xs">S{val}</span>,
    },
    {
      key: 'sections',
      title: 'Sections',
      render: (val) => (
        <div className="flex gap-1 flex-wrap">
          {(val && val.length > 0 ? val : ['All']).map((s, i) => (
            <Badge key={i} variant="outline" size="sm">
              Sec {s}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'options',
      title: 'Options (Subjects & Faculty)',
      render: (val) => (
        <div className="space-y-1.5 py-1">
          {val?.map((opt, idx) => (
            <div key={idx} className="text-xs flex items-center gap-2">
              <Badge variant="purple">
                {opt.subjectId?.code || opt.subjectId?.name || `Option ${idx + 1}`}
              </Badge>
              <span className="font-medium text-[var(--text-primary)]">
                {opt.subjectId?.name}
              </span>
              <span className="text-[var(--text-muted)]">({opt.weeklyHours || 3} hrs)</span>
              {opt.teacherIds && opt.teacherIds.length > 0 && (
                <span className="text-[11px] text-[var(--text-secondary)] italic">
                  [{opt.teacherIds.map((t) => t.name || t).join(', ')}]
                </span>
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'fixedSlot',
      title: 'Fixed Slot',
      render: (val) =>
        val?.day && val?.period ? (
          <span className="text-xs font-mono font-medium text-[var(--accent)]">
            {val.day} P{val.period} {val.isMandatory ? '★' : ''}
          </span>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">Flexible</span>
        ),
    },
    {
      key: 'isActive',
      title: 'Status',
      render: (val) => (
        <Badge variant={val !== false ? 'success' : 'neutral'} size="sm">
          {val !== false ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => handleOpenEdit(row)}
            leftIcon={<Pencil className="w-3.5 h-3.5" />}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setDeleteTarget(row)}
            className="text-[var(--error)]"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Elective Groups"
        subtitle="Manage shared and parallel elective courses across sections"
        action={
          <Button
            variant="primary"
            onClick={handleOpenCreate}
            leftIcon={<Plus className="w-4 h-4" strokeWidth={1.5} />}
          >
            Create Elective Group
          </Button>
        }
      />

      <Card className="p-6 border border-[var(--border)]">
        <Table
          columns={columns}
          data={groups}
          loading={loading}
          emptyMessage="No elective groups configured yet."
          emptyIcon={Layers}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editTarget ? 'Edit Elective Group' : 'Create Elective Group'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveGroup} className="space-y-4 font-sans text-xs">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Group Name"
              required
              placeholder="e.g. S4 Minor Elective or S8 PE3"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            />

            <Select
              label="Department"
              required
              value={formData.departmentId}
              onChange={(e) => setFormData((p) => ({ ...p, departmentId: e.target.value }))}
              options={departments.map((d) => ({
                value: d._id,
                label: `${d.name} (${d.code})`,
              }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
                Semester *
              </label>
              <select
                className="w-full rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                value={formData.semester}
                onChange={(e) => setFormData((p) => ({ ...p, semester: Number(e.target.value) }))}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Semester {s} (S{s})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
                Paired Sections *
              </label>
              <div className="flex gap-2 items-center mt-2">
                {['A', 'B', 'C'].map((sec) => (
                  <label key={sec} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={formData.sections.includes(sec)}
                      onChange={() => toggleSection(sec)}
                      className="rounded border-[var(--border)] text-[var(--accent)]"
                    />
                    <span>Section {sec}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Options (Elective Subject Choices) */}
          <div className="space-y-2 border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--text-primary)]">
                Elective Options (Subjects in this group)
              </label>
              <Button type="button" variant="outline" size="xs" onClick={addOptionRow} leftIcon={<Plus className="w-3 h-3" />}>
                Add Option
              </Button>
            </div>

            <div className="space-y-3">
              {formData.options.map((opt, idx) => (
                <div key={idx} className="p-3 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--text-secondary)]">Option {idx + 1}</span>
                    {formData.options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOptionRow(idx)}
                        className="text-[var(--error)] hover:opacity-80"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
                        Subject *
                      </label>
                      <select
                        className="w-full rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                        value={opt.subjectId}
                        onChange={(e) => handleOptionChange(idx, 'subjectId', e.target.value)}
                      >
                        <option value="">-- Select Subject --</option>
                        {availableSubjects.map((s) => (
                          <option key={s._id} value={s._id}>
                            [{s.code}] {s.name} ({s.classId?.name || `S${s.semester || ''}`})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
                        Hours/Week
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        className="w-full rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                        value={opt.weeklyHours}
                        onChange={(e) => handleOptionChange(idx, 'weeklyHours', Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      Faculty Member
                    </label>
                    <select
                      className="w-full rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                      value={opt.teacherIds[0] || ''}
                      onChange={(e) =>
                        handleOptionChange(idx, 'teacherIds', e.target.value ? [e.target.value] : [])
                      }
                    >
                      <option value="">-- Select Faculty --</option>
                      {teachers.map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.name} ({t.designation || 'Faculty'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fixed Slot Setting */}
          <div className="space-y-2 border-t border-[var(--border)] pt-4">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--text-primary)]">
              Fixed Slot (Optional Synchronized Slot)
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] mb-1">Day</label>
                <select
                  className="w-full rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                  value={formData.fixedSlot.day}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      fixedSlot: { ...p.fixedSlot, day: e.target.value },
                    }))
                  }
                >
                  <option value="">Flexible (Any Day)</option>
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-muted)] mb-1">Period</label>
                <select
                  className="w-full rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                  value={formData.fixedSlot.period}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      fixedSlot: { ...p.fixedSlot, period: Number(e.target.value) },
                    }))
                  }
                >
                  <option value={0}>Flexible</option>
                  {[1, 2, 3, 4, 5, 6].map((p) => (
                    <option key={p} value={p}>
                      Period {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center pt-4">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={formData.fixedSlot.isMandatory}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        fixedSlot: { ...p.fixedSlot, isMandatory: e.target.checked },
                      }))
                    }
                    className="rounded border-[var(--border)] text-[var(--accent)]"
                  />
                  <span>Mandatory Lock</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
                className="rounded border-[var(--border)] text-[var(--accent)]"
              />
              <span className="font-semibold text-[var(--text-primary)]">Group is Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border)]">
            <Button type="button" variant="outline" onClick={handleCloseModal} disabled={formLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={formLoading}>
              {editTarget ? 'Update Group' : 'Create Group'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Elective Group"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? Referencing subjects will be safely unlinked.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default ElectiveGroups;
