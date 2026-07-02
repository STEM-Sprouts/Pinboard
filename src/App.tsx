import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header';
import BlocklyWorkspace from './components/BlocklyWorkspace';
import SimulationPanel from './components/SimulationPanel';
import CodePreview from './components/CodePreview';
import { lowerWorkspaceToIR, type BlocklyWorkspaceJson } from './editor/lowerBlocklyToIR';
import { starterWorkspaceJson } from './editor/starterProject';
import { printArduino } from './arduino/printArduino';
import { RuntimeScheduler } from './runtime/scheduler';
import { createBrowserSchedulerDeps } from './runtime/browserDeps';
import { arduinoUno } from './hardware/boards/arduinoUno';
import { analyzeProgramDiagnostics } from './hardware/diagnostics';
import type { PinId } from './hardware/types';
import { LocalProjectStore } from './persistence/localProjectStore';
import { createLocalProject, type PinboardProjectDocument } from './persistence/projectDocument';
import { exportFileName, exportProjectJson, importProjectJson } from './persistence/importExport';

const MAX_SERIAL_LINES = 500;
const AUTOSAVE_DEBOUNCE_MS = 750;

function App() {
  const [store] = useState(() => new LocalProjectStore(window.localStorage));

  // Local-first: restore the last-opened project, else start on Blink —
  // never a blank canvas (persistence.md §3, lessons.md §3).
  const [loadedProject, setLoadedProject] = useState<PinboardProjectDocument>(
    () =>
      store.loadLastOpened() ??
      createLocalProject(crypto.randomUUID(), starterWorkspaceJson, new Date().toISOString()),
  );
  const [workspaceNonce, setWorkspaceNonce] = useState(0);
  const [workspaceJson, setWorkspaceJson] = useState<BlocklyWorkspaceJson>(
    () => loadedProject.workspace.data as BlocklyWorkspaceJson,
  );
  const projectRef = useRef(loadedProject);

  const [emulatorStatus, setEmulatorStatus] = useState<'idle' | 'compiling' | 'running' | 'error'>('idle');
  const [pinStates, setPinStates] = useState<Record<number, boolean>>({});
  const [serialOutput, setSerialOutput] = useState<string[]>([]);
  const [saveNote, setSaveNote] = useState('');

  const schedulerRef = useRef<RuntimeScheduler | null>(null);
  const unsubscribersRef = useRef<Array<() => void>>([]);

  // Blocks → IR → C: the preview and the simulator share this one IR (ADR-0003).
  const lowered = useMemo(() => lowerWorkspaceToIR(workspaceJson), [workspaceJson]);
  const printed = useMemo(() => printArduino(lowered.program), [lowered]);
  const diagnostics = useMemo(
    () => [...lowered.diagnostics, ...printed.diagnostics, ...analyzeProgramDiagnostics(lowered.program, arduinoUno)],
    [lowered, printed],
  );

  const detachRuntimeListeners = () => {
    for (const unsubscribe of unsubscribersRef.current) unsubscribe();
    unsubscribersRef.current = [];
  };

  const currentDocument = useCallback((): PinboardProjectDocument => {
    return {
      ...projectRef.current,
      workspace: { format: 'blockly-json', data: workspaceJson },
      metadata: { ...projectRef.current.metadata, updatedAt: new Date().toISOString() },
    };
  }, [workspaceJson]);

  // Debounced autosave; a failure warns and points to export, never crashes.
  useEffect(() => {
    const timer = setTimeout(() => {
      const updated = currentDocument();
      projectRef.current = updated;
      const result = store.save(updated);
      setSaveNote(result.ok ? 'Saved locally' : 'Save failed — export your work!');
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [currentDocument, store]);

  const handleRun = useCallback(() => {
    schedulerRef.current?.stop();
    detachRuntimeListeners();
    setPinStates({});
    setSerialOutput([]);

    const scheduler = new RuntimeScheduler(createBrowserSchedulerDeps(), { board: arduinoUno });
    schedulerRef.current = scheduler;

    unsubscribersRef.current.push(
      scheduler.ctx.pins.onChange((event) => {
        if (event.kind !== 'digital' || !event.pin.startsWith('D')) return;
        const pinNumber = Number(event.pin.slice(1));
        setPinStates((prev) => ({ ...prev, [pinNumber]: event.value as boolean }));
      }),
      scheduler.ctx.serial.onLine((line) => {
        setSerialOutput((prev) => {
          const next = [...prev, line];
          return next.length > MAX_SERIAL_LINES ? next.slice(-MAX_SERIAL_LINES) : next;
        });
      }),
    );

    setEmulatorStatus('running');
    void scheduler.run(lowered.program).then(() => {
      if (schedulerRef.current === scheduler) setEmulatorStatus('idle');
    });
  }, [lowered]);

  const handleStop = useCallback(() => {
    schedulerRef.current?.stop();
  }, []);

  const handleReset = useCallback(() => {
    schedulerRef.current?.stop();
    schedulerRef.current?.reset();
    detachRuntimeListeners();
    // Nulling the ref means the run promise's owner check no longer fires;
    // set idle explicitly so Reset always lands in a clean state.
    schedulerRef.current = null;
    setEmulatorStatus('idle');
    setPinStates({});
    setSerialOutput([]);
  }, []);

  const handleButtonPress = useCallback((pin: number, pressed: boolean) => {
    setPinStates((prev) => ({ ...prev, [pin]: pressed }));
    // The virtual button drives the pin electrically: with INPUT_PULLUP the
    // line idles HIGH and pressing pulls it LOW (real Arduino semantics).
    schedulerRef.current?.ctx.pins.setExternalDigital(`D${pin}` as PinId, pressed ? false : undefined);
  }, []);

  const handleWorkspaceChange = useCallback((json: BlocklyWorkspaceJson) => {
    setWorkspaceJson(json);
  }, []);

  const handleExport = useCallback(() => {
    const doc = currentDocument();
    const blob = new Blob([exportProjectJson(doc)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exportFileName(doc);
    anchor.click();
    URL.revokeObjectURL(url);
  }, [currentDocument]);

  const handleImportFile = useCallback((file: File) => {
    void file.text().then((text) => {
      const result = importProjectJson(text);
      if (!result.ok) {
        setSaveNote(`Import failed: ${result.error}`);
        return;
      }
      schedulerRef.current?.stop();
      projectRef.current = result.document;
      setLoadedProject(result.document);
      setWorkspaceJson(result.document.workspace.data as BlocklyWorkspaceJson);
      setWorkspaceNonce((nonce) => nonce + 1);
      setSaveNote('Project imported');
    });
  }, []);

  useEffect(() => {
    return () => {
      schedulerRef.current?.stop();
      detachRuntimeListeners();
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header
        status={emulatorStatus}
        saveNote={saveNote}
        onRun={handleRun}
        onStop={handleStop}
        onReset={handleReset}
        onExport={handleExport}
        onImportFile={handleImportFile}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-[2] flex border-r border-gray-200 relative min-w-0 min-h-0 overflow-hidden">
          <BlocklyWorkspace
            key={`${loadedProject.metadata.id}:${workspaceNonce}`}
            initialWorkspace={loadedProject.workspace.data as BlocklyWorkspaceJson}
            onWorkspaceChange={handleWorkspaceChange}
          />
        </div>

        <div className="w-[320px] flex-shrink-0 bg-surface flex flex-col border-r border-gray-200 overflow-y-auto">
          <SimulationPanel
            pinStates={pinStates}
            serialOutput={serialOutput}
            diagnostics={diagnostics}
            onButtonPress={handleButtonPress}
          />
        </div>
      </div>

      <div className="h-56 border-t border-gray-200 bg-surface shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 w-full">
        <CodePreview code={printed.code} />
      </div>
    </div>
  );
}

export default App;
