import { useEffect, useState } from 'react';
import Select from '../ui/Select';
import Button from '../ui/Button';
import classService from '../../services/classService';
import departmentService from '../../services/departmentService';
import { Search } from 'lucide-react';

const ClassDropdowns = ({ onSearch, loading }) => {
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [sections, setSections] = useState([]);

  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSem, setSelectedSem] = useState('');
  const [selectedSection, setSelectedSection] = useState('');

  const [deptLoading, setDeptLoading] = useState(true);
  const [semLoading, setSemLoading] = useState(false);
  const [sectionLoading, setSectionLoading] = useState(false);

  // Load departments on mount
  useEffect(() => {
    departmentService.getAll()
      .then((res) => setDepartments(res.data.departments || []))
      .catch(() => {})
      .finally(() => setDeptLoading(false));
  }, []);

  // Load semesters when department changes
  useEffect(() => {
    if (!selectedDept) {
      setSemesters([]);
      setSelectedSem('');
      setSections([]);
      setSelectedSection('');
      return;
    }
    setSemLoading(true);
    classService.getSemestersByDepartment(selectedDept)
      .then((res) => {
        setSemesters(res.data.semesters || []);
        setSelectedSem('');
        setSections([]);
        setSelectedSection('');
      })
      .catch(() => setSemesters([]))
      .finally(() => setSemLoading(false));
  }, [selectedDept]);

  // Load sections when semester changes
  useEffect(() => {
    if (!selectedDept || !selectedSem) {
      setSections([]);
      setSelectedSection('');
      return;
    }
    setSectionLoading(true);
    classService.getSectionsByDepartmentAndSemester(selectedDept, selectedSem)
      .then((res) => {
        setSections(res.data.classes || []);
        setSelectedSection('');
      })
      .catch(() => setSections([]))
      .finally(() => setSectionLoading(false));
  }, [selectedDept, selectedSem]);

  const handleSearch = () => {
    if (!selectedDept || !selectedSem || !selectedSection) return;
    const section = sections.find((s) => s._id === selectedSection);
    onSearch({
      departmentId: selectedDept,
      semester: selectedSem,
      section: section?.section || selectedSection,
    });
  };

  const deptOptions = departments.map((d) => ({
    value: d._id,
    label: `${d.name} (${d.code})`,
  }));

  const semOptions = semesters.map((s) => ({
    value: String(s),
    label: `Semester ${s}`,
  }));

  const sectionOptions = sections.map((s) => ({
    value: s._id,
    label: `Section ${s.section}`,
  }));

  const canSearch = selectedDept && selectedSem && selectedSection;

  return (
    <div className="space-y-4">
      <Select
        label="Department"
        required
        options={deptOptions}
        placeholder={deptLoading ? 'Loading...' : 'Select your department'}
        disabled={deptLoading}
        value={selectedDept}
        onChange={(e) => setSelectedDept(e.target.value)}
      />

      <Select
        label="Semester"
        required
        options={semOptions}
        placeholder={
          !selectedDept
            ? 'Select department first'
            : semLoading
            ? 'Loading...'
            : semesters.length === 0
            ? 'No semesters found'
            : 'Select semester'
        }
        disabled={!selectedDept || semLoading || semesters.length === 0}
        value={selectedSem}
        onChange={(e) => setSelectedSem(e.target.value)}
      />

      <Select
        label="Section"
        required
        options={sectionOptions}
        placeholder={
          !selectedSem
            ? 'Select semester first'
            : sectionLoading
            ? 'Loading...'
            : sections.length === 0
            ? 'No sections found'
            : 'Select section'
        }
        disabled={!selectedSem || sectionLoading || sections.length === 0}
        value={selectedSection}
        onChange={(e) => setSelectedSection(e.target.value)}
      />

      <Button
        fullWidth
        onClick={handleSearch}
        disabled={!canSearch}
        loading={loading}
        size="lg"
        leftIcon={<Search className="w-4 h-4" />}
      >
        View My Timetable
      </Button>
    </div>
  );
};

export default ClassDropdowns;