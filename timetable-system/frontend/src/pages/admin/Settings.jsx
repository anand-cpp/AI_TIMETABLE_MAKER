import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Tabs from '../../components/ui/Tabs';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Breadcrumb from '../../components/ui/Breadcrumb';
import CollegeInfoForm from '../../components/settings/CollegeInfoForm';
import WorkingDaysForm from '../../components/settings/WorkingDaysForm';
import PeriodTimeline from '../../components/settings/PeriodTimeline';
import EmailConfigForm from '../../components/settings/EmailConfigForm';
import settingsService from '../../services/settingsService';
import emailService from '../../services/emailService';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import {
  Building2,
  Calendar,
  Clock,
  Mail,
  RotateCcw,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { cn } from '../../utils/cn';

const TAB_ORDER = ['college', 'days', 'timeline', 'email'];

const Settings = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('college');
  const [settings, setSettings] = useState(null);
  const [emailConfig, setEmailConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [savedTabKeys, setSavedTabKeys] = useState([]);
  const [finishModalOpen, setFinishModalOpen] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [settingsRes, emailRes] = await Promise.all([
        settingsService.get(),
        emailService.getConfig(),
      ]);
      const s = settingsRes.data.settings;
      const e = emailRes.data.config;
      setSettings(s);
      setEmailConfig(e);

      // Populate completed tabs
      const completed = [];
      if (s?.collegeName) completed.push('college');
      if (s?.workingDays?.length) completed.push('days');
      if (s?.periodTimeline?.length) completed.push('timeline');
      if (e?.isConfigured) completed.push('email');
      setSavedTabKeys(completed);
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const advanceTab = (currentKey) => {
    const idx = TAB_ORDER.indexOf(currentKey);
    if (idx !== -1 && idx < TAB_ORDER.length - 1) {
      setActiveTab(TAB_ORDER[idx + 1]);
    }
  };

  const retreatTab = (currentKey) => {
    const idx = TAB_ORDER.indexOf(currentKey);
    if (idx > 0) {
      setActiveTab(TAB_ORDER[idx - 1]);
    }
  };

  const handleSave = async (data, nextRequested = false) => {
    try {
      setSaving(true);
      const res = await settingsService.update(data);
      setSettings(res.data.settings);
      toast.success('Settings saved successfully');
      setSavedTabKeys((prev) => [...new Set([...prev, activeTab])]);

      if (nextRequested) {
        advanceTab(activeTab);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleEmailSave = async (data, nextRequested = false, finishRequested = false) => {
    try {
      setSaving(true);
      const res = await emailService.updateConfig(data);
      setEmailConfig(res.data.config);
      toast.success('Email configuration saved');
      setSavedTabKeys((prev) => [...new Set([...prev, 'email'])]);

      if (finishRequested) {
        setFinishModalOpen(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save email config');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setResetLoading(true);
      const res = await settingsService.reset();
      setSettings(res.data.settings);
      toast.success('Settings reset to defaults');
    } catch {
      toast.error('Failed to reset settings');
    } finally {
      setResetLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const currentStepIndex = TAB_ORDER.indexOf(activeTab);

  const tabs = [
    {
      key: 'college',
      label: 'College Info',
      icon: Building2,
      content: (
        <Card>
          <Card.Header>
            <Card.Title>College Information</Card.Title>
            <Card.Description>
              Basic college details and teaching constraints (Step 1 of 4)
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <CollegeInfoForm
              settings={settings}
              onSubmit={handleSave}
              loading={saving}
            />
          </Card.Content>
        </Card>
      ),
    },
    {
      key: 'days',
      label: 'Working Days',
      icon: Calendar,
      content: (
        <Card>
          <Card.Header>
            <Card.Title>Working Days</Card.Title>
            <Card.Description>
              Configure operational days for the college (Step 2 of 4)
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <WorkingDaysForm
              settings={settings}
              onSubmit={handleSave}
              onPrevious={() => retreatTab('days')}
              loading={saving}
            />
          </Card.Content>
        </Card>
      ),
    },
    {
      key: 'timeline',
      label: 'Period Timeline',
      icon: Clock,
      content: (
        <div className="space-y-6 font-sans">
          <Card>
            <Card.Header>
              <Card.Title>Main Period Timeline</Card.Title>
              <Card.Description>
                Configure standard period start & end times (Step 3 of 4)
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <PeriodTimeline
                settings={settings}
                onSubmit={handleSave}
                onPrevious={() => retreatTab('timeline')}
                loading={saving}
                isFriday={false}
              />
            </Card.Content>
          </Card>

          {settings?.fridaySeparate && (
            <Card>
              <Card.Header>
                <Card.Title>Friday Timeline</Card.Title>
                <Card.Description>
                  Separate period schedule for Fridays
                </Card.Description>
              </Card.Header>
              <Card.Content>
                <PeriodTimeline
                  settings={settings}
                  onSubmit={handleSave}
                  onPrevious={() => retreatTab('timeline')}
                  loading={saving}
                  isFriday={true}
                />
              </Card.Content>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email / SMTP',
      icon: Mail,
      content: (
        <Card>
          <Card.Header>
            <Card.Title>Email Configuration</Card.Title>
            <Card.Description>
              SMTP settings for automated timetable email distribution (Step 4 of 4)
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <EmailConfigForm
              config={emailConfig}
              onSubmit={handleEmailSave}
              onPrevious={() => retreatTab('email')}
              loading={saving}
            />
          </Card.Content>
        </Card>
      ),
    },
  ];

  return (
    <ErrorBoundary>
      <div className="space-y-6 max-w-5xl mx-auto pb-12 font-sans">
        <Breadcrumb items={[{ label: 'Settings' }]} />

        <PageHeader
          title="College Settings"
          description="Configure college parameters, operational days, period timing, and SMTP email settings"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              loading={resetLoading}
              leftIcon={<RotateCcw className="w-4 h-4" strokeWidth={1.5} />}
            >
              Reset to Defaults
            </Button>
          }
        />

        {/* SETUP PROGRESS INDICATOR */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-sans font-semibold uppercase tracking-widest text-[var(--accent)]">
                SETUP PROGRESS
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                · Step {currentStepIndex + 1} of 4
              </span>
            </div>
            <p className="text-xs font-sans text-[var(--text-muted)] mt-0.5">
              {savedTabKeys.length} of 4 settings steps configured
            </p>
          </div>

          {/* Step Circles */}
          <div className="flex items-center gap-3">
            {tabs.map((tab, idx) => {
              const isSaved = savedTabKeys.includes(tab.key);
              const isCurrent = activeTab === tab.key;
              return (
                <div key={tab.key} className="flex items-center gap-2">
                  <div
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'w-7 h-7 rounded-full font-mono text-xs font-bold flex items-center justify-center border cursor-pointer transition-colors shrink-0',
                      isSaved && 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--accent)]',
                      isCurrent && !isSaved && 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] ring-2 ring-[var(--accent)]/30',
                      !isSaved && !isCurrent && 'bg-[var(--bg-surface-alt)] text-[var(--text-muted)] border-[var(--border)]'
                    )}
                    title={tab.label}
                  >
                    {isSaved ? '✓' : idx + 1}
                  </div>
                  {idx < 3 && <div className="w-4 h-[1px] bg-[var(--border)] hidden sm:block" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(key) => setActiveTab(key)}
        />

        {/* Finish Setup Success Modal */}
        <Modal
          isOpen={finishModalOpen}
          onClose={() => setFinishModalOpen(false)}
          title="🎉 Settings Configured Successfully!"
          size="md"
        >
          <div className="space-y-5 font-sans py-2">
            <div className="p-4 bg-[var(--accent-soft)] border border-[var(--border)] rounded-sm flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-[var(--accent)] shrink-0 mt-0.5" strokeWidth={1.5} />
              <div className="space-y-1">
                <h4 className="font-serif text-lg font-normal text-[var(--text-primary)]">
                  All 4 Configuration Steps Complete
                </h4>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Your college information, working days, period timing, and SMTP email preferences are saved and verified.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setFinishModalOpen(false)}
              >
                Close
              </Button>
              <Button
                onClick={() => navigate('/admin/dashboard')}
                leftIcon={<Zap className="w-4 h-4" strokeWidth={1.5} />}
              >
                Go to Dashboard →
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </ErrorBoundary>
  );
};

export default Settings;