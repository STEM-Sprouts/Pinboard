import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header';
import BlocklyWorkspace from './components/BlocklyWorkspace';
import SimulationPanel from './components/SimulationPanel';
import CodePreview from './components/CodePreview';
import { lowerWorkspaceToIR, type BlocklyWorkspaceJson } from './editor/lowerBlocklyToIR';
import { starterComponents, starterWorkspaceJson } from './editor/starterProject';
import { printArduino } from './arduino/printArduino';
import { RuntimeScheduler } from './runtime/scheduler';
import { createBrowserSchedulerDeps } from './runtime/browserDeps';
import { arduinoUno } from './hardware/boards/arduinoUno';
import { analyzeComponentDiagnostics, analyzeProgramDiagnostics } from './hardware/diagnostics';
import {
  buttonUsesPullup,
  createComponent,
  signalPin,
  type PlaceableComponentType,
} from './hardware/components';
import type { DiagnosticFixAction, PinId } from './hardware/types';
import { setRegisteredComponents } from './blocks/componentRegistry';
import { LocalProjectStore } from './persistence/localProjectStore';
import { buildToolbox } from './blocks/toolbox';
import {
  createLocalProject,
  type ComponentInstance,
  type EditorMode,
  type PinboardProjectDocument,
} from './persistence/projectDocument';
import { exportFileName, exportProjectJson, importProjectJson } from './persistence/importExport';
import LessonPanel from './components/LessonPanel';
import ConflictDialog from './components/ConflictDialog';
import { lessons } from './lessons/lessons';
import { evaluateAllChecks } from './lessons/checks';
import { getSupabase } from './supabase/client';
import { getUser, onAuthChange, type AuthUser } from './supabase/auth';
import {
  fetchCloudProject,
  saveProjectToCloud,
  supabaseProjectPort,
} from './supabase/projectRepository';

const MAX_SERIAL_LINES = 500;
const AUTOSAVE_DEBOUNCE_MS = 750;
const DEFAULT_POT_VALUE = 512;

function App({ localId }: { localId?: string } = {}) {
  const [store] = useState(() => new LocalProjectStore(window.localStorage));

  // Local-first: open the routed project (an unknown id starts a fresh
  // starter under that id), else restore the last-opened project, else start
  // on Blink with hardware pre-added — never a blank canvas
  // (persistence.md §3, lessons.md §3).
  const [loadedProject, setLoadedProject] = useState<PinboardProjectDocument>(
    () =>
      (localId ? store.load(localId) : store.loadLastOpened()) ??
      createLocalProject(
        localId ?? crypto.randomUUID(),
        starterWorkspaceJson,
        new Date().toISOString(),
        'My Pinboard Project',
        starterComponents,
      ),
  );
  const [workspaceNonce, setWorkspaceNonce] = useState(0);
  const [workspaceJson, setWorkspaceJson] = useState<BlocklyWorkspaceJson>(
    () => loadedProject.workspace.data as BlocklyWorkspaceJson,
  );
  const [components, setComponents] = useState<ComponentInstance[]>(() => loadedProject.hardware.components);
  const projectRef = useRef(loadedProject);

  const [emulatorStatus, setEmulatorStatus] = useState<'idle' | 'compiling' | 'running' | 'error'>('idle');
  const [pinStates, setPinStates] = useState<Record<string, boolean>>({});
  const [toneStates, setToneStates] = useState<Record<string, number | null>>({});
  const [servoAngles, setServoAngles] = useState<Record<string, number>>({});
  const [buttonPressed, setButtonPressed] = useState<Record<string, boolean>>({});
  const [potValues, setPotValues] = useState<Record<string, number>>({});
  const [serialOutput, setSerialOutput] = useState<string[]>([]);
  const [saveNote, setSaveNote] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(
    () => loadedProject.settings?.editorMode ?? 'beginner',
  );
  // Mode filters what the toolbox OFFERS only — never the loaded workspace
  // (persistence.md §2).
  const toolbox = useMemo(() => buildToolbox(editorMode), [editorMode]);
  const [lessonOpen, setLessonOpen] = useState(false);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(
    () => loadedProject.lessons?.lessonId ?? null,
  );
  const [checkResults, setCheckResults] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(false);

  // --- cloud sync (ADR-0006: local is authoritative; cloud is an add-on) ---
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(
    () => loadedProject.metadata.cloudProjectId ?? null,
  );
  const [conflict, setConflict] = useState<{ document: PinboardProjectDocument | null; hash: string } | null>(null);
  const lastSyncedHashRef = useRef<string | undefined>(undefined);
  const conflictOpenRef = useRef(false);

  useEffect(() => {
    void getUser().then(setUser);
    return onAuthChange(setUser);
  }, []);

  const schedulerRef = useRef<RuntimeScheduler | null>(null);
  const unsubscribersRef = useRef<Array<() => void>>([]);

  // The component-block dropdowns read from this registry lazily.
  useEffect(() => {
    setRegisteredComponents(components);
  }, [components]);

  // Blocks → IR → C: the preview and the simulator share this one IR (ADR-0003).
  const lowered = useMemo(() => lowerWorkspaceToIR(workspaceJson, components), [workspaceJson, components]);
  const printed = useMemo(() => printArduino(lowered.program), [lowered]);
  const diagnostics = useMemo(
    () => [
      ...lowered.diagnostics,
      ...printed.diagnostics,
      ...analyzeProgramDiagnostics(lowered.program, arduinoUno),
      ...analyzeComponentDiagnostics(lowered.program, components),
    ],
    [lowered, printed, components],
  );

  const detachRuntimeListeners = () => {
    for (const unsubscribe of unsubscribersRef.current) unsubscribe();
    unsubscribersRef.current = [];
  };

  const currentDocument = useCallback((): PinboardProjectDocument => {
    return {
      ...projectRef.current,
      workspace: { format: 'blockly-json', data: workspaceJson },
      hardware: { components, wiring: [] },
      lessons: {
        lessonId: activeLessonId ?? undefined,
        completedChecks: Object.entries(checkResults)
          .filter(([, passed]) => passed)
          .map(([id]) => id),
      },
      settings: { ...projectRef.current.settings, editorMode },
      metadata: {
        ...projectRef.current.metadata,
        cloudProjectId: cloudProjectId ?? undefined,
        updatedAt: new Date().toISOString(),
      },
    };
  }, [workspaceJson, components, activeLessonId, checkResults, editorMode, cloudProjectId]);

  /** Push to the cloud row `cloudId`. A failed cloud write never touches
   * local work; a hash mismatch with our last sync opens the conflict
   * prompt instead of writing (persistence.md §4). */
  const syncToCloud = useCallback(
    async (doc: PinboardProjectDocument, cloudId: string, force = false) => {
      const client = getSupabase();
      if (!client || !user || conflictOpenRef.current) return;
      const port = supabaseProjectPort(client);
      if (!force) {
        const probe = await fetchCloudProject(port, cloudId);
        if (!probe.ok) {
          setSaveNote('Cloud save failed — your local save is safe');
          return;
        }
        if (probe.exists && lastSyncedHashRef.current !== undefined && probe.hash !== lastSyncedHashRef.current) {
          conflictOpenRef.current = true;
          setConflict({ document: probe.document, hash: probe.hash });
          return;
        }
      }
      const result = await saveProjectToCloud(port, doc, user.id, force ? undefined : lastSyncedHashRef.current, cloudId);
      if (result.status === 'error') {
        setSaveNote('Cloud save failed — your local save is safe');
      } else {
        lastSyncedHashRef.current = result.hash;
        if (result.status === 'saved') setSaveNote('Saved locally + cloud');
      }
    },
    [user],
  );

  // Debounced autosave; a failure warns and points to export, never crashes.
  useEffect(() => {
    const timer = setTimeout(() => {
      const updated = currentDocument();
      projectRef.current = updated;
      const result = store.save(updated);
      setSaveNote(result.ok ? 'Saved locally' : 'Save failed — export your work!');
      // Cloud only after a successful local save, and only once promoted.
      if (result.ok && cloudProjectId) void syncToCloud(updated, cloudProjectId);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [currentDocument, store, cloudProjectId, syncToCloud]);

  /** The promotion ask (supabase.md §1): nothing uploads until the student
   * chooses "Save to my account". */
  const handleSaveToCloud = useCallback(() => {
    const id = projectRef.current.metadata.id;
    setCloudProjectId(id); // autosave picks it up and performs the first sync
    setSaveNote('Saving to your account…');
  }, []);

  const resolveConflictKeepLocal = useCallback(() => {
    conflictOpenRef.current = false;
    setConflict(null);
    if (cloudProjectId) void syncToCloud(currentDocument(), cloudProjectId, true);
  }, [cloudProjectId, syncToCloud, currentDocument]);

  const resolveConflictUseCloud = useCallback(() => {
    conflictOpenRef.current = false;
    const incoming = conflict;
    setConflict(null);
    if (!incoming?.document) return;
    schedulerRef.current?.stop();
    projectRef.current = incoming.document;
    lastSyncedHashRef.current = incoming.hash;
    setLoadedProject(incoming.document);
    setWorkspaceJson(incoming.document.workspace.data as BlocklyWorkspaceJson);
    setComponents(incoming.document.hardware.components);
    setActiveLessonId(incoming.document.lessons?.lessonId ?? null);
    setEditorMode(incoming.document.settings?.editorMode ?? 'beginner');
    setCheckResults({});
    setWorkspaceNonce((nonce) => nonce + 1);
    setSaveNote('Loaded the cloud copy');
  }, [conflict]);

  const resolveConflictDuplicate = useCallback(() => {
    conflictOpenRef.current = false;
    setConflict(null);
    const duplicateId = crypto.randomUUID();
    lastSyncedHashRef.current = undefined;
    setCloudProjectId(duplicateId); // future syncs write the new row
    void syncToCloud(currentDocument(), duplicateId, true);
  }, [syncToCloud, currentDocument]);

  const handleRun = useCallback(() => {
    schedulerRef.current?.stop();
    detachRuntimeListeners();
    setPinStates({});
    setToneStates({});
    setServoAngles({});
    setSerialOutput([]);

    const scheduler = new RuntimeScheduler(createBrowserSchedulerDeps(), { board: arduinoUno });
    schedulerRef.current = scheduler;

    // Seed inputs from the current panel state before the program starts.
    for (const instance of components) {
      const pin = signalPin(instance);
      if (!pin) continue;
      if (instance.type === 'potentiometer') {
        scheduler.ctx.pins.setExternalAnalog(pin, potValues[instance.id] ?? DEFAULT_POT_VALUE);
      }
      if (instance.type === 'button' && buttonPressed[instance.id]) {
        scheduler.ctx.pins.setExternalDigital(pin, buttonUsesPullup(instance) ? false : true);
      }
    }

    unsubscribersRef.current.push(
      scheduler.ctx.pins.onChange((event) => {
        if (event.kind === 'digital') {
          setPinStates((prev) => ({ ...prev, [event.pin]: event.value as boolean }));
        } else if (event.kind === 'tone') {
          setToneStates((prev) => ({ ...prev, [event.pin]: event.value as number | null }));
        } else if (event.kind === 'servo') {
          setServoAngles((prev) => ({ ...prev, [event.pin]: event.value as number }));
        }
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
  }, [lowered, components, potValues, buttonPressed]);

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
    setToneStates({});
    setServoAngles({});
    setSerialOutput([]);
  }, []);

  // --- hardware panel ---

  const handleAddComponent = useCallback((type: PlaceableComponentType) => {
    setComponents((prev) => [...prev, createComponent(type, crypto.randomUUID(), prev, arduinoUno)]);
  }, []);

  const handleRemoveComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleSetComponentPin = useCallback((id: string, pin: PinId | null) => {
    setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, pins: { ...c.pins, signal: pin } } : c)));
  }, []);

  const handleApplyFix = useCallback((action: DiagnosticFixAction) => {
    if (action.kind === 'setComponentPin') {
      setComponents((prev) =>
        prev.map((c) => (c.id === action.componentId ? { ...c, pins: { ...c.pins, signal: action.pin } } : c)),
      );
    }
  }, []);

  const handleSetLedActiveHigh = useCallback((id: string, activeHigh: boolean) => {
    setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, config: { ...c.config, activeHigh } } : c)));
  }, []);

  const handleButtonPress = useCallback((instance: ComponentInstance, pressed: boolean) => {
    setButtonPressed((prev) => ({ ...prev, [instance.id]: pressed }));
    const pin = signalPin(instance);
    if (!pin) return;
    // The virtual button drives the pin electrically: with a pull-up the
    // line idles HIGH and pressing pulls it LOW (real Arduino semantics).
    const pressedLevel = buttonUsesPullup(instance) ? false : true;
    schedulerRef.current?.ctx.pins.setExternalDigital(pin, pressed ? pressedLevel : undefined);
  }, []);

  const handlePotChange = useCallback((instance: ComponentInstance, value: number) => {
    setPotValues((prev) => ({ ...prev, [instance.id]: value }));
    const pin = signalPin(instance);
    if (pin) schedulerRef.current?.ctx.pins.setExternalAnalog(pin, value);
  }, []);

  // --- lessons ---

  const handleSelectLesson = useCallback((id: string | null) => {
    setActiveLessonId(id);
    setCheckResults({});
  }, []);

  const handleCheckWork = useCallback(() => {
    const active = lessons.find((lesson) => lesson.id === activeLessonId);
    if (!active) return;
    setChecking(true);
    void evaluateAllChecks(active.checks, { document: currentDocument(), program: lowered.program })
      .then(setCheckResults)
      .finally(() => setChecking(false));
  }, [activeLessonId, currentDocument, lowered]);

  // --- project I/O ---

  const handleWorkspaceChange = useCallback((json: BlocklyWorkspaceJson) => {
    setWorkspaceJson(json);
  }, []);

  const handleBlockSelection = useCallback((blockId: string | null) => {
    setSelectedBlockId(blockId);
  }, []);

  // Selected block → its printed lines, via the printer's source map.
  const highlightRange = useMemo(
    () => (selectedBlockId ? (printed.sourceMap.blockIdToLineRange[selectedBlockId] ?? null) : null),
    [selectedBlockId, printed],
  );

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
      setComponents(result.document.hardware.components);
      setButtonPressed({});
      setPotValues({});
      setActiveLessonId(result.document.lessons?.lessonId ?? null);
      setEditorMode(result.document.settings?.editorMode ?? 'beginner');
      setCheckResults({});
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
        editorMode={editorMode}
        onEditorModeChange={setEditorMode}
        canPromoteToCloud={user !== null && cloudProjectId === null}
        onSaveToCloud={handleSaveToCloud}
        onRun={handleRun}
        onStop={handleStop}
        onReset={handleReset}
        onExport={handleExport}
        onImportFile={handleImportFile}
        onToggleLessons={() => setLessonOpen((open) => !open)}
      />

      <div className="flex flex-1 overflow-hidden">
        {lessonOpen && (
          <div className="w-80 shrink-0 min-h-0">
            <LessonPanel
              lessons={lessons}
              activeLessonId={activeLessonId}
              checkResults={checkResults}
              checking={checking}
              onSelectLesson={handleSelectLesson}
              onCheckWork={handleCheckWork}
              onClose={() => setLessonOpen(false)}
            />
          </div>
        )}
        <div className="flex-[2] flex border-r-2 border-ink relative min-w-0 min-h-0 overflow-hidden">
          <BlocklyWorkspace
            key={`${loadedProject.metadata.id}:${workspaceNonce}`}
            initialWorkspace={loadedProject.workspace.data as BlocklyWorkspaceJson}
            toolbox={toolbox}
            onWorkspaceChange={handleWorkspaceChange}
            onSelectionChange={handleBlockSelection}
          />
        </div>

        <div className="w-[340px] flex-shrink-0 bg-surface flex flex-col overflow-y-auto">
          <SimulationPanel
            board={arduinoUno}
            editorMode={editorMode}
            components={components}
            pinStates={pinStates}
            toneStates={toneStates}
            servoAngles={servoAngles}
            buttonPressed={buttonPressed}
            potValues={potValues}
            serialOutput={serialOutput}
            diagnostics={diagnostics}
            onAddComponent={handleAddComponent}
            onRemoveComponent={handleRemoveComponent}
            onSetComponentPin={handleSetComponentPin}
            onSetLedActiveHigh={handleSetLedActiveHigh}
            onButtonPress={handleButtonPress}
            onPotChange={handlePotChange}
            onApplyFix={handleApplyFix}
          />
        </div>
      </div>

      <div className="h-56 bg-surface z-10 w-full">
        <CodePreview code={printed.code} highlight={highlightRange} />
      </div>

      {conflict && (
        <ConflictDialog
          onKeepLocal={resolveConflictKeepLocal}
          onUseCloud={resolveConflictUseCloud}
          onDuplicate={resolveConflictDuplicate}
        />
      )}
    </div>
  );
}

export default App;
