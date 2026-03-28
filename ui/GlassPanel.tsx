import React, { useState, useEffect } from 'react';
import './styles.scss';

// --- Type Definitions for Onyx UI System ---

interface GlassPanelProps {
  id: string;
  title: string;
  content: string;
  layerIndex: number; // For Z-Depth calculation
  isActive: boolean;
  onActivate: (id: string) => void;
}

/**
 * Onyx Glass Panel Component
 * Represents the fundamental building block of the Z-index layering system.
 * Uses hardware-accelerated CSS properties to ensure 144Hz smoothness.
 */
const GlassPanel: React.FC<GlassPanelProps> = ({
  id,
  title,
  content,
  layerIndex,
  isActive,
  onActivate
}) => {
  // Compute inline styles for the Z-Depth Tab Stacking
  const panelStyle: React.CSSProperties = {
    // translateZ provides the 3D depth, scale maintains visual consistency
    transform: isActive
      ? `translateZ(50px) scale(1)`
      : `translateZ(${-50 * layerIndex}px) scale(${1 - 0.05 * layerIndex})`,
    opacity: isActive ? 1 : Math.max(0.1, 1 - 0.2 * layerIndex),
    // Ensure the active panel is always on top within the deck
    zIndex: isActive ? 100 : 100 - layerIndex,
    // Smooth transition between states
    transition: 'transform 0.4s cubic-bezier(0.165, 0.84, 0.44, 1), opacity 0.3s ease-out'
  };

  return (
    <div
      className={`onyx-glass-panel ${isActive ? 'active' : ''}`}
      style={panelStyle}
      onClick={() => onActivate(id)}
      role="button"
      aria-pressed={isActive}
    >
      <h2 style={{ color: 'var(--color-text-silver-chrome)' }}>{title}</h2>
      <p style={{ color: 'var(--color-text-ghost-white)' }}>{content}</p>

      {/* Decorative inner edge to simulate physical glass thickness */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
        borderRadius: 'inherit',
        pointerEvents: 'none'
      }} />
    </div>
  );
};

/**
 * Onyx Glass Deck
 * Manages the Z-Depth Tab Stacking view.
 */
export const GlassDeck: React.FC = () => {
  // Simulate open tabs in the Onyx environment
  const [tabs, setTabs] = useState([
    { id: 'tab1', title: 'Chromium Engine Docs', content: 'V8 Isolate tuning parameters...' },
    { id: 'tab2', title: 'WebGL Shader Graph', content: 'Multi-pass Gaussian blur implementation...' },
    { id: 'tab3', title: 'Jules AI Core', content: 'Analyzing open tabs and generating summary.' }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab3');

  // Handle Tab Switching (Interaction Physics)
  const handleTabActivate = (id: string) => {
    setActiveTabId(id);
    // In a full implementation, this would trigger the Motion Blur effects
    // on tab transitions via the WebGL context.
  };

  // Re-order tabs based on active state for the Z-Depth visual
  // The active tab is layer 0, the next is layer 1, etc.
  const orderedTabs = [...tabs].sort((a, b) => {
    if (a.id === activeTabId) return -1;
    if (b.id === activeTabId) return 1;
    return 0; // Maintain original order for inactive tabs
  });

  return (
    <div className="onyx-glass-deck">
      {orderedTabs.map((tab, index) => (
        <GlassPanel
          key={tab.id}
          id={tab.id}
          title={tab.title}
          content={tab.content}
          layerIndex={index} // Determines position in the Z-stack
          isActive={tab.id === activeTabId}
          onActivate={handleTabActivate}
        />
      ))}

      {/* Ghost White Zen-Bar for Hyper-Focus context */}
      <div className="onyx-zen-bar" />
    </div>
  );
};

export default GlassDeck;