import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as En from 'blockly/msg/en';
import { defineBlocks } from '../blocks/definitions';
import { arduinoGenerator, defineGenerators } from '../blocks/generators';

Blockly.setLocale(En as unknown as Parameters<typeof Blockly.setLocale>[0]);
defineBlocks();
defineGenerators();

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
        { kind: 'block', type: 'if_do' }
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
  onCodeChange: (code: string) => void;
}

export default function BlocklyWorkspace({ onCodeChange }: BlocklyWorkspaceProps) {
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

    const generateCode = () => {
      arduinoGenerator.init(workspace);
      const blocks = workspace.getTopBlocks(true);
      
      let setupCode = '';
      let loopCode = '';
      
      // We pass through all top blocks. For our paradigm, auto-add to either loop or setup.
      blocks.forEach(block => {
        if (block.type === 'arduino_setup') {
          setupCode += arduinoGenerator.statementToCode(block, 'DO');
        } else if (block.type === 'arduino_loop') {
          loopCode += arduinoGenerator.statementToCode(block, 'DO');
        } else {
          // If a block is placed outside setup/loop, you could append to loop or just ignore.
          // For now, let's treat top-level orphan blocks as living in `loop()`.
          const code = arduinoGenerator.blockToCode(block);
          if (typeof code === 'string') {
            loopCode += code;
          }
        }
      });
      
      const setupKeys = Object.keys(arduinoGenerator.setupCode_);
      const setupList = setupKeys.map(k => arduinoGenerator.setupCode_[k]);
      
      const finalSetup = setupList.map(l => '  ' + l).join('\n') + (setupCode ? '\n' + setupCode : '');
      const fullCode = `void setup() {\n${finalSetup}\n}\n\nvoid loop() {\n${loopCode}}\n`;
      onCodeChange(fullCode);
    };

    workspace.addChangeListener((e) => {
      if (e.isUiEvent || e.type === Blockly.Events.FINISHED_LOADING) return;
      generateCode();
    });

    generateCode();

    const onResize = () => Blockly.svgResize(workspace);
    window.addEventListener('resize', onResize);
    // Initial resize to ensure layout catches up
    setTimeout(onResize, 100);

    return () => {
      window.removeEventListener('resize', onResize);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [onCodeChange]);

  return (
    <div className="flex-1 min-w-0 min-h-0 relative w-full h-full">
      <div ref={blocklyDiv} className="absolute inset-0" />
    </div>
  );
}
