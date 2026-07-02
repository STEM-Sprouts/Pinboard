import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as En from 'blockly/msg/en';
import { defineBlocks } from '../blocks/definitions';
import type { BlocklyWorkspaceJson } from '../editor/lowerBlocklyToIR';

Blockly.setLocale(En as unknown as Parameters<typeof Blockly.setLocale>[0]);
defineBlocks();

const TOOLBOX_CONFIG = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Structure',
      colour: '#FFAB19',
      contents: [
        { kind: 'block', type: 'arduino_setup' },
        { kind: 'block', type: 'arduino_loop' }
      ]
    },
    {
      kind: 'category',
      name: 'Components',
      colour: '#9966FF',
      contents: [
        { kind: 'block', type: 'led_set' },
        { kind: 'block', type: 'button_is_pressed' },
        { kind: 'block', type: 'pot_read' }
      ]
    },
    {
      kind: 'category',
      name: 'Pins',
      colour: '#4C97FF',
      contents: [
        { kind: 'block', type: 'set_pin' },
        { kind: 'block', type: 'read_pin' }
      ]
    },
    {
      kind: 'category',
      name: 'Control',
      colour: '#FFBF00',
      contents: [
        { kind: 'block', type: 'delay_ms' },
        { kind: 'block', type: 'repeat_times' }
      ]
    },
    {
      kind: 'category',
      name: 'Logic',
      colour: '#59C059',
      contents: [
        { kind: 'block', type: 'if_do' },
        { kind: 'block', type: 'if_else' },
        { kind: 'block', type: 'compare_op' },
        { kind: 'block', type: 'logic_andor' },
        { kind: 'block', type: 'not_op' },
        { kind: 'block', type: 'wait_until' }
      ]
    },
    {
      kind: 'category',
      name: 'Math',
      colour: '#59A869',
      contents: [
        { kind: 'block', type: 'num_value' },
        { kind: 'block', type: 'math_arith' },
        { kind: 'block', type: 'random_range' },
        { kind: 'block', type: 'map_range' }
      ]
    },
    {
      kind: 'category',
      name: 'Variables',
      colour: '#FF8C1A',
      contents: [
        { kind: 'block', type: 'var_set' },
        { kind: 'block', type: 'var_change' },
        { kind: 'block', type: 'var_get' }
      ]
    },
    {
      kind: 'category',
      name: 'Time',
      colour: '#FFBF00',
      contents: [
        { kind: 'block', type: 'delay_ms' },
        { kind: 'block', type: 'millis_now' }
      ]
    },
    {
      kind: 'category',
      name: 'Serial',
      colour: '#5CB1D6',
      contents: [
        { kind: 'block', type: 'serial_print' },
        { kind: 'block', type: 'string_text' }
      ]
    }
  ]
};

interface BlocklyWorkspaceProps {
  /** Loaded once at mount; keep the reference stable across renders. */
  initialWorkspace: BlocklyWorkspaceJson;
  onWorkspaceChange: (json: BlocklyWorkspaceJson) => void;
  /** Fires with the selected block id (null on deselect); keep the reference stable. */
  onSelectionChange?: (blockId: string | null) => void;
}

export default function BlocklyWorkspace({
  initialWorkspace,
  onWorkspaceChange,
  onSelectionChange,
}: BlocklyWorkspaceProps) {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);

  useEffect(() => {
    if (!blocklyDiv.current || workspaceRef.current) return;

    const workspace = Blockly.inject(blocklyDiv.current, {
      toolbox: TOOLBOX_CONFIG,
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

  return (
    <div className="flex-1 min-w-0 min-h-0 relative w-full h-full">
      <div ref={blocklyDiv} className="absolute inset-0" />
    </div>
  );
}
