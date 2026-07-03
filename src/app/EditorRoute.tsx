/**
 * /editor/:localId — the editor keyed by project id, so navigating between
 * projects remounts it cleanly. An unknown id starts a fresh starter project
 * under that id (this is how /editor/new works).
 */
import { useParams } from 'react-router-dom';
import App from '../App';

export default function EditorRoute() {
  const { localId } = useParams<'localId'>();
  return <App key={localId} localId={localId} />;
}
