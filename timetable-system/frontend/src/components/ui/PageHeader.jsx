import { cn } from '../../utils/cn';

const PageHeader = ({
  title,
  description,
  action,
  backButton,
  className,
}) => {
  return (
    <div className={cn('mb-6', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {backButton && <div>{backButton}</div>}
          <div>
            <h1 className="text-2xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">{title}</h1>
            {description && (
              <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
};

export default PageHeader;