import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Toggle from '../../components/ui/Toggle';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import emailService from '../../services/emailService';
import timetableService from '../../services/timetableService';
import {
  Mail,
  Send,
  Users,
  GraduationCap,
  BookUser,
  CheckCircle,
  XCircle,
  SkipForward,
} from 'lucide-react';

const EmailManager = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(false);
  const [results, setResults] = useState(null);
  const [recipients, setRecipients] = useState({
    teachers: true,
    hods: true,
    classReps: true,
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [configRes] = await Promise.all([
          emailService.getConfig(),
        ]);
        setConfig(configRes.data.config);

        try {
          await timetableService.getAccepted();
          setHasAccepted(true);
        } catch {
          setHasAccepted(false);
        }
      } catch {
        toast.error('Failed to load email configuration');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSend = async () => {
    if (!hasAccepted) {
      toast.error('Accept a timetable first before sending emails');
      return;
    }
    if (!config?.isConfigured) {
      toast.error('Configure SMTP settings in Settings → Email first');
      return;
    }
    try {
      setSending(true);
      setResults(null);
      const res = await emailService.sendTimetableEmails(recipients);
      setResults(res.data.results);
      const { sent, failed, skipped } = res.data.results.summary;
      toast.success(`Emails processed: ${sent} sent, ${failed} failed, ${skipped} skipped`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send emails');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const StatusIcon = ({ status }) => {
    if (status === 'sent') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === 'failed') return <XCircle className="w-4 h-4 text-red-500" />;
    return <SkipForward className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div>
      <PageHeader
        title="Email Manager"
        description="Send timetable notifications to teachers, HODs and class representatives"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Send panel */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <Card.Header>
              <Card.Title>Send Timetable Emails</Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="space-y-4">
                {/* Status checks */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {config?.isConfigured
                      ? <CheckCircle className="w-4 h-4 text-green-500" />
                      : <XCircle className="w-4 h-4 text-red-400" />
                    }
                    <span className="text-sm text-gray-700">
                      SMTP {config?.isConfigured ? 'configured' : 'not configured'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasAccepted
                      ? <CheckCircle className="w-4 h-4 text-green-500" />
                      : <XCircle className="w-4 h-4 text-red-400" />
                    }
                    <span className="text-sm text-gray-700">
                      Timetable {hasAccepted ? 'published' : 'not published yet'}
                    </span>
                  </div>
                </div>

                {/* Recipients */}
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Send To
                  </p>
                  <Toggle
                    checked={recipients.teachers}
                    onChange={(v) => setRecipients((r) => ({ ...r, teachers: v }))}
                    label="Teachers"
                    description="Each teacher's personal schedule"
                  />
                  <Toggle
                    checked={recipients.hods}
                    onChange={(v) => setRecipients((r) => ({ ...r, hods: v }))}
                    label="HODs"
                    description="Class timetable to each HOD email"
                  />
                  <Toggle
                    checked={recipients.classReps}
                    onChange={(v) => setRecipients((r) => ({ ...r, classReps: v }))}
                    label="Class Representatives"
                    description="Class timetable to each class rep"
                  />
                </div>

                <Button
                  fullWidth
                  onClick={handleSend}
                  loading={sending}
                  disabled={!hasAccepted || !config?.isConfigured}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  {sending ? 'Sending...' : 'Send Emails'}
                </Button>

                {(!hasAccepted || !config?.isConfigured) && (
                  <p className="text-xs text-amber-600 text-center">
                    {!hasAccepted
                      ? 'Publish a timetable first'
                      : 'Configure SMTP in Settings first'}
                  </p>
                )}
              </div>
            </Card.Content>
          </Card>

          {/* SMTP info */}
          {config?.isConfigured && (
            <Card>
              <Card.Content>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Current SMTP
                </p>
                <p className="text-sm text-gray-700">{config.smtpConfig?.user}</p>
                <p className="text-xs text-gray-400">
                  {config.smtpConfig?.host}:{config.smtpConfig?.port}
                </p>
              </Card.Content>
            </Card>
          )}
        </div>

        {/* Results panel */}
        <div className="lg:col-span-2">
          {!results && !sending && (
            <Card className="h-full">
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Mail className="w-12 h-12 text-gray-200 mb-4" />
                <p className="text-gray-400 text-sm">
                  Email delivery results will appear here after sending
                </p>
              </div>
            </Card>
          )}

          {sending && (
            <Card className="h-full">
              <div className="flex flex-col items-center justify-center h-64">
                <Spinner size="lg" />
                <p className="mt-4 text-sm text-gray-500">Sending emails...</p>
                <p className="text-xs text-gray-400 mt-1">
                  SMTP failures for individual recipients won't stop the others
                </p>
              </div>
            </Card>
          )}

          {results && !sending && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Sent', value: results.summary.sent, color: 'bg-green-50 text-green-700 border-green-200' },
                  { label: 'Failed', value: results.summary.failed, color: 'bg-red-50 text-red-700 border-red-200' },
                  { label: 'Skipped', value: results.summary.skipped, color: 'bg-gray-50 text-gray-600 border-gray-200' },
                ].map((item) => (
                  <div key={item.label} className={`rounded-xl border p-4 text-center ${item.color}`}>
                    <p className="text-2xl font-bold">{item.value}</p>
                    <p className="text-sm font-medium">{item.label}</p>
                  </div>
                ))}
              </div>

              {/* Per-recipient results */}
              {[
                { key: 'teachers', label: 'Teachers', icon: Users },
                { key: 'hods', label: 'HODs', icon: BookUser },
                { key: 'classReps', label: 'Class Reps', icon: GraduationCap },
              ].map(({ key, label, icon: Icon }) => {
                const list = results[key] || [];
                if (list.length === 0) return null;
                return (
                  <Card key={key} padding={false}>
                    <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                      <Icon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">{label}</span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {list.filter((r) => r.status === 'sent').length}/{list.length} sent
                      </span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {list.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                          <StatusIcon status={item.status} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">
                              {item.name || item.class}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {item.email || item.reason || '—'}
                            </p>
                          </div>
                          <Badge
                            variant={
                              item.status === 'sent' ? 'success' :
                              item.status === 'failed' ? 'danger' : 'default'
                            }
                            size="sm"
                          >
                            {item.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailManager;