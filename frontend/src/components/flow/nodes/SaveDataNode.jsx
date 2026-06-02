import { Handle, Position } from 'reactflow';
import styles from './baseNode.module.css';

export default function SaveDataNode({ data }) {
    return (
        <div className={styles.node} style={{ borderColor: '#38bdf8' }}>
            <div className={styles.header} style={{ background: 'rgba(56,189,248,0.1)' }}>
                <span className={styles.icon}>💾</span>
                <span className={styles.label}>Save Data</span>
            </div>
            <div className={styles.body} style={{ fontSize: 11, color: '#9ca3af' }}>
                Saves collected data to Firebase
            </div>
            <Handle type="target" position={Position.Top} style={{ background: '#38bdf8' }} />
            <Handle type="source" position={Position.Bottom} style={{ background: '#38bdf8' }} />
        </div>
    );
}
