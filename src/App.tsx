import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Outlet, useOutletContext } from 'react-router-dom';
import {
  Download,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Play,
  RotateCcw,
  Square,
  Upload,
  AlertTriangle,
} from 'lucide-react';
import BlocklyWorkspace from './components/BlocklyWorkspace';
import SimulationPanel from './components/SimulationPanel';
import CodePreview from './components/CodePreview';
import Header from './components/Header';
import LessonPanel from './components/LessonPanel';
import ConflictDialog from './components/ConflictDialog';
import pinboardLogo from '../pinboard_logo.png';
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
import { lessons } from './lessons/lessons';
import { evaluateAllChecks } from './lessons/checks';
import { getSupabase, isCloudConfigured } from './supabase/client';
import {
  getUser,
  onAuthChange,
  signInWithGoogle,
  signInWithMagicLink,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  type AuthUser,
} from './supabase/auth';
import {
  fetchCloudProject,
  saveProjectToCloud,
  supabaseProjectPort,
} from './supabase/projectRepository';
import { usePreferences, type PinboardPreferences } from './app/usePreferences';

const MAX_SERIAL_LINES = 500;
const DEFAULT_POT_VALUE = 512;

export type EditorOutletContext = {
  loadedProject: PinboardProjectDocument;
  workspaceNonce: number;
  workspaceJson: BlocklyWorkspaceJson;
  toolbox: ReturnType<typeof buildToolbox>;
  components: ComponentInstance[];
  editorMode: EditorMode;
  emulatorStatus: 'idle' | 'compiling' | 'running' | 'error';
  saveNote: string;
  setWorkspaceJson: (json: BlocklyWorkspaceJson) => void;
  handleWorkspaceChange: (json: BlocklyWorkspaceJson) => void;
  handleBlockSelection: (blockId: string | null) => void;
  selectedBlockId: string | null;
  handleAddComponent: (type: PlaceableComponentType) => void;
  handleRemoveComponent: (id: string) => void;
  handleSetComponentPin: (id: string, pin: PinId | null) => void;
  handleSetLedActiveHigh: (id: string, activeHigh: boolean) => void;
  handleButtonPress: (instance: ComponentInstance, pressed: boolean) => void;
  handlePotChange: (instance: ComponentInstance, value: number) => void;
  handleApplyFix: (action: DiagnosticFixAction) => void;
  handleCheckWork: () => void;
  currentDocument: () => PinboardProjectDocument;
  lowered: ReturnType<typeof lowerWorkspaceToIR>;
  printed: ReturnType<typeof printArduino>;
  diagnostics: ReturnType<typeof analyzeProgramDiagnostics>;
  pinStates: Record<string, boolean>;
  toneStates: Record<string, number | null>;
  servoAngles: Record<string, number>;
  buttonPressed: Record<string, boolean>;
  potValues: Record<string, number>;
  serialOutput: string[];
  activeLessonId: string | null;
  setActiveLessonId: (id: string | null) => void;
  checkResults: Record<string, boolean>;
  checking: boolean;
  lessons: typeof lessons;
  canPromoteToCloud: boolean;
  onSaveToCloud: () => void;
  onRun: () => void;
  onStop: () => void;
  onReset: () => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  user: AuthUser | null;
  cloudProjectId: string | null;
  setCloudProjectId: (id: string | null) => void;
  setSaveNote: (note: string) => void;
  signIn: () => void;
  signOut: () => void;
  preferences: PinboardPreferences;
  setPreferences: (next: PinboardPreferences) => void;
  resetPreferences: () => void;
};

function App({ localId }: { localId?: string } = {}) {
  const [store] = useState(() => new LocalProjectStore(window.localStorage));
  const { preferences, setPreferences, resetPreferences } = usePreferences();
  const [loadedProject, setLoadedProject] = useState<PinboardProjectDocument>(
    () =>
      (localId ? store.load(localId) : store.loadLastOpened()) ??
      createLocalProject(
        localId ?? crypto.randomUUID(),
        starterWorkspaceJson,
        new Date().toISOString(),
        'My Pinboard Project',
        starterComponents,
        preferences.defaultEditorMode,
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
  const [editorMode, setEditorMode] = useState<EditorMode>(() => loadedProject.settings?.editorMode ?? preferences.defaultEditorMode);
  const toolbox = useMemo(() => buildToolbox(editorMode), [editorMode]);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(() => loadedProject.lessons?.lessonId ?? null);
  const [checkResults, setCheckResults] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(() => loadedProject.metadata.cloudProjectId ?? null);
  const [conflict, setConflict] = useState<{ document: PinboardProjectDocument | null; hash: string } | null>(null);
  const lastSyncedHashRef = useRef<string | undefined>(undefined);
  const conflictOpenRef = useRef(false);
  const schedulerRef = useRef<RuntimeScheduler | null>(null);
  const unsubscribersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    void getUser().then(setUser);
    return onAuthChange(setUser);
  }, []);

  useEffect(() => {
    setRegisteredComponents(components);
  }, [components]);

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
      if (result.status === 'error') setSaveNote('Cloud save failed — your local save is safe');
      else {
        lastSyncedHashRef.current = result.hash;
        if (result.status === 'saved') setSaveNote('Saved locally + cloud');
      }
    },
    [user],
  );

  useEffect(() => {
    if (!preferences.autosaveEnabled) return;
    const timer = setTimeout(() => {
      const updated = currentDocument();
      projectRef.current = updated;
      const result = store.save(updated);
      setSaveNote(result.ok ? 'Saved locally' : 'Save failed — export your work!');
      if (result.ok && cloudProjectId) void syncToCloud(updated, cloudProjectId);
    }, preferences.autosaveDebounceMs);
    return () => clearTimeout(timer);
  }, [currentDocument, store, cloudProjectId, syncToCloud, preferences.autosaveEnabled, preferences.autosaveDebounceMs]);

  const handleSaveToCloud = useCallback(() => {
    const id = projectRef.current.metadata.id;
    setCloudProjectId(id);
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
    setCloudProjectId(duplicateId);
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

    for (const instance of components) {
      const pin = signalPin(instance);
      if (!pin) continue;
      if (instance.type === 'potentiometer') scheduler.ctx.pins.setExternalAnalog(pin, potValues[instance.id] ?? DEFAULT_POT_VALUE);
      if (instance.type === 'button' && buttonPressed[instance.id]) {
        scheduler.ctx.pins.setExternalDigital(pin, buttonUsesPullup(instance) ? false : true);
      }
    }

    unsubscribersRef.current.push(
      scheduler.ctx.pins.onChange((event) => {
        if (event.kind === 'digital') setPinStates((prev) => ({ ...prev, [event.pin]: event.value as boolean }));
        else if (event.kind === 'tone') setToneStates((prev) => ({ ...prev, [event.pin]: event.value as number | null }));
        else if (event.kind === 'servo') setServoAngles((prev) => ({ ...prev, [event.pin]: event.value as number }));
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
    schedulerRef.current = null;
    setEmulatorStatus('idle');
    setPinStates({});
    setToneStates({});
    setServoAngles({});
    setSerialOutput([]);
  }, []);

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
    const pressedLevel = buttonUsesPullup(instance) ? false : true;
    schedulerRef.current?.ctx.pins.setExternalDigital(pin, pressed ? pressedLevel : undefined);
  }, []);

  const handlePotChange = useCallback((instance: ComponentInstance, value: number) => {
    setPotValues((prev) => ({ ...prev, [instance.id]: value }));
    const pin = signalPin(instance);
    if (pin) schedulerRef.current?.ctx.pins.setExternalAnalog(pin, value);
  }, []);

  const handleCheckWork = useCallback(() => {
    const active = lessons.find((lesson) => lesson.id === activeLessonId);
    if (!active) return;
    setChecking(true);
    void evaluateAllChecks(active.checks, { document: currentDocument(), program: lowered.program })
      .then(setCheckResults)
      .finally(() => setChecking(false));
  }, [activeLessonId, currentDocument, lowered]);

  const handleWorkspaceChange = useCallback((json: BlocklyWorkspaceJson) => {
    setWorkspaceJson(json);
  }, []);

  const handleBlockSelection = useCallback((blockId: string | null) => {
    setSelectedBlockId(blockId);
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

  const outletContext: EditorOutletContext = {
    loadedProject,
    workspaceNonce,
    workspaceJson,
    toolbox,
    components,
    editorMode,
    emulatorStatus,
    saveNote,
    setWorkspaceJson,
    handleWorkspaceChange,
    handleBlockSelection,
    selectedBlockId,
    handleAddComponent,
    handleRemoveComponent,
    handleSetComponentPin,
    handleSetLedActiveHigh,
    handleButtonPress,
    handlePotChange,
    handleApplyFix,
    handleCheckWork,
    currentDocument,
    lowered,
    printed,
    diagnostics,
    pinStates,
    toneStates,
    servoAngles,
    buttonPressed,
    potValues,
    serialOutput,
    activeLessonId,
    setActiveLessonId,
    checkResults,
    checking,
    lessons,
    canPromoteToCloud: user !== null && cloudProjectId === null,
    onSaveToCloud: handleSaveToCloud,
    onRun: handleRun,
    onStop: handleStop,
    onReset: handleReset,
    onExport: handleExport,
    onImportFile: handleImportFile,
    user,
    cloudProjectId,
    setCloudProjectId,
    setSaveNote,
    signIn: () => void signInWithGoogle(),
    signOut: () => void signOut(),
    preferences,
    setPreferences,
    resetPreferences,
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header
        editorBasePath={localId ? `/editor/${localId}` : '/editor/new'}
        editorMode={editorMode}
        onEditorModeChange={setEditorMode}
      />

      <div className="flex-1 min-h-0 overflow-hidden">
        <Outlet context={outletContext} />
      </div>

      <BottomActionBar
        status={emulatorStatus}
        saveNote={saveNote}
        onRun={handleRun}
        onStop={handleStop}
        onReset={handleReset}
        onExport={handleExport}
        onImportFile={handleImportFile}
      />

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

function BottomActionBar({
  status,
  saveNote,
  onRun,
  onStop,
  onReset,
  onExport,
  onImportFile,
}: {
  status: 'idle' | 'compiling' | 'running' | 'error';
  saveNote: string;
  onRun: () => void;
  onStop: () => void;
  onReset: () => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <footer className="h-16 bg-surface border-t-2 border-ink flex items-center justify-between px-4 gap-3 z-10">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center text-sm font-semibold border-2 border-ink bg-surface px-3 py-1 rounded-full shrink-0">
          <span
            className={`w-2.5 h-2.5 rounded-full mr-2 ${
              status === 'running' ? 'bg-primary animate-pulse' : status === 'error' ? 'bg-red-500' : 'bg-gray-400'
            }`}
          />
          <span data-testid="emulator-status" className="capitalize text-ink">{status}</span>
        </div>
        <span data-testid="save-note" className="text-xs font-medium text-gray-500 truncate">{saveNote}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <button onClick={onRun} disabled={status === 'running' || status === 'compiling'} className="ss-btn ss-btn-primary px-4 py-1.5 text-sm">
          <Play size={16} /> Run
        </button>
        <button onClick={onStop} disabled={status !== 'running'} className="ss-btn px-4 py-1.5 text-sm bg-red-100 hover:bg-red-200">
          <Square size={16} /> Stop
        </button>
        <button onClick={onReset} className="ss-btn ss-btn-ghost px-3 py-1.5 text-sm" title="Reset simulation">
          <RotateCcw size={16} />
        </button>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => fileInputRef.current?.click()} className="ss-btn ss-btn-ghost px-3 py-1.5 text-sm">
          <Upload size={15} /> Import
        </button>
        <input
          ref={fileInputRef}
          data-testid="import-input"
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportFile(file);
            e.target.value = '';
          }}
        />
        <button onClick={onExport} className="ss-btn ss-btn-ghost px-3 py-1.5 text-sm">
          <Download size={15} /> Export
        </button>
      </div>
    </footer>
  );
}

export function EditorBuildPage() {
  const ctx = useOutletContext<EditorOutletContext>();
  const highlightRange = ctx.selectedBlockId ? (ctx.printed.sourceMap.blockIdToLineRange[ctx.selectedBlockId] ?? null) : null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-[2] flex border-r-2 border-ink relative min-w-0 min-h-0 overflow-hidden">
          <BlocklyWorkspace
            key={`${ctx.loadedProject.metadata.id}:${ctx.workspaceNonce}`}
            initialWorkspace={ctx.loadedProject.workspace.data as BlocklyWorkspaceJson}
            toolbox={ctx.toolbox}
            onWorkspaceChange={ctx.handleWorkspaceChange}
            onSelectionChange={ctx.handleBlockSelection}
          />
        </div>
        <div className="w-[340px] flex-shrink-0 bg-surface flex flex-col overflow-y-auto">
          <SimulationPanel
            board={arduinoUno}
            editorMode={ctx.editorMode}
            components={ctx.components}
            pinStates={ctx.pinStates}
            toneStates={ctx.toneStates}
            servoAngles={ctx.servoAngles}
            buttonPressed={ctx.buttonPressed}
            potValues={ctx.potValues}
            serialOutput={ctx.serialOutput}
            diagnostics={ctx.diagnostics}
            onAddComponent={ctx.handleAddComponent}
            onRemoveComponent={ctx.handleRemoveComponent}
            onSetComponentPin={ctx.handleSetComponentPin}
            onSetLedActiveHigh={ctx.handleSetLedActiveHigh}
            onButtonPress={ctx.handleButtonPress}
            onPotChange={ctx.handlePotChange}
            onApplyFix={ctx.handleApplyFix}
          />
        </div>
      </div>
      <div className="h-56 bg-surface z-10 w-full border-t-2 border-ink">
        <CodePreview code={ctx.printed.code} highlight={highlightRange} fontSize={ctx.preferences.codePreviewFontSize} />
      </div>
    </div>
  );
}

export function EditorLessonsPage() {
  const ctx = useOutletContext<EditorOutletContext>();
  return (
    <div className="h-full min-h-0 flex flex-col">
      <LessonPanel
        lessons={ctx.lessons}
        activeLessonId={ctx.activeLessonId}
        checkResults={ctx.checkResults}
        checking={ctx.checking}
        onSelectLesson={ctx.setActiveLessonId}
        onCheckWork={ctx.handleCheckWork}
      />
    </div>
  );
}

export function EditorAccountPage() {
  const ctx = useOutletContext<EditorOutletContext>();
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const isConfigured = isCloudConfigured();
  const supportsDelete = false;
  const isDangerConfirmed = deleteConfirm.trim().toLowerCase() === (ctx.user?.email ?? '').toLowerCase();
  const actionButton = 'ss-btn ss-btn-primary w-full px-4 py-3 text-sm shadow-[4px_4px_0_#111]';
  const ghostButton = 'ss-btn ss-btn-ghost w-full px-4 py-3 text-sm shadow-[3px_3px_0_#111]';
  const GoogleIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 33 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.2-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.4 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.4 4 24 4 16.2 4 9.5 8.4 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.3 0 10-2 13.6-5.2l-6.3-5.3C29.3 35 26.8 36 24 36c-5.3 0-9.7-3-12-7.4l-6.6 5.1C8.5 39.6 15.8 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3-3.2 5.4-6 6.8l.1-.1 6.3 5.3C34.9 38.5 40 34 40 24c0-1.3-.1-2.2-.4-3.5z"/>
    </svg>
  );

  const dangerMail = `mailto:support@stemsprouts.org?subject=${encodeURIComponent('Pinboard account deletion request')}&body=${encodeURIComponent(
    `Please delete my Pinboard account for ${ctx.user?.email ?? ''}. Cloud projects should be deleted; local browser projects should remain untouched.`,
  )}`;

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 md:p-8">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="ss-card overflow-hidden bg-[radial-gradient(circle_at_top_left,_#eef8ef_0%,_#ffffff_48%,_#f8f6ef_100%)]">
          <div className="p-6 md:p-8 lg:p-10">
            <div className="inline-flex items-center gap-3 rounded-full border-2 border-ink bg-white px-3 py-2 shadow-[3px_3px_0_#111]">
              <img src={pinboardLogo} alt="Pinboard" className="h-10 w-auto object-contain" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-[0.16em]">Account</span>
            </div>
            <h2 className="mt-6 text-4xl font-bold text-ink leading-[0.95] max-w-md">
              Who you are, separate from how Pinboard behaves.
            </h2>
            <p className="mt-4 max-w-lg text-sm md:text-base text-gray-600 leading-7">
              Sign in to sync projects across devices. Your work is saved in this browser either way.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="ss-card bg-white p-4 shadow-[3px_3px_0_#111]">
                <div className="text-sm font-bold text-ink">Signed out</div>
                <div className="mt-2 text-xs leading-5 text-gray-600">
                  You can keep building locally without an account.
                </div>
              </div>
              <div className="ss-card bg-white p-4 shadow-[3px_3px_0_#111]">
                <div className="text-sm font-bold text-ink">Signed in</div>
                <div className="mt-2 text-xs leading-5 text-gray-600">
                  Your cloud projects stay tied to your account across devices.
                </div>
              </div>
            </div>

            {!isConfigured && (
              <div className="mt-6 rounded-2xl border-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Cloud sync is not configured here, so the editor stays local-only.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="ss-card bg-white p-5 md:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Identity</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <h3 className="text-2xl font-bold text-ink">{ctx.user ? 'Your account' : 'Sign in'}</h3>
              <span className="rounded-full border-2 border-ink bg-primary px-3 py-1 text-[11px] font-bold text-ink shadow-[2px_2px_0_#111]">
                Local-first
              </span>
            </div>

            {!ctx.user ? (
              <div className="mt-5 space-y-4">
                <button
                  data-testid="sign-in"
                  onClick={() => {
                    void signInWithGoogle().then(({ error }) => {
                      if (error) {
                        const next = 'Google sign-in unavailable — your work stays saved locally.';
                        setNote(next);
                        ctx.setSaveNote(next);
                      } else {
                        const next = 'Opening Google sign-in…';
                        setNote(next);
                        ctx.setSaveNote(next);
                      }
                    });
                  }}
                  className="ss-btn ss-btn-ghost w-full justify-start px-4 py-3.5 text-sm bg-white shadow-[4px_4px_0_#111]"
                >
                  <GoogleIcon />
                  <span>Sign in with Google</span>
                </button>
                <p className="text-sm text-gray-600">
                  Sign in to sync projects across devices - your work is saved in this browser either way.
                </p>
                <div className="relative py-1">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-gray-300" />
                  <div className="relative mx-auto w-fit bg-white px-3 text-[11px] font-bold uppercase tracking-[0.22em] text-gray-500">
                    Or use email
                  </div>
                </div>

                <div className="flex rounded-2xl border-2 border-ink bg-white p-1 shadow-[4px_4px_0_#111]">
                  <button
                    onClick={() => setMode('otp')}
                    className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                      mode === 'otp' ? 'bg-primary text-ink' : 'text-gray-600 hover:text-ink'
                    }`}
                  >
                    Magic link
                  </button>
                  <button
                    onClick={() => setMode('password')}
                    className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                      mode === 'password' ? 'bg-primary text-ink' : 'text-gray-600 hover:text-ink'
                    }`}
                  >
                    Password
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500" htmlFor="auth-email">
                      Email
                    </label>
                    <div className="relative">
                      <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        id="auth-email"
                        data-testid="email-sign-in"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-2xl border-2 border-ink bg-surface px-11 py-3 text-sm text-ink shadow-[3px_3px_0_#111] placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  {mode === 'password' && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500" htmlFor="auth-password">
                        Password
                      </label>
                      <div className="relative">
                        <Lock size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          id="auth-password"
                          data-testid="auth-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="w-full rounded-2xl border-2 border-ink bg-surface px-11 py-3 pr-16 text-sm text-ink shadow-[3px_3px_0_#111] placeholder:text-gray-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border-2 border-ink bg-white px-2.5 py-1 text-xs font-semibold text-ink shadow-[2px_2px_0_#111]"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {mode === 'otp' ? (
                    <button
                      data-testid="email-sign-in-submit"
                      onClick={() => {
                        const trimmed = email.trim();
                        if (!trimmed) return;
                        void signInWithMagicLink(trimmed).then(({ error }) => {
                          if (error) {
                            const next = 'Email link unavailable — your work stays saved locally.';
                            setNote(next);
                            ctx.setSaveNote(next);
                          } else {
                            const next = `Magic link sent to ${trimmed}`;
                            setNote(next);
                            ctx.setSaveNote(next);
                          }
                        });
                      }}
                      className={actionButton}
                    >
                      Send magic link
                    </button>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        data-testid="email-sign-up"
                        onClick={() => {
                          const trimmed = email.trim();
                          if (!trimmed || !password) return;
                          void signUpWithPassword(trimmed, password).then(({ error }) => {
                            if (error) {
                              const next = 'Sign-up failed — your work stays saved locally.';
                              setNote(next);
                              ctx.setSaveNote(next);
                            } else {
                              const next = 'Account created. Check your email if confirmation is required.';
                              setNote(next);
                              ctx.setSaveNote(next);
                            }
                          });
                        }}
                        className={actionButton}
                      >
                        Create account
                      </button>
                      <button
                        data-testid="email-password-sign-in"
                        onClick={() => {
                          const trimmed = email.trim();
                          if (!trimmed || !password) return;
                          void signInWithPassword(trimmed, password).then(({ error }) => {
                            if (error) {
                              const next = 'Sign-in failed — your work stays saved locally.';
                              setNote(next);
                              ctx.setSaveNote(next);
                            } else {
                              const next = `Signed in as ${trimmed}`;
                              setNote(next);
                              ctx.setSaveNote(next);
                            }
                          });
                        }}
                        className={ghostButton}
                      >
                        Sign in
                      </button>
                    </div>
                  )}
                </div>

                {note && (
                  <div className="rounded-2xl border-2 border-ink bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                    {note}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary border-2 border-ink flex items-center justify-center font-bold text-ink">
                    {(ctx.user.displayName ?? ctx.user.email ?? 'U').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">
                      {ctx.user.displayName ?? 'Signed in'}
                    </div>
                    <div data-testid="account-email" className="text-sm text-gray-600">
                      {ctx.user.email ?? 'No email available'}
                    </div>
                    <div className="text-xs text-gray-500">Signed in with Google or email</div>
                  </div>
                </div>
                <button onClick={() => void ctx.signOut()} className={ghostButton}>
                  Sign out
                </button>
                <p className="text-sm text-gray-600">
                  Sign in to sync projects across devices - your work is saved in this browser either way.
                </p>
              </div>
            )}
          </div>

          <div className="ss-card bg-white p-5 md:p-6">
            <p className="text-sm font-semibold text-ink">Current project sync</p>
            <p className="mt-2 text-sm text-gray-600">
              {ctx.user
                ? ctx.cloudProjectId
                  ? ctx.saveNote.includes('failed')
                    ? 'Sync failed'
                    : 'Synced'
                  : 'Not yet saved to cloud'
                : 'Sign in to enable cloud sync'}
            </p>
            {ctx.user && ctx.canPromoteToCloud && (
              <button data-testid="save-to-cloud" onClick={ctx.onSaveToCloud} className="mt-4 ss-btn ss-btn-primary w-full px-4 py-3 text-sm">
                ☁ Save to my account
              </button>
            )}
            <Link to="/projects" className="inline-flex mt-3 ss-btn ss-btn-ghost w-full px-4 py-3 text-sm">
              See all your projects
            </Link>
          </div>

          <div className="ss-card bg-white p-5 md:p-6 border-red-300">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="mt-0.5 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-ink">Danger zone</p>
                <p className="mt-1 text-sm text-gray-600">
                  Delete cloud projects associated with your account. Your local browser projects stay untouched.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500" htmlFor="delete-confirm">
                Type your email to confirm
              </label>
              <input
                id="delete-confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={ctx.user?.email ?? 'you@example.com'}
                className="w-full rounded-2xl border-2 border-ink bg-surface px-4 py-3 text-sm text-ink shadow-[3px_3px_0_#111]"
              />
              <p className="text-xs text-gray-600">
                This will delete cloud projects tied to your account. Local browser projects stay untouched.
              </p>
              {supportsDelete ? (
                <button
                  disabled={!isDangerConfirmed}
                  className="ss-btn ss-btn-ghost w-full px-4 py-3 text-sm text-red-700"
                >
                  Delete my account
                </button>
              ) : (
                <a
                  href={isDangerConfirmed ? dangerMail : '#'}
                  onClick={(e) => {
                    if (!isDangerConfirmed) e.preventDefault();
                  }}
                  aria-disabled={!isDangerConfirmed}
                  className={`inline-flex ss-btn ss-btn-ghost w-full px-4 py-3 text-sm ${
                    isDangerConfirmed ? 'text-red-700' : 'pointer-events-none opacity-50'
                  }`}
                >
                  Delete my account via support
                </a>
              )}
            </div>
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}

export function EditorPreferencesPage() {
  const ctx = useOutletContext<EditorOutletContext>();
  const { preferences, setPreferences, resetPreferences } = ctx;
  const update = <K extends keyof PinboardPreferences>(key: K, value: PinboardPreferences[K]) => {
    setPreferences({ ...preferences, [key]: value });
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        <div className="ss-card overflow-hidden bg-white">
        <div className="border-b-2 border-ink px-6 py-5 bg-[linear-gradient(90deg,#f7fbf7,#ffffff)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Preferences</p>
          <h2 className="mt-2 text-3xl font-bold text-ink">How Pinboard behaves for you</h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            These are local browser preferences. They do not change the project document, and they do not require sign-in.
          </p>
        </div>

        <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-2">
          <PreferenceSection title="Editor">
            <PreferenceField label="Default editor mode for new projects">
              <select
                value={preferences.defaultEditorMode}
                onChange={(e) => update('defaultEditorMode', e.target.value as EditorMode)}
                className="w-full rounded-2xl border-2 border-ink bg-surface px-4 py-3 text-sm font-semibold text-ink shadow-[3px_3px_0_#111]"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </PreferenceField>
            <PreferenceField label="Code preview font size">
              <select
                value={preferences.codePreviewFontSize}
                onChange={(e) => update('codePreviewFontSize', e.target.value as PinboardPreferences['codePreviewFontSize'])}
                className="w-full rounded-2xl border-2 border-ink bg-surface px-4 py-3 text-sm font-semibold text-ink shadow-[3px_3px_0_#111]"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </PreferenceField>
            <PreferenceField label="Autosave">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={preferences.autosaveEnabled}
                    onChange={(e) => update('autosaveEnabled', e.target.checked)}
                  />
                  Enable autosave
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                  Autosave debounce ({preferences.autosaveDebounceMs} ms)
                </label>
                <input
                  type="range"
                  min={250}
                  max={5000}
                  step={50}
                  value={preferences.autosaveDebounceMs}
                  onChange={(e) => update('autosaveDebounceMs', Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </PreferenceField>
          </PreferenceSection>

          <PreferenceSection title="Lessons">
            <p className="text-sm text-gray-600">
              Lesson hints are already click-to-reveal, so there is no separate hint preference to toggle yet.
            </p>
          </PreferenceSection>

          <PreferenceSection title="Simulation">
            <p className="text-sm text-gray-600">
              Simulation speed and sound are not exposed as live app preferences yet, so they stay on the project and runtime side.
            </p>
          </PreferenceSection>

          <PreferenceSection title="Accessibility">
            <p className="text-sm text-gray-600">
              Reduced-motion and high-contrast overrides are not wired to a second palette in this build, so those controls are omitted for now.
            </p>
          </PreferenceSection>
        </div>

        <div className="border-t-2 border-ink px-6 py-5 flex flex-wrap items-center justify-between gap-3 bg-gray-50">
          <p className="text-sm text-gray-600">Reset these browser preferences to their defaults at any time.</p>
          <button onClick={resetPreferences} className="ss-btn ss-btn-ghost px-4 py-2.5 text-sm">
            Reset to defaults
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

function PreferenceSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ss-card bg-white p-5 md:p-6">
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function PreferenceField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</span>
      {children}
    </label>
  );
}

export default App;
