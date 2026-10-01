import { useState, useRef } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import OfficialTimetableExport from './OfficialTimetableExport';
import TeacherTimetableExport from './TeacherTimetableExport';
import { Download, Printer, FileText, UserCheck, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

const OfficialExportModal = ({
  isOpen,
  onClose,
  classTimetable,
  timetableVersion,
  teachers = [],
}) => {
  const [activeTab, setActiveTab] = useState('class'); // 'class' | 'teacher'
  const [selectedTeacher, setSelectedTeacher] = useState(teachers[0]?.name || 'Dr. Anoop Kumar');
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef(null);

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      toast.loading('Generating Official Ahalia PDF...', { id: 'pdf-toast' });

      const elementId = activeTab === 'class' ? 'official-timetable-export' : 'teacher-timetable-export';
      const element = document.getElementById(elementId);

      if (!element) {
        toast.error('Export element not found', { id: 'pdf-toast' });
        return;
      }

      // Dynamic import of html2pdf.js
      const html2pdf = (await import('html2pdf.js')).default;

      const filename =
        activeTab === 'class'
          ? `Ahalia_Timetable_${classTimetable?.className || 'Class'}.pdf`
          : `Ahalia_Teacher_Timetable_${selectedTeacher.replace(/\s+/g, '_')}.pdf`;

      const opt = {
        margin: [5, 5, 5, 5],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      await html2pdf().set(opt).from(element).save();
      toast.success('Official PDF exported successfully!', { id: 'pdf-toast' });
    } catch (err) {
      console.error('PDF Export error:', err);
      // Fallback to window print
      window.print();
      toast.success('Print dialog opened', { id: 'pdf-toast' });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📄 Official Ahalia Format Export"
      maxWidth="max-w-5xl"
    >
      <div className="space-y-4 font-sans text-xs">
        {/* Controls Toolbar */}
        <div className="flex items-center justify-between gap-4 p-3 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-sm flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('class')}
              className={`px-3 py-1.5 rounded-xs border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'class'
                  ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--accent)]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Class Timetable</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('teacher')}
              className={`px-3 py-1.5 rounded-xs border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'teacher'
                  ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--accent)]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Teacher Timetable</span>
            </button>
          </div>

          {activeTab === 'teacher' && teachers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--text-secondary)]">Select Faculty:</span>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="px-2 py-1 bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-xs text-xs font-semibold focus:outline-none focus:border-[var(--accent)]"
              >
                {teachers.map((t, idx) => (
                  <option key={idx} value={t.name || t}>
                    {t.name || t}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              leftIcon={<Printer className="w-3.5 h-3.5" />}
            >
              Print
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportPDF}
              loading={isExporting}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Download PDF (Ahalia Format)
            </Button>
          </div>
        </div>

        {/* Document Preview Box */}
        <div
          ref={containerRef}
          className="max-h-[70vh] overflow-y-auto custom-scrollbar p-4 bg-[#525659] border border-[var(--border)] rounded-sm shadow-inner flex justify-center"
        >
          {activeTab === 'class' ? (
            <OfficialTimetableExport
              classTimetable={classTimetable}
              className={classTimetable?.className}
            />
          ) : (
            <TeacherTimetableExport
              teacherName={selectedTeacher}
              timetableVersion={timetableVersion}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default OfficialExportModal;
