import { Handle, Position } from 'reactflow';
import styles from './baseNode.module.css';

export default function OptionsNode({ data }) {
    const opts = data.options || [];
    return (
        <div className={styles.node} style={{ borderColor: '#a78bfa' }}>
            <div className={styles.header} style={{ background: 'rgba(167,139,250,0.1)' }}>
                <span className={styles.icon}>🔢</span>
                <span className={styles.label}>Options</span>
            </div>
            <div className={styles.body}>
                <div style={{ marginBottom: 6, color: '#e2e8f0', fontSize: 11 }}>{data.question?.slice(0, 40)}</div>
                {opts.map((o, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span className={styles.tag}>{i + 1}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{o.label}</span>
                        {/* Each option has its own source handle */}
                        <Handle
                            type="source"
                            position={Position.Right}
                            id={`option_${i}`}
                            style={{ top: 'auto', bottom: 'auto', right: -8, background: '#a78bfa', width: 8, height: 8 }}
                        />
                    </div>
                ))}
            </div>
            <Handle type="target" position={Position.Top} style={{ background: '#a78bfa' }} />
        </div>
    );
}
