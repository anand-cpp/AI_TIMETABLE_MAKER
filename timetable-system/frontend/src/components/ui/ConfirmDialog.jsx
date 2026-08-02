import Modal from './Modal';
import Button from './Button';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

const icons = {
  danger: { Icon: AlertTriangle, color: 'text-red-500 bg-red-100' },
  warning: { Icon: AlertTriangle, color: 'text-yellow-500 bg-yellow-100' },
  info: { Icon: Info, color: 'text-blue-500 bg-blue-100' },
  success: { Icon: CheckCircle, color: 'text-green-500 bg-green-100' },
};

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}) => {
  const { Icon, color } = icons[variant] || icons.info;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showClose={false}>
      <div className="text-center">
        <div
          className={cn(
            'mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4',
            color
          )}
        >
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-display font-extrabold text-slate-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;