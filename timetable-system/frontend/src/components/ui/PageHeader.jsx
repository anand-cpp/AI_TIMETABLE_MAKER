import { cn } from '../../utils/cn';

const PageHeader = ({
  title,
  description,
  action,
  backButton,
  className,
}) => {
  return (
    <div className={cn('mb-8', className)}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {backButton && <div>{backButton}</div>}
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[var(--text-primary)] tracking-tight">
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-sm font-sans font-normal text-[var(--text-secondary)]">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
};

export default PageHeader;