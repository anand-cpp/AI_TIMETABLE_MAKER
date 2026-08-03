import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Toggle from '../ui/Toggle';
import { Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import emailService from '../../services/emailService';
import toast from 'react-hot-toast';

const EmailConfigForm = ({ config, onSubmit, loading }) => {
  const [showPass, setShowPass] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      fromName: 'Timetable System',
      fromEmail: '',
    },
  });

  const secure = watch('secure');

  useEffect(() => {
    if (config?.smtpConfig) {
      const s = config.smtpConfig;
      reset({
        host: s.host || 'smtp.gmail.com',
        port: s.port || 587,
        secure: s.secure || false,
        user: s.user || '',
        pass: '',
        fromName: s.fromName || 'Timetable System',
        fromEmail: s.fromEmail || '',
      });
    }
  }, [config, reset]);

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      await emailService.testConfig();
      setTestResult('success');
      toast.success('SMTP connection verified!');
    } catch (err) {
      setTestResult('error');
      toast.error(err.response?.data?.message || 'SMTP test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleFormSubmit = (data) => {
    onSubmit({ smtpConfig: data });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="SMTP Host"
          required
          placeholder="smtp.gmail.com"
          error={errors.host?.message}
          {...register('host', { required: 'SMTP host is required' })}
        />
        <Input
          label="SMTP Port"
          type="number"
          required
          error={errors.port?.message}
          {...register('port', { required: 'Port is required' })}
        />
      </div>

      <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <Toggle
          checked={secure}
          onChange={(val) => setValue('secure', val)}
          label="Use SSL/TLS"
          description="Enable for port 465, disable for port 587 (STARTTLS)"
        />
      </div>

      <Input
        label="SMTP Username (Email)"
        type="email"
        required
        placeholder="your@gmail.com"
        error={errors.user?.message}
        {...register('user', {
          required: 'SMTP username is required',
          pattern: {
            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Invalid email',
          },
        })}
      />

      <Input
        label="SMTP Password / App Password"
        type={showPass ? 'text' : 'password'}
        required
        placeholder={config?.isConfigured ? '••••••••' : 'Enter app password'}
        hint="For Gmail: use an App Password (Google Account → Security → App Passwords)"
        error={errors.pass?.message}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPass((s) => !s)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
          >
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        }
        {...register('pass')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="From Name"
          placeholder="Timetable System"
          {...register('fromName')}
        />
        <Input
          label="From Email"
          type="email"
          placeholder="noreply@college.edu"
          error={errors.fromEmail?.message}
          {...register('fromEmail', {
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Invalid email',
            },
          })}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={loading}>
          Save SMTP Config
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleTest}
          loading={testing}
          disabled={!config?.isConfigured}
        >
          Test Connection
        </Button>
        {testResult === 'success' && (
          <div className="flex items-center gap-1 text-green-600 text-sm">
            <CheckCircle className="w-4 h-4" />
            Connected
          </div>
        )}
        {testResult === 'error' && (
          <div className="flex items-center gap-1 text-red-500 text-sm">
            <XCircle className="w-4 h-4" />
            Failed
          </div>
        )}
      </div>
    </form>
  );
};

export default EmailConfigForm;