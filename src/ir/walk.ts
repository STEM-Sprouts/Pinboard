/**
 * Shared IR traversal used by pinMode inference and the diagnostics engine.
 */
import type { ExpressionIR, StatementIR } from './types';

export function walkStatements(statements: StatementIR[], visit: (stmt: StatementIR) => void): void {
  for (const stmt of statements) {
    visit(stmt);
    switch (stmt.kind) {
      case 'if':
        walkStatements(stmt.then, visit);
        if (stmt.else) walkStatements(stmt.else, visit);
        break;
      case 'repeat':
      case 'while':
      case 'forRange':
        walkStatements(stmt.body, visit);
        break;
      default:
        break;
    }
  }
}

/** Visits every expression reachable from one statement (not its children). */
export function walkExpressions(stmt: StatementIR, visit: (expr: ExpressionIR) => void): void {
  const visitExpr = (expr: ExpressionIR): void => {
    visit(expr);
    switch (expr.kind) {
      case 'unary':
        visitExpr(expr.arg);
        break;
      case 'binary':
        visitExpr(expr.left);
        visitExpr(expr.right);
        break;
      case 'call':
        for (const arg of expr.args) visitExpr(arg);
        break;
      default:
        break;
    }
  };

  switch (stmt.kind) {
    case 'declare':
      if (stmt.initial) visitExpr(stmt.initial);
      break;
    case 'assign':
      visitExpr(stmt.value);
      break;
    case 'change':
      visitExpr(stmt.delta);
      break;
    case 'digitalWrite':
    case 'analogWrite':
      visitExpr(stmt.value);
      break;
    case 'delay':
      visitExpr(stmt.ms);
      break;
    case 'delayMicroseconds':
      visitExpr(stmt.us);
      break;
    case 'serialPrint':
      visitExpr(stmt.value);
      break;
    case 'tone':
      visitExpr(stmt.frequency);
      if (stmt.durationMs) visitExpr(stmt.durationMs);
      break;
    case 'servoWrite':
      visitExpr(stmt.angle);
      break;
    case 'if':
      visitExpr(stmt.condition);
      break;
    case 'repeat':
      visitExpr(stmt.times);
      break;
    case 'while':
      visitExpr(stmt.condition);
      break;
    case 'forRange':
      visitExpr(stmt.from);
      visitExpr(stmt.to);
      visitExpr(stmt.step);
      break;
    default:
      break;
  }
}
