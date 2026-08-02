import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Tabs from '../../components/ui/Tabs';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import CollegeInfoForm from '../../components/settings/CollegeInfoForm';
import WorkingDaysForm from '../../components/settings/WorkingDaysForm';
import PeriodTimeline from '../../components/settings/PeriodTimeline';
import EmailConfigForm from '../../components/settings/EmailConfigForm';
import settingsService from '../../services/settingsService';
import emailService from '../../services/emailService';
import Spinner from '../../components/ui/Spinner';
import {
  Building2,
  Calendar,
  Clock,
  Mail,
  RotateCcw,
} from 'lucide-react';

const Settings = () => {
  const [settings, setSettings] = useState(null);
  const [emailConfig, setEmailConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [settingsRes, emailRes] = await Promise.all([
        settingsService.get(),
        emailService.getConfig(),
      ]);
      setSettings(settingsRes.data.settings);
      setEmailConfig(emailRes.data.config);
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    try {
      setSaving(true);
      const res = await settingsService.update(data);
      setSettings(res.data.settings);
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
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

  const handleEmailSave = async (data) => {
    try {
      setSaving(true);
      const res = await emailService.updateConfig(data);
      setEmailConfig(res.data.config);
      toast.success('Email configuration saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save email config');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

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
              Basic college details and teaching constraints
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
              Configure which days the college is operational
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <WorkingDaysForm
              settings={settings}
              onSubmit={handleSave}
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
        <div className="space-y-6">
          <Card>
            <Card.Header>
              <Card.Title>Main Period Timeline</Card.Title>
              <Card.Description>
                Mon–Thu schedule (and Fri if not using separate Friday timeline)
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <PeriodTimeline
                settings={settings}
                onSubmit={handleSave}
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
              SMTP settings for sending timetable emails to teachers, HODs and class reps
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <EmailConfigForm
              config={emailConfig}
              onSubmit={handleEmailSave}
              loading={saving}
            />
          </Card.Content>
        </Card>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure college, schedule, and system settings"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            loading={resetLoading}
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            Reset to Defaults
          </Button>
        }
      />

      <Tabs tabs={tabs} defaultTab="college" />
    </div>
  );
};

export default Settings;