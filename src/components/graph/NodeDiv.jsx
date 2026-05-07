import React from 'react';

export function NodeDiv({ nodeKey, nodeEls, style, className, children }) {
  return (
    <div ref={el => { nodeEls.current[nodeKey] = el; }} style={style} className={className}>
      {children}
    </div>
  );
}
