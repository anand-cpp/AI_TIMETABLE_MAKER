import { cn } from '../../utils/cn';

const Card = ({ children, className, padding = true, hover = true, ...props }) => {
  return (
    <div
      className={cn(
        'bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-6 transition-colors duration-150',
        hover && 'hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)]',
        !padding && 'p-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const CardHeader = ({ children, className }) => (
  <div className={cn('mb-4 space-y-1', className)}>{children}</div>
);

const CardTitle = ({ children, className }) => (
  <h3 className={cn('text-xl font-serif font-normal text-[var(--text-primary)] tracking-tight', className)}>
    {children}
  </h3>
);

const CardDescription = ({ children, className }) => (
  <p className={cn('text-xs font-sans text-[var(--text-secondary)] leading-relaxed', className)}>
    {children}
  </p>
);

const CardContent = ({ children, className }) => (
  <div className={cn(className)}>{children}</div>
);

const CardFooter = ({ children, className }) => (
  <div className={cn('mt-6 pt-4 border-t border-[var(--border)]', className)}>
    {children}
  </div>
);

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Content = CardContent;
Card.Footer = CardFooter;

export default Card;