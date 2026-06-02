import { Handle, Position } from 'reactflow';
import styles from './baseNode.module.css';

export default function CollectNode({ data }) {
    return (
        <div className={styles.node} style={{ borderColor: '#34d399' }}>
            <div className={styles.header} style={{ background: 'rgba(52,211,153,0.1)' }}>
                <span className={styles.icon}>📝</span>
                <span className={styles.label}>Collect Data</span>
            </div>
            <div className={styles.body}>
                <div style={{ marginBottom: 4, color: '#e2e8f0', fontSize: 11 }}>{data.question?.slice(0, 50)}</div>
                <span className={styles.tag}>saves to: {data.field || 'field'}</span>
            </div>
            <Handle type="target" position={Position.Top} style={{ background: '#34d399' }} />
            <Handle type="source" position={Position.Bottom} style={{ background: '#34d399' }} />
        </div>
    );
}
