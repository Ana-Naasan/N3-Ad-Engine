import { getMicLevel, isMicAvailable } from '../mic.js';

export default function mic() {
  return (signals) => {
    signals.micLevel = getMicLevel();
    signals.micAvailable = signals.micLevel !== null && isMicAvailable();
  };
}
