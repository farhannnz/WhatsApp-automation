import { Handle, Position } from 'reactflow';
import styles from './baseNode.module.css';

export default function TriggerNode({ data }) {
    return (
        <div className={styles.node} style={{ borderColor: '#facc15' }}>
            <div className={styles.header} style={{ background: 'rgba(250,204,21,0.1)' }}>
                <span className={styles.icon}>⚡</span>
                <span className={styles.label}>Trigger</span>
            </div>
            <div className={styles.body}>
                {data.matchType === 'any' ? 'Any message' : (
                    <><span className={styles.tag}>{data.matchType}</span> {data.keyword}</>
                )}
            </div>
            <Handle type="source" position={Position.Bottom} style={{ background: '#facc15' }} />
        </div>
    );
}
