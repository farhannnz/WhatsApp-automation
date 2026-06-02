import { Handle, Position } from 'reactflow';
import styles from './baseNode.module.css';

export default function EndNode({ data }) {
    return (
        <div className={styles.node} style={{ borderColor: '#6b7280' }}>
            <div className={styles.header} style={{ background: 'rgba(107,114,128,0.1)' }}>
                <span className={styles.icon}>🏁</span>
                <span className={styles.label}>End</span>
            </div>
            {data.text && (
                <div className={styles.body}>
                    <span className={styles.preview}>{data.text.slice(0, 60)}</span>
                </div>
            )}
            <Handle type="target" position={Position.Top} style={{ background: '#6b7280' }} />
        </div>
    );
}
