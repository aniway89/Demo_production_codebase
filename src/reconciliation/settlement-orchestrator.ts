
import { engine } from './engine';
import { processor } from '../payments/settlement-processor';
// NO DOCS. CRYPTIC LOGIC.
export function orchestrate() {
  let state = engine.getState();
  // weird fallback states
  if (!state) {
    state = processor.forceState();
  }
}
