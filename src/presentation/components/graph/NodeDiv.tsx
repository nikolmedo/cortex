import { type MutableRefObject } from 'react';

interface NodeDivProps {
  nodeKey: string;
  nodeEls: MutableRefObject<Record<string, HTMLDivElement | null>>;
  style?: React.CSSProperties;
  className?: string;
  children: React.ReactNode;
}

export function NodeDiv({ nodeKey, nodeEls, style, className, children }: NodeDivProps) {
  return (
    <div ref={el => { nodeEls.current[nodeKey] = el; }} style={style} className={className}>
      {children}
    </div>
  );
}
