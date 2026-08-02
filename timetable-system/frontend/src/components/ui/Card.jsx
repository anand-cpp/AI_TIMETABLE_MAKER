import { cn } from '../../utils/cn';

const Card = ({ children, className, padding = true, hover = true, ...props }) => {
  return (
    <div
      className={cn(
        'glass-panel rounded-3xl p-6 transition-all duration-300',
        hover && 'hover:-translate-y-1',
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
  <div className={cn('mb-4 space-y-1.5', className)}>{children}</div>
);

const CardTitle = ({ children, className }) => (
  <h3 className={cn('text-xl font-display font-black text-[#0F172A] dark:text-white tracking-tight', className)}>
    {children}
  </h3>
);

const CardDescription = ({ children, className }) => (
  <p className={cn('text-xs font-semibold text-[#334155] dark:text-[#A0A0B0] leading-relaxed', className)}>
    {children}
  </p>
);

const CardContent = ({ children, className }) => (
  <div className={cn(className)}>{children}</div>
);

const CardFooter = ({ children, className }) => (
  <div className={cn('mt-6 pt-4 border-t border-[#CBD5E1] dark:border-white/10', className)}>
    {children}
  </div>
);

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Content = CardContent;
Card.Footer = CardFooter;

export default Card;