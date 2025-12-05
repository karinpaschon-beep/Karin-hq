
import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Button
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild = false, children, ...props }, ref) => {
    const variants = {
      primary: 'bg-primary text-white hover:bg-blue-600 shadow-sm',
      secondary: 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 shadow-sm',
      outline: 'bg-transparent border border-slate-300 hover:bg-slate-50 text-slate-700',
      ghost: 'bg-transparent hover:bg-slate-100 text-slate-700',
      danger: 'bg-danger text-white hover:bg-red-600 shadow-sm',
    };
    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 py-2',
      lg: 'h-12 px-6 text-lg',
      icon: 'h-9 w-9 p-0 flex items-center justify-center',
    };

    const compClassName = cn(
      'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-white',
      variants[variant],
      sizes[size],
      className
    );

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement, {
        className: cn(compClassName, (children.props as any).className),
        ...props
      });
    }

    return (
      <button
        ref={ref}
        className={compClassName}
        {...props}
      >
        {children}
      </button>
    );
  }
);

// Card
export const Card: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className, children }) => (
  <div className={cn('bg-white rounded-lg border border-slate-200 shadow-sm', className)}>
    {children}
  </div>
);

// Input
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);

// Textarea
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);

// Badge
export const Badge: React.FC<{ className?: string, variant?: 'default'|'success'|'warning'|'secondary', children?: React.ReactNode }> = ({ className, variant = 'default', children }) => {
    const variants = {
        default: 'bg-primary/10 text-primary hover:bg-primary/20',
        success: 'bg-green-100 text-green-700 hover:bg-green-200',
        warning: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
        secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    }
    return (
        <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent", variants[variant], className)}>
            {children}
        </div>
    )
}

// Select (Simple Wrapper)
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
    ({ className, ...props }, ref) => (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none',
            className
          )}
          {...props}
        />
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
            <svg className="h-4 w-4 fill-current text-slate-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
        </div>
      </div>
    )
  );

// Dialog (Modal) - Simplified for no external deps
export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children?: React.ReactNode; size?: 'sm'|'md'|'lg' }> = ({ isOpen, onClose, title, children, size = 'md' }) => {
    if (!isOpen) return null;
    const sizes = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-3xl'
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={cn("relative w-full bg-white rounded-lg shadow-lg p-6 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]", sizes[size])}>
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div className="overflow-y-auto flex-1">
                    {children}
                </div>
            </div>
        </div>
    )
}
