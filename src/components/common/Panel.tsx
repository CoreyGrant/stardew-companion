import type { ReactNode } from 'react';

interface Props {
  title?: string;
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function Panel({ title, children, className, collapsible = false, defaultOpen = true }: Props) {
  if (collapsible) {
    return (
      <details className={`panel${className ? ` ${className}` : ''}`} open={defaultOpen}>
        {title && <summary className="panel__title">{title}</summary>}
        <div className="panel__body">{children}</div>
      </details>
    );
  }

  return (
    <div className={`panel${className ? ` ${className}` : ''}`}>
      {title && <h2 className="panel__title">{title}</h2>}
      <div className="panel__body">{children}</div>
    </div>
  );
}
