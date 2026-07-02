import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as En from 'blockly/msg/en';
import { defineBlocks } from '../blocks/definitions';
import type { ToolboxConfig } from '../blocks/toolbox';
import type { BlocklyWorkspaceJson } from '../editor/lowerBlocklyToIR';

Blockly.setLocale(En as unknown as Parameters<typeof Blockly.setLocale>[0]);
defineBlocks();

interface BlocklyWorkspaceProps {
  /** Loaded once at mount; keep the reference stable across renders. */
  initialWorkspace: BlocklyWorkspaceJson;
  /** Editor-mode-filtered toolbox (persistence.md §2). Changing it updates
   * the toolbox only — the loaded workspace is never touched. */
  toolbox: ToolboxConfig;
  onWorkspaceChange: (json: BlocklyWorkspaceJson) => void;
  /** Fires with the selected block id (null on deselect); keep the reference stable. */
  onSelectionChange?: (blockId: string | null) => void;
}

export default function BlocklyWorkspace({
  initialWorkspace,
  toolbox,
  onWorkspaceChange,
  onSelectionChange,
}: BlocklyWorkspaceProps) {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const initialToolboxRef = useRef(toolbox);

  useEffect(() => {
    if (!blocklyDiv.current || workspaceRef.current) return;

    const workspace = Blockly.inject(blocklyDiv.current, {
      toolbox: initialToolboxRef.current,
      theme: Blockly.Themes.Classic,
      trashcan: true,
      move: { scrollbars: true, drag: true, wheel: true }
    });
    workspaceRef.current = workspace;

    try {
      Blockly.serialization.workspaces.load(initialWorkspace as object, workspace);
    } catch (error) {
      console.warn('Failed to load initial workspace; starting empty.', error);
    }

    const emit = () => {
      onWorkspaceChange(Blockly.serialization.workspaces.save(workspace) as BlocklyWorkspaceJson);
    };

    workspace.addChangeListener((e) => {
      if (e.type === Blockly.Events.SELECTED) {
        const selected = e as Blockly.Events.Selected;
        onSelectionChange?.(selected.newElementId ?? null);
        return;
      }
      if (e.isUiEvent || e.type === Blockly.Events.FINISHED_LOADING) return;
      emit();
    });

    emit();

    const onResize = () => Blockly.svgResize(workspace);
    window.addEventListener('resize', onResize);
    // Initial resize to ensure layout catches up
    setTimeout(onResize, 100);

    return () => {
      window.removeEventListener('resize', onResize);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [initialWorkspace, onWorkspaceChange, onSelectionChange]);

  // Editor mode changes swap the toolbox in place; the workspace and its
  // loaded blocks are never reloaded or mutated (persistence.md §2).
  useEffect(() => {
    workspaceRef.current?.updateToolbox(toolbox);
  }, [toolbox]);

  return (
    <div className="flex-1 min-w-0 min-h-0 relative w-full h-full">
      <div ref={blocklyDiv} className="absolute inset-0" />
    </div>
  );
}
