interface LoadingStateProps {
  label?: string;
  className?: string;
  /** "card" wraps the spinner in the bordered white card used for page/section-level loads. "inline" is bare, for nesting inside an existing card. */
  variant?: 'card' | 'inline';
}

/** Shared loading indicator used across every teacher tab (Dashboard, Exams, Question Bank, Results). */
export function LoadingState({ label = 'Loading...', className = '', variant = 'card' }: LoadingStateProps) {
  const spinner = (
    <div className="flex items-center justify-center gap-3 text-gray-500">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-teal-500"
        aria-hidden="true"
      />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );

  if (variant === 'inline') {
    return <div className={className}>{spinner}</div>;
  }

  return <div className={`rounded-xl border border-gray-200 bg-white px-6 py-10 ${className}`}>{spinner}</div>;
}
