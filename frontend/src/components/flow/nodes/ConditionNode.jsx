import { Handle, Position } from 'reactflow';
import styles from './baseNode.module.css';

export default function ConditionNode({ data }) {
    return (
        <div className={styles.node} style={{ borderColor: '#fb923c' }}>
            <div className={styles.header} style={{ background: 'rgba(251,146,60,0.1)' }}>
                <span className={styles.icon}>🔀</span>
                <span className={styles.label}>Condition</span>
            </div>
            <div className={styles.body}>
                <span className={styles.tag}>{data.field}</span>
                <span className={styles.tag}>{data.operator}</span>
                <span className={styles.tag}>{data.value || '...'}</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11 }}>
                    <span style={{ color: '#4ade80' }}>✓ True</span>
                    <span style={{ color: '#f87171' }}>✗ False</span>
                </div>
            </div>
            <Handle type="target" position={Position.Top} style={{ background: '#fb923c' }} />
            <Handle type="source" id="true" position={Position.Bottom} style={{ left: '30%', background: '#4ade80' }} />
            <Handle type="source" id="false" position={Position.Bottom} style={{ left: '70%', background: '#f87171' }} />
        </div>
    );
}
