declare module 'react-d3-graph' {
  export interface GraphData {
    nodes: Node[];
    links: Link[];
  }

  export interface Node {
    id: string;
    name?: string;
    symbolType?: string;
    size?: number;
    color?: string;
  }

  export interface Link {
    source: string;
    target: string;
    value?: number;
  }

  export interface GraphConfig {
    nodeHighlightBehavior?: boolean;
    node?: {
      color?: string;
      size?: number;
      highlightStrokeColor?: string;
      highlightStrokeWidth?: number;
    };
    link?: {
      highlightColor?: string;
      semanticStrokeWidth?: boolean;
      strokeWidth?: number;
    };
    directed?: boolean;
    collapsible?: boolean;
    d3?: {
      gravity?: number;
      linkLength?: number;
      linkStrength?: number;
      disableLinkForce?: boolean;
    };
  }

  export interface GraphProps {
    id: string;
    data: GraphData;
    config: GraphConfig;
  }

  export const Graph: React.FC<GraphProps>;
} 