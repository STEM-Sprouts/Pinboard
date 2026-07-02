import * as Blockly from 'blockly/core';

// This file defines an Arduino generator which uses standard string building.
// Blockly 11+ removed `var generator = new Blockly.Generator('Arduino')`.
// Instead, we can build the C code manually or use an existing generator as a base.

export class ArduinoGenerator extends Blockly.Generator {
  setupCode_: Record<string, string> = {};
  ORDER_ATOMIC = 0;
  ORDER_NONE = 99;

  constructor() {
    super('Arduino');
    
    // Formatting options
    this.INDENT = '  ';
  }
  
  init(_workspace: Blockly.Workspace) {
    this.setupCode_ = {};
  }

  finish(code: string) {
    // Collect all setup code
    const setupKeys = Object.keys(this.setupCode_);
    const setupList = setupKeys.map(key => this.setupCode_[key]);

    const setupString = 'void setup() {\n' +
      setupList.map(line => this.INDENT + line).join('\n') +
      '\n}\n\n';

    const loopString = 'void loop() {\n' +
      code +
      '\n}\n';
      
    // Remove blank setup if it's empty but user might have placed a setup block
    return setupString + loopString;
  }
  
  scrub_(block: Blockly.Block, code: string, opt_thisOnly?: boolean): string {
    const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
    const nextCode = opt_thisOnly ? '' : this.blockToCode(nextBlock);
    return code + nextCode;
  }
}

export const arduinoGenerator = new ArduinoGenerator();

export const defineGenerators = () => {
  arduinoGenerator.forBlock['arduino_setup'] = function(block: Blockly.Block) {
    const branch = arduinoGenerator.statementToCode(block, 'DO');
    // We override setup from finish() if explicitly provided
    arduinoGenerator.setupCode_['user_setup'] = branch;
    return ''; // Setup doesn't directly return inline code in loop
  };

  arduinoGenerator.forBlock['arduino_loop'] = function(block: Blockly.Block) {
    const branch = arduinoGenerator.statementToCode(block, 'DO');
    return branch; // We just let it spit out code which `finish` wraps in loop() unless we want a separate paradigm
  };

  arduinoGenerator.forBlock['set_pin'] = function(block: Blockly.Block) {
    const pin = block.getFieldValue('PIN');
    const state = block.getFieldValue('STATE');
    arduinoGenerator.setupCode_[`pinMode_${pin}`] = `pinMode(${pin}, OUTPUT);`;
    return `digitalWrite(${pin}, ${state});\n`;
  };

  arduinoGenerator.forBlock['read_pin'] = function(block: Blockly.Block) {
    const pin = block.getFieldValue('PIN');
    arduinoGenerator.setupCode_[`pinMode_${pin}`] = `pinMode(${pin}, INPUT_PULLUP);`;
    return [`digitalRead(${pin})`, arduinoGenerator.ORDER_ATOMIC];
  };

  arduinoGenerator.forBlock['delay_ms'] = function(block: Blockly.Block) {
    const delay = block.getFieldValue('DELAY');
    return `delay(${delay});\n`;
  };

  arduinoGenerator.forBlock['repeat_times'] = function(block: Blockly.Block) {
    const times = block.getFieldValue('TIMES');
    const branch = arduinoGenerator.statementToCode(block, 'DO');
    const loopVar = Blockly.utils.idGenerator.genUid().replace(/[^a-zA-Z0-9]/g, 'i');
    return `for (int ${loopVar} = 0; ${loopVar} < ${times}; ${loopVar}++) {\n${branch}}\n`;
  };

  arduinoGenerator.forBlock['if_do'] = function(block: Blockly.Block) {
    const condition = arduinoGenerator.valueToCode(block, 'CONDITION', arduinoGenerator.ORDER_NONE) || 'false';
    const branch = arduinoGenerator.statementToCode(block, 'DO');
    return `if (${condition}) {\n${branch}}\n`;
  };

  arduinoGenerator.forBlock['serial_print'] = function(block: Blockly.Block) {
    const value = arduinoGenerator.valueToCode(block, 'VALUE', arduinoGenerator.ORDER_NONE) || '""';
    arduinoGenerator.setupCode_['serial_begin'] = `Serial.begin(9600);`;
    return `Serial.println(${value});\n`;
  };

  arduinoGenerator.forBlock['string_text'] = function(block: Blockly.Block) {
    const text = block.getFieldValue('TEXT');
    // Escape quotes
    return [`"${text.replace(/"/g, '\\"')}"`, arduinoGenerator.ORDER_ATOMIC];
  };
};
