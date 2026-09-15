import type { ReactElement } from 'react';
import type { Scene } from '../../../domain/Scene';
import { categoryKind } from '../../../domain/Scene';
import type { NodeSpec } from '../../../layout/types';
import { categoryItems, FactBlock } from '../facts/FactBlock';
import { CategoryNode } from './CategoryNode';
import { CenterNode } from './CenterNode';
import { SpotlightNode } from './SpotlightNode';

export interface NodeHandlers {
  onCategoryClick: (index: number) => void;
  onCenterImageClick: () => void;
  onSpotlightClick?: () => void;
}

interface NodeContentProps extends NodeHandlers {
  node: NodeSpec;
  scene: Scene;
  focusedCat: number | null;
  /** Offscreen measurement pass: identical metrics, no image fetches. */
  measuring?: boolean;
}

/**
 * The one place that maps a node spec to React content. The measurement
 * probe and the live stage both render through here so measured and
 * rendered heights cannot drift apart.
 */
export function NodeContent({
  node,
  scene,
  focusedCat,
  measuring = false,
  onCategoryClick,
  onCenterImageClick,
  onSpotlightClick,
}: NodeContentProps): ReactElement | null {
  switch (node.kind) {
    case 'center':
      return (
        <CenterNode
          title={scene.title}
          subtitle={scene.subtitle}
          imageUrl={scene.image_url}
          imageQuery={scene.image_query}
          onImageClick={onCenterImageClick}
        />
      );
    case 'spotlight':
      return scene.spotlight ? (
        <SpotlightNode spotlight={scene.spotlight} color={node.color} onClick={onSpotlightClick} />
      ) : null;
    case 'category': {
      const cat = scene.graph[node.catIndex];
      if (!cat) return null;
      return (
        <CategoryNode
          color={node.color}
          label={cat.category}
          headline={cat.headline}
          kind={categoryKind(cat)}
          imageQuery={measuring ? undefined : cat.image_query}
          factCount={categoryItems(cat).length}
          focused={focusedCat === node.catIndex}
          onClick={() => onCategoryClick(node.catIndex)}
        />
      );
    }
    case 'fact': {
      const cat = scene.graph[node.catIndex];
      return cat ? <FactBlock category={cat} variant="graph" color={node.color} itemIndex={node.factIndex} /> : null;
    }
    case 'block': {
      const cat = scene.graph[node.catIndex];
      return cat ? <FactBlock category={cat} variant="graph" color={node.color} /> : null;
    }
  }
}
