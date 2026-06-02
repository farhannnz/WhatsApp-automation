import { Handle, Position } from 'reactflow';
import styles from './baseNode.module.css';

export default function MessageNode({ data }) {
    return (
        <div className={styles.node} style={{ borderColor: '#6366f1' }}>
            <div className={styles.header} style={{ background: 'rgba(99,102,241,0.1)' }}>
                <span className={styles.icon}>💬</span>
                <span className={styles.label}>Send Message</span>
            </div>
            <div className={styles.body}>
                <span className={styles.preview}>{(data.text || '').slice(0, 80)}{data.text?.length > 80 ? '...' : ''}</span>
            </div>
            <Handle type="target" position={Position.Top} style={{ background: '#6366f1' }} />
            <Handle type="source" position={Position.Bottom} style={{ background: '#6366f1' }} />
        </div>
    );
}
