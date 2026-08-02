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

      <div className="p-4 bg-gray-50 rounded-lg">
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

      <div className="form-group">
        <label className="form-label">
          SMTP Password / App Password <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            placeholder={config?.isConfigured ? '••••••••' : 'Enter app password'}
            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            {...register('pass')}
          />
          <button
            type="button"
            onClick={() => setShowPass((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="form-hint">
          For Gmail: use an App Password (Google Account → Security → App Passwords)
        </p>
      </div>

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